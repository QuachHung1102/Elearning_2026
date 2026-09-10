import { Skeleton } from "@/components/ui/feedback";

export default function Loading() {
  return (
    <div className="page-shell grid gap-8 py-10 lg:py-14" aria-busy="true">
      <span className="sr-only">Đang tải khóa học…</span>
      <Skeleton className="h-11 w-3/4 max-w-2xl" />
      <Skeleton className="h-6 w-full max-w-xl" />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    </div>
  );
}
