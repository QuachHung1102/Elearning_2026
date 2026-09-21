import { Injectable } from '@nestjs/common';
import { LessonType } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  summarizeProgress,
  type CourseProgress,
} from '../enrollment/course-progress.js';

/** `Progress` (API_CONTRACT.md §4). */
export type Progress = {
  lastPositionSeconds: number;
  completedAt: Date | null;
};

export type ProgressInput = {
  lastPositionSeconds: number;
  /** `true` marks done once, `false` un-marks, omitted leaves it alone. */
  completed?: boolean;
};

/**
 * The write rule for one `LessonProgress` row, free of I/O
 * (DATA_MODEL.md §LessonProgress):
 * - an ARTICLE has no position, so it is always 0;
 * - otherwise the position is clamped to the lesson length when one is known,
 *   and never moves backwards — a late request from a stale tab must not undo
 *   a later save;
 * - `completedAt` is set once and never rewritten, cleared only by an
 *   explicit `completed: false`.
 *
 * There is no auto-complete here: the 95% threshold is measured by the client
 * on the `<video>` element's real duration (DEMO_MODE.md §2) and arrives as
 * `completed: true`.
 */
export function nextProgress(
  stored: Progress | null,
  input: ProgressInput,
  lesson: { type: LessonType; durationSeconds: number },
  now: Date,
): Progress {
  let position = 0;
  if (lesson.type !== LessonType.ARTICLE) {
    position =
      lesson.durationSeconds > 0
        ? Math.min(
            Math.max(input.lastPositionSeconds, 0),
            lesson.durationSeconds,
          )
        : Math.max(input.lastPositionSeconds, 0);
    position = Math.max(stored?.lastPositionSeconds ?? 0, position);
  }
  const completedAt =
    input.completed === true
      ? (stored?.completedAt ?? now)
      : input.completed === false
        ? null
        : (stored?.completedAt ?? null);
  return { lastPositionSeconds: position, completedAt };
}

const PROGRESS_SELECT = {
  lastPositionSeconds: true,
  completedAt: true,
} as const;

@Injectable()
export class ProgressService {
  constructor(private readonly prisma: PrismaService) {}

  /** Only ever called for an ENROLLED viewer; the controller checks. */
  async save(
    userId: string,
    lesson: {
      id: string;
      type: LessonType;
      durationSeconds: number;
      courseId: string;
    },
    input: ProgressInput,
  ): Promise<{ progress: Progress; courseProgress: CourseProgress }> {
    const where = { userId_lessonId: { userId, lessonId: lesson.id } };
    const progress = await this.prisma.$transaction(async (tx) => {
      // Read-modify-write under a row lock: two saves for the same row (the
      // player tick and the complete toggle, or two tabs) otherwise both read
      // the same stored row and the later commit undoes the earlier one. The
      // insert makes sure there is a row to lock; a fresh row reads as
      // { 0, null }, which the rule treats like no row at all.
      await tx.$executeRaw`
        INSERT INTO lesson_progress (id, user_id, lesson_id, updated_at)
        VALUES (gen_random_uuid(), ${userId}::uuid, ${lesson.id}::uuid, now())
        ON CONFLICT (user_id, lesson_id) DO NOTHING`;
      const [stored] = await tx.$queryRaw<Progress[]>`
        SELECT last_position_seconds AS "lastPositionSeconds",
               completed_at AS "completedAt"
        FROM lesson_progress
        WHERE user_id = ${userId}::uuid AND lesson_id = ${lesson.id}::uuid
        FOR UPDATE`;
      const next = nextProgress(stored ?? null, input, lesson, new Date());
      return tx.lessonProgress.update({
        where,
        data: next,
        select: PROGRESS_SELECT,
      });
    });
    const { progress: courseProgress } = await this.courseSummary(
      userId,
      lesson.courseId,
    );
    return { progress, courseProgress };
  }

  async lessonProgress(userId: string, lessonId: string) {
    return this.prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
      select: PROGRESS_SELECT,
    });
  }

  /**
   * `userId: null` is the admin preview: the curriculum is counted but nothing
   * of anyone's progress is read (API_CONTRACT.md §5.5).
   */
  async courseSummary(userId: string | null, courseId: string) {
    const lessons = await this.prisma.lesson.findMany({
      where: { section: { courseId } },
      orderBy: [{ section: { position: 'asc' } }, { position: 'asc' }],
      select: { id: true },
    });
    const lessonIds = lessons.map(({ id }) => id);
    const rows = userId
      ? await this.prisma.lessonProgress.findMany({
          where: { userId, lessonId: { in: lessonIds } },
          select: { lessonId: true, completedAt: true, updatedAt: true },
        })
      : [];
    return {
      ...summarizeProgress(lessonIds, rows),
      lessonIds,
      completedLessonIds: lessonIds.filter((id) =>
        rows.some((row) => row.lessonId === id && row.completedAt),
      ),
    };
  }
}
