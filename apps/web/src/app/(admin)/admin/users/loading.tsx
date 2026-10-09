import { Skeleton } from "@/components/ui/feedback";

/** Heights match the real page: the toolbar takes three rows and rows become cards below 768px. */
export default function Loading() {
  return (
    <div className="grid gap-6" aria-busy="true">
      <span className="sr-only">Đang tải…</span>
      <Skeleton className="h-[6.125rem] w-full max-w-xl sm:h-[4.5rem]" />
      <Skeleton className="h-[13.75rem] w-full md:h-[4.625rem] md:max-w-4xl" />
      <div className="hidden gap-3 md:grid">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </div>
      <div className="grid gap-3 md:hidden">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-[11.75rem] w-full" />
        ))}
      </div>
    </div>
  );
}
