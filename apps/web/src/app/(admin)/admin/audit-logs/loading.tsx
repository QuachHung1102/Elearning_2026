import { Skeleton } from "@/components/ui/feedback";

/**
 * Ten table rows (UX_PLAN.md §6.2); rows become cards below 768px. Heights
 * are the real page's, measured at 375/768/1024/1440: title block, toolbar
 * (one, two, three columns, then one row), 47px header, 56px rows, cards.
 */
export default function Loading() {
  return (
    <div className="grid gap-6" aria-busy="true">
      <span className="sr-only">Đang tải…</span>
      <Skeleton className="h-[6.125rem] w-64 sm:h-[4.5rem]" />
      <Skeleton className="h-[29.875rem] w-full sm:h-[15.375rem] lg:h-40 xl:h-[4.625rem]" />
      <div
        aria-hidden="true"
        className="hidden overflow-clip rounded-lg border border-border md:block"
      >
        <Skeleton className="h-[2.875rem] w-full rounded-none" />
        {Array.from({ length: 10 }, (_, index) => (
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
          <Skeleton key={index} className="h-[11.875rem] w-full" />
        ))}
      </div>
    </div>
  );
}
