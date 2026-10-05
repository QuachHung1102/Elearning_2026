import { Skeleton } from "@/components/ui/feedback";

/**
 * Eight table rows (UX_PLAN.md §6.2); rows become cards below 1280px. The block
 * heights are estimates, not measured in a browser like the enrollments ones.
 */
export default function Loading() {
  return (
    <div className="grid gap-6" aria-busy="true">
      <span className="sr-only">Đang tải…</span>
      <Skeleton className="h-[4.5rem] w-full" />
      <Skeleton className="h-[13.75rem] w-full sm:h-[4.625rem] lg:max-w-3xl" />
      <div
        aria-hidden="true"
        className="hidden overflow-clip rounded-lg border border-border xl:block"
      >
        <Skeleton className="h-[2.875rem] w-full rounded-none" />
        {Array.from({ length: 8 }, (_, index) => (
          <div
            key={index}
            className="flex h-20 items-center border-t border-border px-4"
          >
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </div>
      <div className="grid gap-3 xl:hidden">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-[18rem] w-full" />
        ))}
      </div>
    </div>
  );
}
