import { CircleAlert, CircleCheck } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClass } from "@/components/ui/button";

/** The end of a checkout (UX_PLAN.md §4.8): a tick and the next step, or a failure and a retry. */
export function PaymentResult({
  kind,
  courseSlug,
  purchaseId,
  retry,
}: {
  kind: "success" | "failed";
  courseSlug: string;
  purchaseId: string;
  /** The retry button of a failed result: it belongs to the client island. */
  retry?: ReactNode;
}) {
  const success = kind === "success";
  const Icon = success ? CircleCheck : CircleAlert;
  return (
    <section
      role="status"
      aria-labelledby="payment-result-title"
      className="grid justify-items-center gap-4 rounded-xl border border-border bg-card p-8 text-center"
    >
      <Icon
        aria-hidden="true"
        className={`size-14 ${success ? "text-success" : "text-destructive"}`}
        strokeWidth={1.5}
      />
      <div className="grid gap-1">
        <h2 id="payment-result-title" tabIndex={-1} className="text-2xl font-bold">
          {success ? "Thanh toán thành công" : "Thanh toán không thành công"}
        </h2>
        <p className="text-muted-foreground">
          {success
            ? "Bạn đã có quyền học khóa này."
            : "Giao dịch chưa hoàn tất. Bạn có thể thử lại bằng một mã QR mới."}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        {success ? (
          <>
            <Link
              href={`/learn/${courseSlug}`}
              className={buttonClass("primary", "lg")}
            >
              Vào học ngay
            </Link>
            <Link
              href={`/account/orders/${purchaseId}`}
              className={buttonClass("outline", "lg")}
            >
              Xem đơn hàng
            </Link>
          </>
        ) : (
          retry
        )}
      </div>
    </section>
  );
}
