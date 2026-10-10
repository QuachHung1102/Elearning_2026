import { Skeleton } from "@/components/ui/feedback";

/**
 * Five rows, as `/account/orders` shows while it loads (UX_PLAN.md §6.2); the
 * title and tabs above stay from the layout.
 */
export default function Loading() {
  return (
    <section className="grid gap-8" aria-busy="true">
      <span className="sr-only">Đang tải…</span>
      <div aria-hidden="true" className="grid gap-3">
        {[0, 1, 2, 3, 4].map((index) => (
          <Skeleton key={index} className="h-14" />
        ))}
      </div>
    </section>
  );
}
