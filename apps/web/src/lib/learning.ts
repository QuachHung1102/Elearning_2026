import type {
  CourseCard,
  CourseDetail,
  CourseStatus,
  LessonType,
} from "./catalog";

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

/** `GET /learn/{slug}`; `course.status` is the documented additive field. */
export type LearnShell = {
  course: CourseDetail & { status: CourseStatus };
  progress: CourseProgress;
  completedLessonIds: string[];
  resumeLessonId: string | null;
};

/**
 * How this viewer holds the course. `ADMIN` and `PREVIEW` read but record
 * nothing (API_CONTRACT.md §5.5).
 */
export type LearnMode = "ENROLLED" | "ADMIN" | "PREVIEW";

export type Resource = {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  position: number;
};

export type Progress = {
  lastPositionSeconds: number;
  completedAt: string | null;
};

/** `LessonContent` (API_CONTRACT.md §4). */
export type LessonContent = {
  id: string;
  courseId: string;
  sectionId: string;
  title: string;
  type: LessonType;
  content: string | null;
  durationSeconds: number;
  hasVideo: boolean;
  isPreview: boolean;
  resources: Resource[];
  progress: Progress | null;
  prevLessonId: string | null;
  nextLessonId: string | null;
};

export type Playback = {
  playbackUrl: string;
  kind: "hls" | "mp4";
  expiresAt: string;
};

export type SignedDownload = { url: string; filename: string; expiresAt: string };

export type SaveProgressResult = {
  progress: Progress;
  courseProgress: CourseProgress;
};

/** Every lesson in curriculum order, the order prev/next and resume follow. */
export const orderedLessons = (sections: CourseDetail["sections"]) =>
  sections.flatMap((section) =>
    section.lessons.map((lesson) => ({ ...lesson, sectionId: section.id })),
  );

/** `1,2 MB`, `850 KB` — resource sizes are never shown in raw bytes. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1_048_576) {
    return `${(bytes / 1_048_576).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString("vi-VN")} KB`;
}
