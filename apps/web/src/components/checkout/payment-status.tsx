"use client";

import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import type { PaymentView } from "@/lib/orders";

/**
 * What the polling has found, in words (UX_PLAN.md §4.8). The region exists
 * from the first render so a screen reader announces each change; success and
 * failure are announced by `PaymentResult`, which replaces the QR.
 */
export function PaymentStatus({
  view,
  checking,
  onCheck,
}: {
  view: PaymentView;
  checking: boolean;
  onCheck: () => void;
}) {
  return (
    <>
      <div role="status" aria-live="polite" className="grid gap-3">
        {view === "pending" && (
          <p className="flex items-center gap-2 font-semibold">
            <LoaderCircle
              aria-hidden="true"
              className="size-5 animate-spin text-primary-text"
              strokeWidth={1.75}
            />
            Đang chờ thanh toán
          </p>
        )}
        {view === "expired" && (
          <Alert variant="info" title="Mã QR đã hết hạn">
            Nếu bạn đã thanh toán bằng mã này, đơn hàng vẫn được cập nhật khi
            chúng tôi nhận được xác nhận.
          </Alert>
        )}
        {view === "unknown" && (
          <Alert variant="warning" title="Chưa xác nhận được trạng thái">
            Bấm để kiểm tra lại. Chúng tôi không tự cho là đã thanh toán khi chưa
            có xác nhận.
          </Alert>
        )}
        {view !== "paid" && (
          <Button variant="outline" loading={checking} onClick={onCheck}>
            Tôi đã thanh toán, kiểm tra lại
          </Button>
        )}
      </div>
      <div className="grid gap-1">
        <p className="text-sm text-muted-foreground">
          Quyền học được mở sau khi hệ thống xác nhận thanh toán.
        </p>
        <Link
          href="/contact"
          className="inline-flex min-h-11 items-center justify-self-start text-sm text-primary-text hover:underline"
        >
          Cần hỗ trợ? Liên hệ
        </Link>
      </div>
    </>
  );
}
