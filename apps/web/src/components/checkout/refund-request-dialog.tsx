"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { RequestId } from "@/components/ui/request-id";
import { showToast } from "@/components/ui/toast";
import { ApiError, apiFetch } from "@/lib/api";
import { refundBlockMessage, type RefundBlock } from "@/lib/orders";
import { t } from "@/messages/vi";

const MIN = 10;
const MAX = 500;

/**
 * The learner's refund request (UX_PLAN.md §5.5, API_CONTRACT.md §5.8). The
 * policy is checked by the server; a refusal is explained here in the
 * learner's terms and is final for this dialog, so the form closes to "Đóng".
 */
export function RefundRequestDialog({ purchaseId }: { purchaseId: string }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const inFlight = useRef(false);
  const base = useId();
  const titleId = `${base}-title`;
  const reasonId = `${base}-reason`;
  const [reason, setReason] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ message: string; requestId?: string } | null>(null);

  function open() {
    setReason("");
    setFieldError(null);
    setRefusal(null);
    setFailure(null);
    dialog.current?.showModal();
    requestAnimationFrame(() => dialog.current?.querySelector<HTMLElement>("textarea")?.focus());
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const text = reason.trim();
    if (text.length < MIN || text.length > MAX) {
      setFieldError(`Nhập lý do từ ${MIN} đến ${MAX} ký tự.`);
      requestAnimationFrame(() => document.getElementById(reasonId)?.focus());
      return;
    }
    inFlight.current = true;
    setPending(true);
    setFieldError(null);
    setFailure(null);
    try {
      await apiFetch(`/purchases/${purchaseId}/refund-request`, {
        method: "POST",
        body: JSON.stringify({ reason: text }),
      });
      inFlight.current = false;
      dialog.current?.close();
      showToast("Đã gửi yêu cầu hoàn tiền.", "success");
      router.refresh();
    } catch (caught) {
      const error = caught instanceof ApiError ? caught : null;
      if (error?.code === "UNAUTHENTICATED") {
        // The session-expired toast already says it and redirects.
        inFlight.current = false;
        dialog.current?.close();
        return;
      }
      if (error?.code === "PURCHASE_NOT_REFUNDABLE" && error.details) {
        setRefusal(refundBlockMessage(error.details as unknown as RefundBlock));
        // The submit button is about to go: keep focus inside the dialog.
        requestAnimationFrame(() =>
          dialog.current?.querySelector<HTMLElement>("form button")?.focus(),
        );
      } else {
        setFailure({ message: t(error?.code ?? "INTERNAL"), requestId: error?.requestId });
      }
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <>
      <Button variant="outline" onClick={open}>
        Yêu cầu hoàn tiền
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl border border-border bg-card p-6 text-card-foreground shadow-[var(--shadow-modal)] backdrop:bg-overlay"
        // Escape must not hide a request that is still running.
        onCancel={(event) => {
          if (inFlight.current) event.preventDefault();
        }}
      >
        <form className="grid gap-5" onSubmit={submit} noValidate>
          <div className="grid gap-2">
            <h2 id={titleId} className="text-xl font-semibold">
              Yêu cầu hoàn tiền
            </h2>
            <p className="text-sm text-muted-foreground">
              Bạn có thể yêu cầu hoàn tiền trong 7 ngày kể từ khi thanh toán,
              khi đã học dưới 20% khóa học. Quản trị viên sẽ xem xét; bạn vẫn
              học bình thường cho tới khi yêu cầu được duyệt.
            </p>
          </div>
          {refusal ? (
            <Alert variant="warning" title="Chưa thể hoàn tiền đơn hàng này">
              {refusal}
            </Alert>
          ) : (
            <>
              <Field
                id={reasonId}
                label="Lý do"
                required
                error={fieldError ?? undefined}
                hint={`${reason.trim().length}/${MAX} ký tự`}
              >
                <textarea
                  id={reasonId}
                  name="reason"
                  rows={4}
                  value={reason}
                  maxLength={MAX + 100}
                  aria-invalid={fieldError ? true : undefined}
                  aria-describedby={fieldError ? `${reasonId}-error` : `${reasonId}-hint`}
                  onChange={(event) => setReason(event.target.value)}
                  className="w-full rounded-md border border-input bg-card px-3 py-2 text-base"
                />
              </Field>
              {failure && (
                <div className="grid gap-2">
                  <Alert variant="destructive" title={failure.message} />
                  {failure.requestId && <RequestId id={failure.requestId} />}
                </div>
              )}
            </>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => dialog.current?.close()}
            >
              {refusal ? "Đóng" : "Hủy"}
            </Button>
            {!refusal && (
              <Button type="submit" loading={pending}>
                Gửi yêu cầu
              </Button>
            )}
          </div>
        </form>
      </dialog>
    </>
  );
}
