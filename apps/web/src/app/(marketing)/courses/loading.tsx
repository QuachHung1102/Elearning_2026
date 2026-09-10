import { CourseCardSkeleton } from "@/components/catalog/course-card";
import { Skeleton } from "@/components/ui/feedback";

export default function Loading() {
  return (
    <div className="page-shell grid gap-8 py-10 lg:py-14" aria-busy="true">
      <span className="sr-only">Đang tải danh sách khóa học…</span>
      <Skeleton className="h-11 w-56" />
      <ul className="grid list-none grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-6 p-0">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((key) => (
          <CourseCardSkeleton key={key} />
        ))}
      </ul>
    </div>
  );
}
