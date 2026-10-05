import Link from "next/link";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/feedback";
import { formatPrice } from "@/lib/format";

/**
 * The order at a glance (UX_PLAN.md §4.8): what is bought and for how much.
 * `priceVnd` is `null` while the checkout is still opening, so the amount is
 * never guessed from a cached page: the QR's own amount is what is charged.
 */
export function OrderSummary({
  variant,
  title,
  href,
  priceVnd,
  rows = [],
}: {
  variant: "checkout" | "receipt";
  title: string;
  href?: string;
  priceVnd: number | null;
  rows?: readonly (readonly [label: string, value: ReactNode])[];
}) {
  return (
    <section
      aria-labelledby="order-summary-title"
      className="grid gap-4 rounded-xl border border-border bg-card p-6"
    >
      <h2 id="order-summary-title" className="text-xl font-semibold">
        {variant === "checkout" ? "Đơn hàng của bạn" : "Biên nhận"}
      </h2>
      <div className="grid gap-1">
        <p className="text-sm text-muted-foreground">Khóa học</p>
        {href ? (
          <Link
            href={href}
            className="inline-flex min-h-11 items-center font-semibold [overflow-wrap:anywhere] hover:text-primary-text"
          >
            {title}
          </Link>
        ) : (
          <p className="font-semibold [overflow-wrap:anywhere]">{title}</p>
        )}
      </div>
      {rows.length > 0 && (
        <dl className="grid gap-2 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-4">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-right [overflow-wrap:anywhere]">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="flex items-baseline justify-between gap-4 border-t border-border pt-4">
        <span className="font-semibold">
          {variant === "checkout" ? "Tổng thanh toán" : "Số tiền"}
        </span>
        <span className="text-2xl font-bold">
          {priceVnd === null ? (
            <Skeleton className="h-8 w-28" />
          ) : (
            formatPrice(priceVnd)
          )}
        </span>
      </div>
    </section>
  );
}
