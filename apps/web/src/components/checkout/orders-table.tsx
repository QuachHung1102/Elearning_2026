import Link from "next/link";
import { StatusBadge } from "@/components/ui/badge";
import { formatDateTime, formatPrice } from "@/lib/format";
import { shortId, type PurchaseRow } from "@/lib/orders";

/**
 * The learner's order list: cards under 768px, a table above, like
 * `SessionsTable`. Every row leads to the receipt.
 */
export function OrdersTable({ items }: { items: PurchaseRow[] }) {
  return (
    <div className="grid gap-5">
      <ul className="grid list-none gap-3 p-0 md:hidden">
        {items.map((order) => (
          <li key={order.id}>
            <Link
              href={`/account/orders/${order.id}`}
              className="grid gap-3 rounded-lg border border-border bg-card p-4 hover:border-primary"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold [overflow-wrap:anywhere]">{order.courseTitle}</p>
                <StatusBadge status={order.status} />
              </div>
              <p className="text-sm text-muted-foreground">
                {shortId(order.id)} · {formatDateTime(order.createdAt)}
              </p>
              <p className="font-semibold">{formatPrice(order.priceVnd)}</p>
            </Link>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto rounded-lg border border-border bg-card md:block">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="bg-muted text-muted-foreground-strong">
            <tr>
              <th className="px-4 py-3 font-semibold">Mã đơn</th>
              <th className="px-4 py-3 font-semibold">Khóa học</th>
              <th className="px-4 py-3 text-right font-semibold">Số tiền</th>
              <th className="px-4 py-3 font-semibold">Trạng thái</th>
              <th className="px-4 py-3 font-semibold">Ngày tạo</th>
            </tr>
          </thead>
          <tbody>
            {items.map((order) => (
              <tr key={order.id} className="border-t border-border">
                <td className="px-4 py-3 font-mono text-xs">{shortId(order.id)}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/account/orders/${order.id}`}
                    className="inline-flex min-h-11 items-center font-semibold [overflow-wrap:anywhere] hover:text-primary-text"
                  >
                    {order.courseTitle}
                  </Link>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{formatPrice(order.priceVnd)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={order.status} />
                </td>
                <td className="px-4 py-3 tabular-nums">{formatDateTime(order.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
