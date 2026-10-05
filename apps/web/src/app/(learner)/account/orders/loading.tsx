import { Skeleton } from "@/components/ui/feedback";

/** Five rows, as `/account/orders` shows while it loads (UX_PLAN.md §6.2). */
export default function Loading() {
  return (
    <section className="grid gap-8" aria-busy="true">
      <span className="sr-only">Đang tải…</span>
      <div className="grid gap-2">
        <Skeleton className="h-11 w-48" />
        <Skeleton className="h-6 w-80" />
      </div>
      <div aria-hidden="true" className="grid gap-3">
        {[0, 1, 2, 3, 4].map((index) => (
          <Skeleton key={index} className="h-14" />
        ))}
      </div>
    </section>
  );
}
