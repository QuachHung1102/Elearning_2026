import { CourseProgressCardSkeleton } from "@/components/learning/course-progress-card";
import { Skeleton } from "@/components/ui/feedback";

/** Three `CourseProgressCard` blocks (UX_PLAN.md §6.2). */
export default function Loading() {
  return (
    <div className="page-shell grid gap-6 py-6 lg:gap-8 lg:py-10" aria-busy="true">
      <span className="sr-only">Đang tải…</span>
      <div className="grid gap-2">
        <Skeleton className="h-11 w-72" />
        <Skeleton className="h-7 w-80 max-w-full" />
      </div>
      <Skeleton className="h-[2.8125rem] w-48" />
      <ul
        aria-hidden="true"
        className="grid list-none gap-6 p-0 md:grid-cols-2 lg:grid-cols-3"
      >
        {[0, 1, 2].map((index) => (
          <CourseProgressCardSkeleton key={index} />
        ))}
      </ul>
    </div>
  );
}
