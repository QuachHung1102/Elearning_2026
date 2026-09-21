import { Skeleton } from "@/components/ui/feedback";

/**
 * Eight table rows (UX_PLAN.md §6.2); rows become cards below 768px. Block
 * heights are the real page's, measured at 375 and 640–1440.
 */
export default function Loading() {
  return (
    <div className="grid gap-6" aria-busy="true">
      <span className="sr-only">Đang tải…</span>
      <Skeleton className="h-[9.875rem] w-full sm:h-[4.5rem]" />
      <Skeleton className="h-[13.75rem] w-full sm:h-[4.625rem] lg:max-w-3xl" />
      <div
        aria-hidden="true"
        className="hidden overflow-clip rounded-lg border border-border md:block"
      >
        <Skeleton className="h-[2.875rem] w-full rounded-none" />
        {Array.from({ length: 8 }, (_, index) => (
          <div
            key={index}
            className="flex h-14 items-center border-t border-border px-4"
          >
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </div>
      <div className="grid gap-3 md:hidden">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-[16.75rem] w-full" />
        ))}
      </div>
    </div>
  );
}
