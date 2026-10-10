import { ChevronRight } from "lucide-react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { isDuplicatePaid, newestAttempt, shortId } from "@/lib/admin-orders";
import { formatDateTime, formatPrice } from "@/lib/format";
import type { AdminPaymentRow } from "@/lib/orders";

function Time({ value }: { value: string }) {
  return (
    <time dateTime={value} className="tabular-nums">
      {formatDateTime(value)}
    </time>
  );
}

/** The order's own status, plus the two things an admin has to notice on it. */
export function OrderStatusCell({ order }: { order: AdminPaymentRow }) {
  return (
    <div className="grid justify-items-start gap-1">
      <StatusBadge status={order.status} />
      {order.status === "REFUND_REQUESTED" && (
        <span className="text-xs font-medium text-on-warning-subtle">
          Đang chờ xử lý
        </span>
      )}
      {isDuplicatePaid(order) && (
        <Badge variant="warning">Thanh toán trùng</Badge>
      )}
    </div>
  );
}

/**
 * The newest QR at a glance, and every QR of the order behind a native
 * `<details>` (no script, keyboard and screen reader support for free). The
 * expiry shows only while the QR is PENDING: after that it is history.
 */
export function OrderPaymentCell({ order }: { order: AdminPaymentRow }) {
  const latest = newestAttempt(order);
  if (!latest) {
    return <span className="text-muted-foreground">Chưa có lần thanh toán</span>;
  }
  return (
    <div className="grid justify-items-start gap-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <StatusBadge status={latest.status} />
        <span className="font-mono text-xs [overflow-wrap:anywhere]">
          {latest.appTransId}
        </span>
      </div>
      {latest.status === "PENDING" && (
        <p className="text-xs text-muted-foreground">
          Hết hạn lúc <Time value={latest.expiresAt} />
        </p>
      )}
      <details className="group w-full">
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 text-sm font-medium text-primary-text hover:underline [&::-webkit-details-marker]:hidden">
          <ChevronRight
            aria-hidden="true"
            className="size-4 shrink-0 transition-transform duration-[var(--duration-fast)] group-open:rotate-90"
            strokeWidth={1.75}
          />
          Các lần thanh toán ({order.attempts.length})
          <span className="sr-only"> của đơn hàng {shortId(order.id)}</span>
        </summary>
        <ul className="grid list-none gap-2 p-0 pb-1">
          {order.attempts.map((attempt) => (
            <li
              key={attempt.id}
              className="grid gap-1 rounded-md border border-border p-2 text-xs"
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <StatusBadge status={attempt.status} />
                <span className="font-mono [overflow-wrap:anywhere]">
                  {attempt.appTransId}
                </span>
              </div>
              <dl className="grid gap-0.5">
                <div className="flex items-baseline gap-1">
                  <dt className="shrink-0 text-muted-foreground">
                    Mã nhà cung cấp:
                  </dt>
                  <dd className="min-w-0 [overflow-wrap:anywhere]">
                    {attempt.providerTransId ?? "—"}
                  </dd>
                </div>
                <div className="flex items-baseline gap-1">
                  <dt className="shrink-0 text-muted-foreground">Số tiền:</dt>
                  <dd className="tabular-nums">
                    {formatPrice(attempt.amountVnd)}
                  </dd>
                </div>
                <div className="flex items-baseline gap-1">
                  <dt className="shrink-0 text-muted-foreground">Tạo lúc:</dt>
                  <dd>
                    <Time value={attempt.createdAt} />
                  </dd>
                </div>
                <div className="flex items-baseline gap-1">
                  <dt className="shrink-0 text-muted-foreground">
                    Thanh toán lúc:
                  </dt>
                  <dd>
                    {attempt.paidAt ? <Time value={attempt.paidAt} /> : "—"}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
