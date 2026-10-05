"use client";

import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { formatTimecode } from "@/lib/format";
import type { CheckoutSession, PaymentView } from "@/lib/orders";

/**
 * The QR and its clock (UX_PLAN.md §4.8). A lapsed code stays on screen,
 * dimmed under a button that opens a new one: the learner may already have
 * paid with it, and the page keeps polling for that. A failed payment is not
 * shown here; `PaymentResult` replaces the panel.
 */
export function QrPanel({
  attempt,
  view,
  secondsLeft,
  onRenew,
}: {
  attempt: CheckoutSession;
  view: PaymentView;
  secondsLeft: number;
  onRenew: () => void;
}) {
  const lapsed = view === "expired";
  return (
    <section
      aria-labelledby="qr-title"
      className="grid justify-items-center gap-4 rounded-xl border border-border bg-card p-6"
    >
      <h2 id="qr-title" className="text-xl font-semibold">
        Quét mã để thanh toán
      </h2>
      <div className="relative rounded-lg bg-white p-3">
        {/* Black on white whatever the theme: a scanner needs the contrast. */}
        <QRCodeSVG
          value={attempt.qrCode}
          size={240}
          level="M"
          marginSize={0}
          bgColor="#ffffff"
          fgColor="#000000"
          role="img"
          aria-label="Mã QR thanh toán"
          className={lapsed ? "opacity-20" : undefined}
        />
        {lapsed && (
          <div className="absolute inset-0 grid place-content-center justify-items-center gap-3 p-4 text-center">
            <p className="font-semibold text-black">Mã QR đã hết hạn</p>
            <Button onClick={onRenew}>Tạo mã QR mới</Button>
          </div>
        )}
      </div>
      {view === "pending" && (
        <p role="timer" aria-live="off" className="text-sm text-muted-foreground">
          Mã hết hạn sau{" "}
          <strong className="text-base text-card-foreground tabular-nums">
            {formatTimecode(secondsLeft)}
          </strong>
        </p>
      )}
      <p className="max-w-xs text-center text-sm text-muted-foreground">
        {attempt.provider === "ZALOPAY"
          ? "Mở ứng dụng ZaloPay, chọn Quét mã và quét mã QR này."
          : "Đây là mã QR thử nghiệm, không quét được."}
      </p>
    </section>
  );
}
