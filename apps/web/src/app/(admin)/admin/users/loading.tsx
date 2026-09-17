import { Skeleton } from "@/components/ui/feedback";

/** Heights match the real page: the toolbar wraps and rows become cards below 768px. */
export default function Loading() {
  return (
    <div className="grid gap-6" aria-busy="true">
      <span className="sr-only">Đang tải…</span>
      <Skeleton className="h-[2.375rem] w-48" />
      <Skeleton className="h-40 w-full sm:h-[8.375rem] md:h-[4.625rem] md:max-w-2xl" />
      <div className="hidden gap-3 md:grid">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </div>
      <div className="grid gap-3 md:hidden">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-40 w-full" />
        ))}
      </div>
    </div>
  );
}
