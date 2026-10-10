import { HttpStatus } from '@nestjs/common';
import { ERROR_CODE, appError } from '../common/error-codes.js';
import { isSlugConflict } from '../common/prisma-errors.js';
import { config } from '../config.js';
import { Prisma } from '../generated/prisma/client.js';
import { LessonType, StorageProvider } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { isSameSet, reorderSteps, type PositionUpdate } from './reorder.js';
import { uniqueSlug } from './slug.js';

/** Helpers the course, curriculum and category services share. */

export type Tx = Prisma.TransactionClient;

/**
 * How many times a writer picks a new slug after losing one to another writer.
 * Each round of N writers with one title lets one of them through, so the last
 * of N needs N rounds: this is the most simultaneous writers of one title that
 * all succeed.
 */
const SLUG_ATTEMPTS = 20;

export function notFound(): never {
  throw appError(HttpStatus.NOT_FOUND, ERROR_CODE.NOT_FOUND, 'Not Found');
}

/**
 * Every write to a course's curriculum takes this first, so positions, id
 * sets and the lesson counters are read and written by one writer at a time.
 * The same lock `EnrollmentService.grant` and `updateCourse` use; always
 * taken before any child row, so writers cannot deadlock on each other.
 */
export async function lockCourse(tx: Tx, courseId: string): Promise<void> {
  await tx.$queryRaw`
      SELECT 1 FROM courses WHERE id = ${courseId}::uuid FOR NO KEY UPDATE`;
}

/**
 * The single writer of the two denormalised curriculum counters. Called in
 * the same transaction as every mutation that touches a lesson — publish and
 * the video status poll are just more callers, not the only ones.
 */
export async function recomputeCourse(
  tx: Tx,
  courseId: string,
): Promise<void> {
  await lockCourse(tx, courseId);
  const { _count, _sum } = await tx.lesson.aggregate({
    where: { section: { courseId } },
    _count: true,
    _sum: { durationSeconds: true },
  });
  await tx.course.update({
    where: { id: courseId },
    data: {
      lessonCount: _count,
      totalDurationSeconds: _sum.durationSeconds ?? 0,
    },
  });
}

/** The `findFirst` arguments that read the highest position in a scope. */
export const LAST_POSITION = {
  orderBy: { position: 'desc' },
  select: { position: true },
} as const;

/** One past the highest position `last` read, or 1 for an empty scope. */
export async function nextPosition(
  last: Promise<{ position: number } | null>,
): Promise<number> {
  return ((await last)?.position ?? 0) + 1;
}

/**
 * Writes `orderedIds` as the new order, through the two-phase routine of
 * `reorderSteps`, one update at a time in the order given.
 */
export async function writeOrder(
  orderedIds: string[],
  write: (update: PositionUpdate) => Promise<unknown>,
): Promise<void> {
  for (const phase of reorderSteps(orderedIds)) {
    for (const update of phase) {
      await write(update);
    }
  }
}

export function assertSameSet(current: string[], ordered: string[]): void {
  if (!isSameSet(current, ordered)) {
    throw appError(
      HttpStatus.BAD_REQUEST,
      ERROR_CODE.ORDER_MISMATCH,
      'The submitted order does not match the current items',
    );
  }
}

export function storageProvider(): StorageProvider {
  return config.storageDriver === 'r2'
    ? StorageProvider.CLOUDFLARE_R2
    : StorageProvider.DEMO;
}

/**
 * Picks a slug and writes with it. Two writers with one title read the same
 * "free" slug and only one insert survives (REVIEW F-06): the loser picks
 * again. A slug the caller chose is refused by `pick` itself once it is taken,
 * with `SLUG_TAKEN`, and so are the attempts that run out.
 */
export async function writeWithSlug<T>(
  pick: () => Promise<string>,
  write: (slug: string) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    const slug = await pick();
    try {
      return await write(slug);
    } catch (error) {
      if (!isSlugConflict(error)) throw error;
      if (attempt >= SLUG_ATTEMPTS) {
        throw appError(
          HttpStatus.CONFLICT,
          ERROR_CODE.SLUG_TAKEN,
          'Slug is already taken',
        );
      }
    }
  }
}

export async function resolveSlug(
  explicit: string | undefined,
  source: string,
  maxLength: number,
  isTaken: (slug: string) => Promise<boolean>,
): Promise<string> {
  if (!explicit) return uniqueSlug(source, isTaken, maxLength);
  if (await isTaken(explicit)) {
    throw appError(
      HttpStatus.CONFLICT,
      ERROR_CODE.SLUG_TAKEN,
      'Slug is already taken',
    );
  }
  return explicit;
}

export async function mustFindCategory(prisma: PrismaService, id: string) {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) notFound();
  return category;
}

export async function mustFindCourse(prisma: PrismaService, id: string) {
  const course = await prisma.course.findUnique({ where: { id } });
  if (!course) notFound();
  return course;
}

// ── Response shapes ──────────────────────────────────────────────

export function toCategory(category: {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  position: number;
  _count?: { courses: number };
}): CategoryDto {
  return {
    id: category.id,
    slug: category.slug,
    name: category.name,
    description: category.description,
    icon: category.icon,
    position: category.position,
    courseCount: category._count?.courses ?? 0,
  };
}

export function toSectionOutline(section: {
  id: string;
  title: string;
  position: number;
  lessons: LessonRow[];
}) {
  return {
    id: section.id,
    title: section.title,
    position: section.position,
    lessons: section.lessons.map((lesson) => toLessonOutline(lesson)),
  };
}

/** Never carries `content` or `videoAssetId` — that is the guest boundary. */
export function toLessonOutline(lesson: LessonRow) {
  return {
    id: lesson.id,
    title: lesson.title,
    position: lesson.position,
    type: lesson.type,
    durationSeconds: lesson.durationSeconds,
    isPreview: lesson.isPreview,
  };
}

export function toResource(resource: {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  position: number;
}) {
  return {
    id: resource.id,
    filename: resource.filename,
    contentType: resource.contentType,
    sizeBytes: resource.sizeBytes,
    position: resource.position,
  };
}

export type LessonRow = {
  id: string;
  title: string;
  position: number;
  type: LessonType;
  durationSeconds: number;
  isPreview: boolean;
};

export type CategoryDto = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  position: number;
  courseCount: number;
};
