"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  confirmToast,
  orderActions,
  orderErrorMessage,
  reconcileToast,
  shortId,
  type ConfirmStatus,
  type ReconcileResult,
} from "@/lib/admin-orders";
import { ApiError, apiFetch } from "@/lib/api";
import type { AdminAttempt, AdminPaymentRow } from "@/lib/orders";
import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/toast";
import { OrderReasonDialog } from "./order-reason-dialog";

/**
 * What an admin can do to one order, each action only when it applies
 * (`orderActions`). The two payment actions run in place and answer with a
 * toast; refund and reject open a dialog for their written reason. Mutations
 * are client-side (`apiFetch` adds the CSRF header and handles an expired
 * session), then `router.refresh()` reads the row again.
 */
export function OrderActions({ order }: { order: AdminPaymentRow }) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [busy, setBusy] = useState<"confirm" | "reconcile" | null>(null);
  const { confirm, reconcile, refund, rejectRefund } = orderActions(order);
  const id = shortId(order.id);

  async function run(
    action: "confirm" | "reconcile",
    task: () => Promise<void>,
  ) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(action);
    try {
      await task();
    } catch (caught) {
      const error = caught instanceof ApiError ? caught : null;
      // The session-expired toast already says it and redirects.
      if (error?.code !== "UNAUTHENTICATED") {
        showToast(orderErrorMessage(action, error), "error");
      }
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }

  // The pressed button is gone once its QR settles, which would drop focus to
  // <body> (WCAG 2.4.3): land on the page heading, then read the row again.
  function settle(moveFocus: boolean) {
    if (moveFocus) {
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>("main h1")?.focus(),
      );
    }
    router.refresh();
  }

  const confirmPayment = (attempt: AdminAttempt) =>
    run("confirm", async () => {
      try {
        const { status } = await apiFetch<{ status: ConfirmStatus }>(
          `/dev/payments/${encodeURIComponent(attempt.appTransId)}/confirm`,
          { method: "POST" },
        );
        const toast = confirmToast(status);
        showToast(toast.message, toast.variant);
        settle(true);
      } catch (caught) {
        // `/dev/*` hides an expired session behind the same 404 as `/admin/*`,
        // but `apiFetch` only tells the two apart for `/admin/*`. `/auth/me`
        // does, and its own 401 raises the session-expired toast.
        if (caught instanceof ApiError && caught.status === 404) {
          const expired = await apiFetch("/auth/me").then(
            () => false,
            (error: unknown) => error instanceof ApiError && error.status === 401,
          );
          if (expired) return;
        }
        throw caught;
      }
    });

  const askProvider = (attempt: AdminAttempt) =>
    run("reconcile", async () => {
      const result = await apiFetch<ReconcileResult>(
        `/admin/payments/${attempt.id}/reconcile`,
        { method: "POST" },
      );
      const toast = reconcileToast(result);
      showToast(toast.message, toast.variant);
      settle(result.changed);
    });

  if (!confirm && !reconcile && !refund && !rejectRefund) return null;
  return (
    <div className="flex flex-wrap gap-2 xl:justify-end">
      {confirm && (
        <Button
          variant="outline"
          size="sm"
          loading={busy === "confirm"}
          onClick={() => confirmPayment(confirm)}
        >
          Xác nhận thanh toán
          <span className="sr-only"> đơn hàng {id}</span>
        </Button>
      )}
      {reconcile && (
        <Button
          variant="outline"
          size="sm"
          loading={busy === "reconcile"}
          onClick={() => askProvider(reconcile)}
        >
          Truy vấn lại ZaloPay
          <span className="sr-only"> đơn hàng {id}</span>
        </Button>
      )}
      {refund && <OrderReasonDialog order={order} mode="refund" />}
      {rejectRefund && <OrderReasonDialog order={order} mode="reject" />}
    </div>
  );
}
