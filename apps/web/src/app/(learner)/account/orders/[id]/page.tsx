import { UiText } from "@/components/language-provider";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderSummary } from "@/components/checkout/order-summary";
import { RefundRequestDialog } from "@/components/checkout/refund-request-dialog";
import { BackLink } from "@/components/ui/back-link";
import { StatusBadge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { requireAuth } from "@/lib/api";
import { formatDateTime, formatPrice } from "@/lib/format";
import {
  CHECKOUT_ENABLED,
  PROVIDER_LABEL,
  shortId,
  type PurchaseDetail,
} from "@/lib/orders";
import { serverFetch } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Chi tiết đơn hàng" };

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!CHECKOUT_ENABLED) notFound();
  const { id } = await params;
  const response = await serverFetch(`/purchases/${id}`);
  // Not a uuid: the same "no such order" as an order that is not yours.
  if (response.status === 400) notFound();
  await requireAuth(response, `/account/orders/${id}`);
  if (!response.ok)
    throw new Error(`GET /purchases/${id} answered ${response.status}`);
  const order = (await response.json()) as PurchaseDetail;

  const newest = order.attempts[0];
  const checkout = `/checkout/${order.courseSlug}`;

  return (
    <div className="grid gap-8">
      <div className="grid justify-items-start gap-2">
        <BackLink href="/account/orders">
          <UiText value="Lịch sử đơn hàng" />
        </BackLink>
        <h1 tabIndex={-1} className="text-4xl font-bold">
          <UiText value="Đơn hàng" />
          {shortId(order.id)}
        </h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-10">
        <div className="grid content-start gap-6">
          {order.status === "PENDING" && (
            <Panel
              variant="info"
              title="Đơn hàng chưa được xác nhận"
              actions={
                <Link href={checkout} className={buttonClass("primary")}>
                  <UiText
                    value="Liên hệ Nam về đăng ký"
                    en="Contact Nam about enrollment"
                  />
                </Link>
              }
            >
              <UiText
                value="Đăng ký khóa học hiện được trao đổi trực tiếp với Nam. Gửi tên khóa học và mã đơn này để Nam kiểm tra và hướng dẫn bạn."
                en="Course enrollment is now arranged directly with Nam. Share the course name and this order reference so Nam can check and guide you."
              />
            </Panel>
          )}
          {order.status === "PAID" && (
            <Panel
              variant="success"
              title="Bạn đã thanh toán đơn hàng này"
              actions={
                <>
                  <Link
                    href={`/learn/${order.courseSlug}`}
                    className={buttonClass("primary")}
                  >
                    <UiText value="Vào học" />
                  </Link>
                  <RefundRequestDialog purchaseId={order.id} />
                </>
              }
            >
              <UiText value="Khóa học đã sẵn sàng để học. Bạn có thể yêu cầu hoàn tiền trong 7 ngày kể từ khi thanh toán, khi đã học dưới 20% khóa học." />
            </Panel>
          )}
          {order.status === "REFUND_REQUESTED" && (
            <Panel
              variant="warning"
              title="Yêu cầu hoàn tiền đang chờ xử lý"
              actions={
                <Link
                  href={`/learn/${order.courseSlug}`}
                  className={buttonClass("outline")}
                >
                  <UiText value="Vào học" />
                </Link>
              }
            >
              <UiText value="Bạn vẫn học bình thường cho tới khi yêu cầu được duyệt." />
            </Panel>
          )}
          {(order.status === "REFUNDED" || order.status === "CANCELLED") && (
            <Panel
              variant="info"
              title={
                order.status === "REFUNDED"
                  ? "Đơn hàng đã được hoàn tiền"
                  : "Đơn hàng đã bị hủy"
              }
              actions={
                <Link
                  href={`/courses/${order.courseSlug}`}
                  className={buttonClass("outline")}
                >
                  <UiText value="Xem khóa học" />
                </Link>
              }
            >
              {order.status === "REFUNDED"
                ? "Quyền học của đơn hàng này đã được thu hồi. Bạn có thể đăng ký lại bất cứ lúc nào."
                : "Đơn hàng không được thanh toán nên đã bị hủy. Bạn có thể đăng ký lại bất cứ lúc nào."}
            </Panel>
          )}

          <section aria-labelledby="attempts-title" className="grid gap-3">
            <h2 id="attempts-title" className="text-xl font-semibold">
              <UiText value="Lịch sử thanh toán" />
            </h2>
            {order.attempts.length === 0 ? (
              <p className="text-muted-foreground">
                <UiText value="Chưa có lần thanh toán nào." />
              </p>
            ) : (
              <ul className="grid list-none gap-3 p-0">
                {order.attempts.map((attempt) => (
                  <li
                    key={attempt.paymentAttemptId}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4"
                  >
                    <div className="grid gap-1 text-sm">
                      <p className="font-semibold">
                        {formatPrice(attempt.amountVnd)}
                      </p>
                      <p className="text-muted-foreground">
                        <UiText value="Tạo lúc" />
                        {formatDateTime(attempt.createdAt)}
                        {attempt.status === "PENDING" &&
                          ` · hết hạn lúc ${formatDateTime(attempt.expiresAt)}`}
                      </p>
                    </div>
                    <StatusBadge status={attempt.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <OrderSummary
          variant="receipt"
          title={order.courseTitle}
          href={`/courses/${order.courseSlug}`}
          priceVnd={order.priceVnd}
          rows={[
            [
              "Mã đơn",
              <span key="id" className="font-mono text-xs">
                {order.id}
              </span>,
            ],
            ["Trạng thái", <StatusBadge key="status" status={order.status} />],
            ["Tạo lúc", formatDateTime(order.createdAt)],
            ...(order.paidAt
              ? ([["Thanh toán lúc", formatDateTime(order.paidAt)]] as const)
              : []),
            ...(order.refundedAt
              ? ([["Hoàn tiền lúc", formatDateTime(order.refundedAt)]] as const)
              : []),
            ...(newest
              ? ([["Phương thức", PROVIDER_LABEL[newest.provider]]] as const)
              : []),
          ]}
        />
      </div>
    </div>
  );
}

function Panel({
  variant,
  title,
  actions,
  children,
}: {
  variant: "info" | "success" | "warning";
  title: string;
  actions: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-4">
      <Alert variant={variant} title={title}>
        {children}
      </Alert>
      <div className="flex flex-wrap gap-3">{actions}</div>
    </div>
  );
}
