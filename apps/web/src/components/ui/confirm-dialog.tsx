"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ApiError } from "@/lib/api";
import { t } from "@/messages/vi";
import { Button } from "./button";
import { Alert } from "./feedback";
import { RequestId } from "./request-id";

type Failure = { message: string; retryable: boolean; requestId?: string };

/**
 * `onConfirm` either handles its own errors or throws. A throw keeps the
 * dialog open with the §2.5b message in an `Alert`. A refusal (4xx) leaves
 * only "Đóng": repeating the same request is pointless. An outage, a network
 * failure or a 429 keeps the confirm button so the same click retries — a 429
 * locks it with a countdown first (UX_PLAN.md §6.3).
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  trigger,
  onConfirm,
  busy,
  variant = "destructive",
}: {
  title: string;
  description: string;
  confirmLabel: string;
  trigger: ReactNode;
  onConfirm: () => void | Promise<void>;
  busy?: boolean;
  variant?: "destructive" | "primary";
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  // A ref, not state: `close` fires as a task, after the render cycle.
  const inFlight = useRef(false);
  const titleId = useId();
  const descriptionId = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Failure | null>(null);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const working = busy || pending;

  useEffect(() => {
    if (waitSeconds <= 0) return;
    const timer = window.setTimeout(() => setWaitSeconds(waitSeconds - 1), 1_000);
    return () => window.clearTimeout(timer);
  }, [waitSeconds]);

  return (
    <>
      <span onClick={() => dialog.current?.showModal()}>{trigger}</span>
      <dialog
        ref={dialog}
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-xl border border-border bg-card p-6 text-card-foreground shadow-[var(--shadow-modal)] backdrop:bg-overlay"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        // Escape must not hide a request that is still running: the action
        // would still happen, and a failure would have nowhere to show.
        onCancel={(event) => {
          if (working) event.preventDefault();
        }}
        // A second Escape (or a back gesture) closes anyway once the page's
        // user activation is spent, so reopen until the request settles.
        // Otherwise clear the failure now, not on the next open: `showModal`
        // would focus its stale "Sao chép" button just before it unmounts.
        onClose={() => {
          if (inFlight.current) dialog.current?.showModal();
          else setError(null);
        }}
      >
        <form method="dialog" className="grid gap-5">
          <div className="grid gap-2">
            <h2
              id={titleId}
              className="text-xl font-semibold [overflow-wrap:anywhere]"
            >
              {title}
            </h2>
            <p id={descriptionId} className="text-sm text-muted-foreground">
              {description}
            </p>
          </div>
          {error && (
            <div className="grid gap-2">
              <Alert variant="destructive" title={error.message} />
              {error.requestId && <RequestId id={error.requestId} />}
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="ghost" value="cancel" disabled={working}>
              {error && !error.retryable ? "Đóng" : "Hủy"}
            </Button>
            {(!error || error.retryable) && (
              <Button
                variant={variant}
                loading={working}
                disabled={waitSeconds > 0}
                onClick={async (event) => {
                  event.preventDefault();
                  setPending(true);
                  inFlight.current = true;
                  try {
                    await onConfirm();
                    inFlight.current = false;
                    dialog.current?.close();
                  } catch (caught) {
                    inFlight.current = false;
                    const apiError = caught instanceof ApiError ? caught : null;
                    if (apiError?.code === "UNAUTHENTICATED") {
                      // The session-expired toast already says it and
                      // redirects; a second copy in here would talk over it.
                      dialog.current?.close();
                      return;
                    }
                    const status = apiError?.status ?? 500;
                    const limited = status === 429;
                    const retryable = limited || status === 0 || status >= 500;
                    setError({
                      message: t(apiError?.code ?? "INTERNAL"),
                      retryable,
                      requestId: apiError?.requestId,
                    });
                    if (limited) {
                      setWaitSeconds(apiError?.retryAfterSeconds ?? 60);
                    }
                    // The focused confirm button is about to unmount or turn
                    // disabled, which would drop focus to <body>: go to
                    // "Đóng"/"Hủy" instead. A plain retry keeps focus on it.
                    if (!retryable || limited) {
                      requestAnimationFrame(() =>
                        dialog.current
                          ?.querySelector<HTMLElement>('button[value="cancel"]')
                          ?.focus(),
                      );
                    }
                  } finally {
                    setPending(false);
                  }
                }}
              >
                {waitSeconds > 0
                  ? `Thử lại sau ${waitSeconds} giây`
                  : confirmLabel}
              </Button>
            )}
          </div>
        </form>
      </dialog>
    </>
  );
}
