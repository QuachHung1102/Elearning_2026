"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  canForceRefund,
  orderErrorMessage,
  refundBlockOf,
  shortId,
  validReason,
} from "@/lib/admin-orders";
import { ApiError, apiFetch } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import type { AdminPaymentRow } from "@/lib/orders";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { RequestId } from "@/components/ui/request-id";
import { showToast } from "@/components/ui/toast";

const MODES = {
  refund: {
    trigger: "Hoàn tiền",
    title: "Hoàn tiền đơn hàng",
    label: "Lý do hoàn tiền",
    submit: "Xác nhận hoàn tiền",
    variant: "destructive",
    path: "refund",
    done: "Đã hoàn tiền đơn hàng và thu hồi quyền học",
  },
  reject: {
    trigger: "Từ chối yêu cầu",
    title: "Từ chối yêu cầu hoàn tiền",
    label: "Lý do từ chối",
    submit: "Từ chối yêu cầu",
    variant: "primary",
    path: "refund-reject",
    done: "Đã từ chối yêu cầu hoàn tiền",
  },
} as const;

const REASON_ERROR = "Nhập lý do từ 3 đến 500 ký tự.";

/** `final`: repeating the request cannot help, so only "Đóng" is left. */
type Failure = { message: string; requestId?: string; final: boolean };

/**
 * The two decisions on an order that need a written reason: refund it
 * (`POST /admin/purchases/{id}/refund`) or turn a learner's request down
 * (`.../refund-reject`). A refund is bookkeeping only; the money moves outside
 * the system.
 *
 * A refund the policy refuses (over seven days, over 20% watched, free course)
 * shows why and offers `force`, which the API accepts for those three rules
 * alone. Any other refusal is a data invariant and ends the dialog.
 */
export function OrderReasonDialog({
  order,
  mode,
}: {
  order: AdminPaymentRow;
  mode: keyof typeof MODES;
}) {
  const router = useRouter();
  const config = MODES[mode];
  const dialog = useRef<HTMLDialogElement>(null);
  const forceInput = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const base = useId();
  const titleId = `${base}-title`;
  const descriptionId = `${base}-description`;
  const reasonId = `${base}-reason`;
  const [formKey, setFormKey] = useState(0);
  const [pending, setPending] = useState(false);
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  // The API said this refusal is the policy's, not the data's: `force` may lift it.
  const [waivable, setWaivable] = useState(false);
  const [force, setForce] = useState(false);

  // The checkbox is new on screen and the reason is what needs a decision.
  useEffect(() => {
    if (waivable) forceInput.current?.focus();
  }, [waivable]);

  // The focused submit button unmounted: its replacement is "Đóng".
  useEffect(() => {
    if (failure?.final) {
      dialog.current?.querySelector<HTMLElement>('button[value="close"]')?.focus();
    }
  }, [failure]);

  function open() {
    setFormKey((key) => key + 1);
    setReasonError(null);
    setFailure(null);
    setWaivable(false);
    setForce(false);
    dialog.current?.showModal();
    // After the re-keyed form mounts: start on its field.
    requestAnimationFrame(() =>
      dialog.current?.querySelector<HTMLElement>("textarea")?.focus(),
    );
  }

  // The row's buttons change with the order, and the pressed one would drop
  // focus to <body> (WCAG 2.4.3): land on the page heading instead.
  function settle() {
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>("main h1")?.focus(),
    );
    router.refresh();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const reason = validReason(
      String(new FormData(event.currentTarget).get("reason") ?? ""),
    );
    if (!reason) {
      setReasonError(REASON_ERROR);
      requestAnimationFrame(() =>
        dialog.current?.querySelector<HTMLElement>("textarea")?.focus(),
      );
      return;
    }

    inFlight.current = true;
    setPending(true);
    setReasonError(null);
    setFailure(null);
    try {
      await apiFetch(`/admin/purchases/${order.id}/${config.path}`, {
        method: "POST",
        body: JSON.stringify(
          mode === "refund" && waivable && force
            ? { reason, force: true }
            : { reason },
        ),
      });
      inFlight.current = false;
      dialog.current?.close();
      showToast(config.done, "success");
      settle();
    } catch (caught) {
      const error = caught instanceof ApiError ? caught : null;
      if (error?.code === "UNAUTHENTICATED") {
        // The session-expired toast already says it and redirects.
        inFlight.current = false;
        dialog.current?.close();
        return;
      }
      const block = mode === "refund" ? refundBlockOf(error) : null;
      const canForce = block !== null && canForceRefund(block.reason);
      if (canForce) setWaivable(true);
      setFailure({
        message: orderErrorMessage(mode, error),
        requestId: error?.requestId,
        final:
          !canForce && (error?.status === 404 || error?.status === 409),
      });
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={open}>
        {config.trigger}
        <span className="sr-only"> đơn hàng {shortId(order.id)}</span>
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="m-auto w-[calc(100%-2rem)] max-w-xl rounded-xl border border-border bg-card p-6 text-card-foreground shadow-[var(--shadow-modal)] backdrop:bg-overlay"
        // Escape must not hide a request that is still running.
        onCancel={(event) => {
          if (inFlight.current) event.preventDefault();
        }}
        // The order changed under the admin (another admin, the reconcile
        // job): show the list as it is now.
        onClose={() => {
          if (failure?.final) settle();
        }}
      >
        <form key={formKey} noValidate className="grid gap-5" onSubmit={submit}>
          <h2 id={titleId} className="text-xl font-semibold">
            {config.title}
          </h2>
          <div
            id={descriptionId}
            className="grid gap-2 text-sm text-muted-foreground"
          >
            <p className="[overflow-wrap:anywhere]">
              Đơn hàng{" "}
              <span className="font-semibold text-card-foreground">
                {shortId(order.id)}
              </span>{" "}
              của {order.user.email}: {order.courseTitle},{" "}
              {formatPrice(order.priceVnd)}.
            </p>
            {mode === "refund" ? (
              <>
                <p>
                  Hệ thống chỉ ghi nhận hoàn tiền và thu hồi quyền học; hãy
                  chuyển tiền cho học viên bên ngoài hệ thống.
                </p>
                <p>Học viên mất quyền học ngay; tiến độ học được giữ lại.</p>
              </>
            ) : (
              <p>
                Đơn hàng trở về trạng thái Đã thanh toán và học viên vẫn giữ
                quyền học.
              </p>
            )}
          </div>

          {failure && (
            <div className="grid gap-2">
              <Alert variant="destructive" title={failure.message} />
              {failure.requestId && <RequestId id={failure.requestId} />}
            </div>
          )}

          {!failure?.final && (
            <>
              <Field
                id={reasonId}
                label={config.label}
                required
                error={reasonError ?? undefined}
                hint="Từ 3 đến 500 ký tự. Lý do được ghi vào nhật ký."
              >
                <textarea
                  id={reasonId}
                  name="reason"
                  maxLength={500}
                  className="control min-h-24"
                  aria-invalid={Boolean(reasonError)}
                  aria-describedby={
                    reasonError ? `${reasonId}-error` : `${reasonId}-hint`
                  }
                  onChange={() => setReasonError(null)}
                />
              </Field>
              {waivable && (
                <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
                  <input
                    ref={forceInput}
                    type="checkbox"
                    checked={force}
                    onChange={(event) => setForce(event.target.checked)}
                    className="size-5 accent-primary-strong"
                  />
                  Bỏ qua chính sách hoàn tiền (force)
                </label>
              )}
            </>
          )}

          <div className="flex flex-wrap justify-end gap-3">
            {failure?.final ? (
              <Button
                type="button"
                value="close"
                onClick={() => dialog.current?.close()}
              >
                Đóng
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => dialog.current?.close()}
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  variant={config.variant}
                  loading={pending}
                >
                  {config.submit}
                </Button>
              </>
            )}
          </div>
        </form>
      </dialog>
    </>
  );
}
