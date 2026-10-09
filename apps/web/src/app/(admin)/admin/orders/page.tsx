import Link from "next/link";
import { notFound, unstable_rethrow } from "next/navigation";
import { AdminListRegion } from "@/components/admin/list-region";
import { OrderActions } from "@/components/admin/order-actions";
import {
  OrderPaymentCell,
  OrderStatusCell,
} from "@/components/admin/order-cells";
import { Pagination } from "@/components/catalog/pagination";
import { buttonClass } from "@/components/ui/button";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { CHECKOUT_ENABLED, adminFetch } from "@/lib/admin";
import {
  ORDER_STATUSES,
  orderFilters,
  ordersApiQuery,
  shortId,
} from "@/lib/admin-orders";
import { firstValue, type Paginated } from "@/lib/catalog";
import {
  formatDateTime,
  formatNumber,
  formatPrice,
  STATUS_LABEL,
} from "@/lib/format";
import type { AdminPaymentRow } from "@/lib/orders";

export const dynamic = "force-dynamic";
export const metadata = { title: "Đơn hàng" };

const BASE = "/admin/orders";
const ERROR_TITLE = "Không tải được danh sách đơn hàng";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Selling is switched on per environment: without it there is no such page.
  if (!CHECKOUT_ENABLED) notFound();

  const params = await searchParams;
  const filters = orderFilters(params);
  const page = firstValue(params.page);
  const header = (
    <header className="grid gap-2">
      <h1 tabIndex={-1} className="text-3xl font-bold">
        Đơn hàng
      </h1>
      <p className="text-muted-foreground">
        Theo dõi thanh toán, đối soát giao dịch và ghi nhận hoàn tiền.
      </p>
    </header>
  );

  let orders: Paginated<AdminPaymentRow>;
  try {
    orders = await adminFetch<Paginated<AdminPaymentRow>>(
      `/admin/payments${ordersApiQuery(filters, page)}`,
    );
  } catch (error) {
    // Redirects and 404s still happen; an outage lets the region keep the
    // rows already on screen (UX_PLAN.md §6.3).
    unstable_rethrow(error);
    console.error(error);
    return <AdminListRegion failed errorTitle={ERROR_TITLE} header={header} />;
  }

  const filtered = filters.status !== "" || filters.duplicatePaid;
  // The confirm button exists for demo QR codes only; say why it is there.
  const demo = orders.items.some(({ attempts }) =>
    attempts.some(({ provider }) => provider === "DEMO"),
  );
  const query = {
    status: filters.status,
    duplicatePaid: filters.duplicatePaid ? "true" : "",
    page,
  };

  // Keyed on the applied filter: React ignores a new `defaultValue` on a
  // mounted <select>, so a client navigation would resubmit the old one.
  const toolbar = (
    <form
      key={`${filters.status}:${filters.duplicatePaid}`}
      method="get"
      action={BASE}
      aria-label="Lọc đơn hàng"
      className="grid gap-3 sm:grid-cols-[minmax(0,16rem)_auto_auto] sm:items-end sm:justify-start"
    >
      <div className="grid min-w-0 gap-1">
        <label className="text-sm font-medium" htmlFor="orders-status">
          Trạng thái
        </label>
        <select
          id="orders-status"
          name="status"
          defaultValue={filters.status}
          className="control"
        >
          <option value="">Tất cả</option>
          {ORDER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABEL[status]}
            </option>
          ))}
        </select>
      </div>
      <label className="flex min-h-12 items-center gap-3 text-sm font-medium">
        <input
          type="checkbox"
          name="duplicatePaid"
          value="true"
          defaultChecked={filters.duplicatePaid}
          className="size-5 accent-primary-strong"
        />
        Thanh toán trùng cần hoàn tiền
      </label>
      <button
        id="orders-submit"
        type="submit"
        className={buttonClass("outline", "lg")}
      >
        Lọc
      </button>
    </form>
  );

  return (
    <AdminListRegion
      failed={false}
      errorTitle={ERROR_TITLE}
      header={header}
      toolbar={toolbar}
      summary={`${formatNumber(orders.total)} đơn hàng`}
    >
      {orders.items.length === 0 ? (
        orders.total > 0 ? (
          // A stale link past the last page: the filter still matches.
          <EmptyState
            title="Trang này không có đơn hàng nào"
            description={`Danh sách chỉ có ${formatNumber(orders.totalPages)} trang.`}
            action={
              <Link
                href={`${BASE}${ordersApiQuery(filters)}`}
                className={buttonClass("outline")}
              >
                Về trang 1
              </Link>
            }
          />
        ) : filtered ? (
          <EmptyState
            title="Không tìm thấy đơn hàng phù hợp"
            description="Thử bỏ bớt bộ lọc."
            action={
              <Link href={BASE} className={buttonClass("outline")}>
                Xóa bộ lọc
              </Link>
            }
          />
        ) : (
          <EmptyState
            title="Chưa có đơn hàng nào"
            description="Đơn hàng xuất hiện khi học viên bắt đầu thanh toán một khóa học."
          />
        )
      ) : (
        <>
          {demo && (
            <Alert
              variant="info"
              title="Đang ở chế độ demo: nút Xác nhận thanh toán thay cho việc quét mã QR."
            />
          )}
          {/* Table from 1280px, cards below: seven columns, all of them
              needed, do not fit beside the 15rem nav any narrower. Rows are
              top-aligned because the payment cell grows when it is opened. */}
          <div className="hidden overflow-clip rounded-lg border border-border bg-card xl:block">
            <table className="w-full text-left text-sm">
              <thead className="text-muted-foreground-strong [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Đơn hàng</th>
                  <th className="px-4 py-3 font-semibold">Học viên</th>
                  <th className="px-4 py-3 font-semibold">Khóa học</th>
                  <th className="px-4 py-3 font-semibold">Số tiền</th>
                  <th className="px-4 py-3 font-semibold">Trạng thái</th>
                  <th className="px-4 py-3 font-semibold">Thanh toán</th>
                  <th className="px-4 py-3 font-semibold">
                    <span className="sr-only">Thao tác</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.items.map((order) => (
                  <tr key={order.id} className="border-t border-border align-top">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono font-medium">
                        {shortId(order.id)}
                      </span>
                      <time
                        dateTime={order.createdAt}
                        className="block text-xs text-muted-foreground tabular-nums"
                      >
                        {formatDateTime(order.createdAt)}
                      </time>
                    </td>
                    <td className="px-4 py-0.5 [overflow-wrap:break-word]">
                      <Link
                        className="inline-flex min-h-11 max-w-3xs items-center font-medium underline-offset-2 hover:underline"
                        href={`/admin/users/${order.user.id}`}
                      >
                        {order.user.displayName}
                      </Link>
                      <span className="block text-muted-foreground [overflow-wrap:break-word]">
                        {order.user.email}
                      </span>
                    </td>
                    <td className="px-4 py-3 [overflow-wrap:break-word]">
                      {order.courseTitle}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                      {formatPrice(order.priceVnd)}
                    </td>
                    <td className="px-4 py-3">
                      <OrderStatusCell order={order} />
                    </td>
                    <td className="px-4 py-3">
                      <OrderPaymentCell order={order} />
                    </td>
                    <td className="px-4 py-0.5">
                      <OrderActions order={order} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="grid list-none gap-3 p-0 xl:hidden">
            {orders.items.map((order) => (
              <li key={order.id} className="panel grid gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="grid min-w-0 gap-0.5">
                    <span className="font-mono text-base font-semibold">
                      {shortId(order.id)}
                    </span>
                    <time
                      dateTime={order.createdAt}
                      className="text-sm text-muted-foreground tabular-nums"
                    >
                      {formatDateTime(order.createdAt)}
                    </time>
                  </div>
                  <OrderStatusCell order={order} />
                </div>
                <dl className="grid gap-1 text-sm">
                  <div className="flex items-baseline gap-1">
                    <dt className="shrink-0 text-muted-foreground">Học viên:</dt>
                    {/* Name over email: inline, the email wrapped under the
                        label at an odd indent. */}
                    <dd className="grid min-w-0 justify-items-start [overflow-wrap:anywhere]">
                      <Link
                        className="inline-flex min-h-11 items-center font-medium underline-offset-2 hover:underline"
                        href={`/admin/users/${order.user.id}`}
                      >
                        {order.user.displayName}
                      </Link>
                      <span className="text-muted-foreground">
                        {order.user.email}
                      </span>
                    </dd>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <dt className="shrink-0 text-muted-foreground">Khóa học:</dt>
                    <dd className="min-w-0 [overflow-wrap:anywhere]">
                      {order.courseTitle}
                    </dd>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <dt className="shrink-0 text-muted-foreground">Số tiền:</dt>
                    <dd className="tabular-nums">{formatPrice(order.priceVnd)}</dd>
                  </div>
                  <div className="grid gap-1">
                    <dt className="text-muted-foreground">Thanh toán:</dt>
                    <dd>
                      <OrderPaymentCell order={order} />
                    </dd>
                  </div>
                </dl>
                <OrderActions order={order} />
              </li>
            ))}
          </ul>
          <Pagination
            basePath={BASE}
            query={query}
            page={orders.page}
            totalPages={orders.totalPages}
            total={orders.total}
            noun="đơn hàng"
          />
        </>
      )}
    </AdminListRegion>
  );
}
