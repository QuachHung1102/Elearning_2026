import { Prisma } from '../generated/prisma/client.js';

/** `CourseProgress` (API_CONTRACT.md §4). */
export type CourseProgress = {
  completedLessons: number;
  totalLessons: number;
  percent: number;
};

export function courseProgress(
  completedLessons: number,
  totalLessons: number,
): CourseProgress {
  return {
    completedLessons,
    totalLessons,
    percent: totalLessons
      ? Math.round((100 * completedLessons) / totalLessons)
      : 0,
  };
}

/**
 * The SQL twin of `summarizeProgress` for a list: a `LATERAL` subquery over
 * enrollment alias `e` yielding `total`, `completed` and `last_activity_at`
 * (null when not started). Only lessons still in the curriculum count.
 */
export const PROGRESS_STATS = Prisma.sql`
  CROSS JOIN LATERAL (
    SELECT count(*)::int AS total,
           count(p.completed_at)::int AS completed,
           max(p.updated_at) AS last_activity_at
    FROM sections s
    JOIN lessons l ON l.section_id = s.id
    LEFT JOIN lesson_progress p ON p.lesson_id = l.id AND p.user_id = e.user_id
    WHERE s.course_id = e.course_id
  ) stats`;

export type ProgressRow = {
  lessonId: string;
  completedAt: Date | null;
  updatedAt: Date;
};

/**
 * One course's progress for one learner, free of I/O. `lessonIds` is the
 * current curriculum in order (section position, then lesson position), so a
 * progress row left over from a lesson that no longer exists never counts.
 *
 * `resumeLessonId` is the lesson touched most recently, else the first lesson,
 * else `null` for a course with no lessons. `lastActivityAt` is that newest
 * touch, `null` when the learner has not started.
 */
export function summarizeProgress(
  lessonIds: readonly string[],
  rows: readonly ProgressRow[],
): {
  progress: CourseProgress;
  resumeLessonId: string | null;
  lastActivityAt: Date | null;
} {
  const inCourse = new Set(lessonIds);
  let completedLessons = 0;
  let latest: ProgressRow | null = null;
  for (const row of rows) {
    if (!inCourse.has(row.lessonId)) continue;
    if (row.completedAt) completedLessons += 1;
    if (!latest || row.updatedAt > latest.updatedAt) latest = row;
  }
  return {
    progress: courseProgress(completedLessons, lessonIds.length),
    resumeLessonId: latest?.lessonId ?? lessonIds[0] ?? null,
    lastActivityAt: latest?.updatedAt ?? null,
  };
}
