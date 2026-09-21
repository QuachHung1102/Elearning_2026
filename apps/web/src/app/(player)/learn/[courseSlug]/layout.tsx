import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { CurriculumDrawer } from "@/components/learning/curriculum-drawer";
import { PlayerCurriculum } from "@/components/learning/player-curriculum";
import { ProgressBar } from "@/components/learning/progress-bar";
import { OfflineBanner, SyncChip } from "@/components/learning/sync-status";
import { Alert } from "@/components/ui/feedback";
import { progressText, type CourseProgress } from "@/lib/learning";
import { getLearnContext } from "./context";

function CourseProgressSummary({
  progress,
  title,
  announce = false,
}: {
  progress: CourseProgress;
  title: string;
  announce?: boolean;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-semibold tabular-nums">
          {progress.completedLessons}/{progress.totalLessons} bài
        </span>
        <SyncChip
          announce={announce}
          completedLessons={progress.completedLessons}
        />
      </div>
      <ProgressBar
        size="md"
        percent={progress.percent}
        label={`Tiến độ khóa ${title}`}
        valueText={progressText(progress)}
      />
    </div>
  );
}

/**
 * The player shell (UX_PLAN.md §7.2): a slim header instead of `SiteHeader`,
 * the lesson on the left and the curriculum in a sticky, independently
 * scrolling column from 1024px; below that the curriculum is a drawer.
 */
export default async function PlayerLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ courseSlug: string }>;
}) {
  const { courseSlug } = await params;
  const { shell, mode } = await getLearnContext(courseSlug);
  const { course, progress, completedLessonIds } = shell;
  const tracked = mode === "ENROLLED";
  const back =
    mode === "PREVIEW"
      ? { href: `/courses/${course.slug}`, label: course.title }
      : mode === "ADMIN"
        ? { href: `/admin/courses/${course.id}`, label: course.title }
        : { href: "/my-courses", label: "Khóa học của tôi" };

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card text-card-foreground">
        <div className="flex h-14 items-center gap-2 px-2 md:h-16 md:px-4">
          <Link
            href={back.href}
            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md px-2 text-sm font-medium hover:bg-muted"
          >
            <ArrowLeft aria-hidden="true" className="size-5" strokeWidth={1.75} />
            <span className="sr-only">Quay lại {back.label}</span>
          </Link>
          <p className="min-w-0 flex-1 truncate font-heading font-semibold">
            {course.title}
          </p>
          {tracked && (
            // Next to the thin bar under this row; from 1024px the sidebar
            // shows its own.
            <span className="shrink-0 lg:hidden">
              <SyncChip compact completedLessons={progress.completedLessons} />
            </span>
          )}
          <CurriculumDrawer
            sections={course.sections}
            courseSlug={course.slug}
            completedLessonIds={completedLessonIds}
            mode={mode}
            progress={
              tracked ? (
                <CourseProgressSummary progress={progress} title={course.title} />
              ) : undefined
            }
          />
        </div>
        {tracked && (
          <div className="lg:hidden">
            <ProgressBar
              percent={progress.percent}
              label={`Tiến độ khóa ${course.title}`}
              valueText={progressText(progress)}
            />
          </div>
        )}
      </header>

      <OfflineBanner tracked={tracked} />
      {(mode === "ADMIN" || course.status === "ARCHIVED") && (
        <div className="grid gap-2 px-4 pt-3 md:px-6 lg:px-8">
          {mode === "ADMIN" && (
            <Alert
              variant="warning"
              title="Bạn đang xem trước với quyền quản trị. Tiến độ học không được ghi lại."
            />
          )}
          {course.status === "ARCHIVED" && (
            <Alert
              variant="info"
              title="Khóa học này đã ngừng nhận học viên mới. Bạn vẫn học được đầy đủ."
            />
          )}
        </div>
      )}

      <div className="flex-1 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
        <main id="main" tabIndex={-1} className="min-w-0">
          {children}
        </main>
        <aside
          aria-labelledby="course-outline-title"
          data-scroll-box
          className="sticky top-16 hidden max-h-[calc(100dvh-64px)] self-start overflow-y-auto border-l border-border bg-card lg:block"
        >
          <h2
            id="course-outline-title"
            className="px-4 pt-4 font-heading text-lg font-semibold"
          >
            Nội dung khóa học
          </h2>
          {tracked && (
            <div className="border-b border-border p-4">
              <CourseProgressSummary
                progress={progress}
                title={course.title}
                announce
              />
            </div>
          )}
          <PlayerCurriculum
            sections={course.sections}
            courseSlug={course.slug}
            completedLessonIds={completedLessonIds}
            mode={mode}
            idPrefix="side"
          />
        </aside>
      </div>
    </div>
  );
}
