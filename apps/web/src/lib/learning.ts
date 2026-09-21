import type { CourseCard, CourseStatus } from "./catalog";

/** `CourseProgress` (API_CONTRACT.md §4). */
export type CourseProgress = {
  completedLessons: number;
  totalLessons: number;
  percent: number;
};

/** `EnrollmentItem`; `course.status` is the documented additive field. */
export type EnrollmentItem = {
  id: string;
  course: CourseCard & { status: CourseStatus };
  status: "ACTIVE" | "REVOKED";
  source: "PURCHASE" | "MANUAL_GRANT";
  grantedAt: string;
  progress: CourseProgress;
  resumeLessonId: string | null;
};

/** `3/12 bài · 25%` — the one spoken and printed form of progress. */
export const progressText = ({ completedLessons, totalLessons, percent }: CourseProgress) =>
  `${completedLessons}/${totalLessons} bài · ${percent}%`;
