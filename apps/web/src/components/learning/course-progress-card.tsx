import Link from "next/link";
import { Cover } from "@/components/catalog/course-card";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/feedback";
import { progressText, type EnrollmentItem } from "@/lib/learning";
import { ProgressBar } from "./progress-bar";

/**
 * One enrolled course on `/my-courses` (UX_PLAN.md §3.3). The only link is the
 * CTA, so a keyboard user meets one stop per card; its accessible name carries
 * the course title because every card says "Bắt đầu học" or "Tiếp tục học".
 * Progress means completed lessons (§3.3 "bài xong / tổng bài"), so a course
 * with none done is still one to start.
 */
export function CourseProgressCard({
  enrollment,
  primary,
}: {
  enrollment: EnrollmentItem;
  /** The first card holds the page's main CTA (§3.3). */
  primary: boolean;
}) {
  const { course, progress } = enrollment;
  return (
    <li className="panel relative grid grid-rows-[auto_1fr]">
      <Cover course={course} />
      {/* Over the cover, so the badge never costs a row on the other cards. */}
      {course.status === "ARCHIVED" && (
        <span className="absolute top-3 left-3">
          <Badge>Đã ngừng bán</Badge>
        </span>
      )}
      <div className="grid content-start gap-3 p-4">
        <h2 className="line-clamp-2 min-h-14 text-xl font-semibold">
          {course.title}
        </h2>
        <div className="grid gap-2">
          <p className="text-sm text-muted-foreground tabular-nums">
            {progress.completedLessons} / {progress.totalLessons} bài đã hoàn
            thành
          </p>
          <ProgressBar
            percent={progress.percent}
            label={`Tiến độ khóa ${course.title}`}
            valueText={progressText(progress)}
          />
        </div>
        <Link
          href={`/learn/${course.slug}`}
          className={buttonClass(primary ? "primary" : "outline", "md", "mt-1 w-full")}
        >
          {progress.completedLessons > 0 ? "Tiếp tục học" : "Bắt đầu học"}
          <span className="sr-only">: {course.title}</span>
        </Link>
      </div>
    </li>
  );
}

export function CourseProgressCardSkeleton() {
  return (
    <li className="panel">
      <Skeleton className="aspect-video w-full rounded-b-none" />
      <div className="grid gap-3 p-4">
        <Skeleton className="h-14 w-4/5" />
        <div className="grid gap-2">
          <Skeleton className="h-[1.375rem] w-32" />
          <Skeleton className="h-1 w-full" />
        </div>
        <Skeleton className="mt-1 h-11 w-full" />
      </div>
    </li>
  );
}
