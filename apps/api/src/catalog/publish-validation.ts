import { LessonType } from '../generated/prisma/enums.js';

export const PUBLISH_FIELD = [
  'coverImageKey',
  'description',
  'priceVnd',
  'categoryId',
  'learningOutcomes',
  'sections',
  'lessons',
  'videoAsset',
  'previewLesson',
] as const;

export const PUBLISH_REASON = [
  'MISSING',
  'EMPTY',
  'TOO_SHORT',
  'NOT_READY',
] as const;

export type PublishField = (typeof PUBLISH_FIELD)[number];
export type PublishReason = (typeof PUBLISH_REASON)[number];

/** `lessonId` only appears on `videoAsset` and `lessons` issues. */
export type PublishIssue = {
  field: PublishField;
  reason: PublishReason;
  lessonId?: string;
};

export const DESCRIPTION_MIN_LENGTH = 200;

export type PublishLesson = {
  id: string;
  type: LessonType;
  content: string | null;
  isPreview: boolean;
  videoAssetId: string | null;
  /**
   * Read from `stream.getStatus()` at publish time, not from the stored
   * column — a video that finished encoding after the last write would
   * otherwise stay unpublishable.
   */
  videoReady: boolean;
};

export type PublishCandidate = {
  coverImageKey: string | null;
  description: string;
  priceVnd: number;
  categoryId: string | null;
  learningOutcomes: string[];
  sections: { id: string; lessons: PublishLesson[] }[];
};

/**
 * Every reason a course cannot go live, in one pass — an admin fixes the whole
 * list once instead of discovering it one button press at a time.
 * Both axes are closed lists; `PublishChecklist` on the web renders a fixed
 * Vietnamese line per pair (API_CONTRACT.md §5.3).
 */
export function publishIssues(course: PublishCandidate): PublishIssue[] {
  const issues: PublishIssue[] = [];

  if (!course.coverImageKey) {
    issues.push({ field: 'coverImageKey', reason: 'MISSING' });
  }
  if (course.description.trim().length === 0) {
    issues.push({ field: 'description', reason: 'MISSING' });
  } else if (course.description.trim().length < DESCRIPTION_MIN_LENGTH) {
    issues.push({ field: 'description', reason: 'TOO_SHORT' });
  }
  // `> 0`, not "set": a published course priced 0 is a sales page with no
  // working buy button. The DB CHECK only stops negatives.
  if (course.priceVnd <= 0) {
    issues.push({ field: 'priceVnd', reason: 'MISSING' });
  }
  if (!course.categoryId) {
    issues.push({ field: 'categoryId', reason: 'MISSING' });
  }
  if (course.learningOutcomes.length === 0) {
    issues.push({ field: 'learningOutcomes', reason: 'EMPTY' });
  }
  if (course.sections.length === 0) {
    issues.push({ field: 'sections', reason: 'EMPTY' });
  }

  for (const section of course.sections) {
    if (section.lessons.length === 0) {
      issues.push({ field: 'lessons', reason: 'EMPTY', lessonId: section.id });
    }
    for (const lesson of section.lessons) {
      if (lesson.type === LessonType.VIDEO) {
        if (!lesson.videoAssetId) {
          issues.push({
            field: 'videoAsset',
            reason: 'MISSING',
            lessonId: lesson.id,
          });
        } else if (!lesson.videoReady) {
          issues.push({
            field: 'videoAsset',
            reason: 'NOT_READY',
            lessonId: lesson.id,
          });
        }
      } else if (!lesson.content || lesson.content.trim().length === 0) {
        issues.push({
          field: 'lessons',
          reason: 'MISSING',
          lessonId: lesson.id,
        });
      }
    }
  }

  const lessons = course.sections.flatMap((section) => section.lessons);
  if (!lessons.some((lesson) => lesson.isPreview)) {
    issues.push({ field: 'previewLesson', reason: 'MISSING' });
  }

  return issues;
}
