"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { ResendVerificationButton } from "@/components/auth-forms";
import { Button, buttonClass } from "@/components/ui/button";
import { Alert, Skeleton } from "@/components/ui/feedback";
import { showToast } from "@/components/ui/toast";
import { ApiError, apiFetch } from "@/lib/api";
import {
  blockFor,
  checkoutReducer,
  currentAttempt,
  viewOf,
  type CheckoutState,
} from "@/lib/checkout-state";
import {
  pollDelay,
  secondsLeft,
  type CheckoutSession,
  type PurchaseDetail,
} from "@/lib/orders";
import { t } from "@/messages/vi";
import { OrderSummary } from "./order-summary";
import { PaymentResult } from "./payment-result";
import { PaymentStatus } from "./payment-status";
import { QrPanel } from "./qr-panel";

const OPENING: CheckoutState = { phase: "opening" };

/**
 * The checkout page's island (UX_PLAN.md §5.5). It opens the checkout once,
 * polls the stored order until it is paid, and never concludes "paid" from
 * anything but that order. The clock and the polling are the only effects; the
 * rules live in `lib/checkout-state.ts` and `lib/orders.ts`, where they are
 * tested.
 */
export function CheckoutPanel({
  slug,
  courseTitle,
}: {
  slug: string;
  courseTitle: string;
}) {
  const router = useRouter();
  const [state, dispatch] = useReducer(checkoutReducer, OPENING);
  const [now, setNow] = useState(() => Date.now());
  const [checking, setChecking] = useState(false);
  const started = useRef(false);

  // Opening a QR is rate limited (5 per 5 minutes), so this must run once per
  // visit, not once per effect run: StrictMode replays effects in development.
  const open = useCallback(async () => {
    dispatch({ type: "opening" });
    try {
      const session = await apiFetch<CheckoutSession>(`/checkout/${slug}`, {
        method: "POST",
      });
      const at = Date.now();
      setNow(at);
      dispatch({ type: "opened", session, now: at });
    } catch (caught) {
      const error = caught instanceof ApiError ? caught : null;
      if (error?.code === "ALREADY_ENROLLED") {
        showToast(t("ALREADY_ENROLLED"), "info");
        router.replace(`/learn/${slug}`);
        return;
      }
      // The session-expired toast already says it and redirects.
      if (error?.code === "UNAUTHENTICATED") return;
      dispatch({ type: "blocked", ...blockFor(error) });
    }
  }, [slug, router]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void open();
  }, [open]);

  const ready = state.phase === "ready" ? state : null;
  const view = ready ? viewOf(ready, now) : null;
  const purchaseId = ready?.session.purchaseId;
  const startedAt = ready?.startedAt;
  const paid = view === "paid";

  // The clock ticks only while a live QR is being counted down.
  useEffect(() => {
    if (view !== "pending") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [view]);

  // Poll the stored order. It keeps going after the QR lapses (a payment made
  // just before may still arrive) and stops only once the order is paid.
  useEffect(() => {
    if (!purchaseId || startedAt === undefined || paid) return;
    let cancelled = false;
    let timer: number | undefined;
    const tick = async () => {
      try {
        const detail = await apiFetch<PurchaseDetail>(`/purchases/${purchaseId}`);
        if (!cancelled) dispatch({ type: "polled", detail });
      } catch {
        if (!cancelled) dispatch({ type: "pollFailed" });
      }
      if (!cancelled) {
        timer = window.setTimeout(tick, pollDelay(Date.now() - startedAt));
      }
    };
    timer = window.setTimeout(tick, pollDelay(0));
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [purchaseId, startedAt, paid]);

  async function checkNow() {
    if (!purchaseId) return;
    setChecking(true);
    try {
      const detail = await apiFetch<PurchaseDetail>(`/purchases/${purchaseId}`);
      setNow(Date.now());
      dispatch({ type: "polled", detail });
    } catch {
      dispatch({ type: "pollFailed" });
    } finally {
      setChecking(false);
    }
  }

  if (state.phase === "blocked") {
    return (
      <Blocked
        reason={state.reason}
        message={state.message}
        retryAfterSeconds={state.retryAfterSeconds}
        slug={slug}
        onRetry={open}
      />
    );
  }

  const attempt = ready ? currentAttempt(ready) : null;
  // Opening a new QR swaps the whole panel for the skeleton, which is the
  // loading state; no button needs a spinner of its own.
  const renew = (
    <Button size="lg" onClick={() => void open()}>
      Thử lại
    </Button>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-10">
      <div className="grid content-start gap-6">
        {attempt?.provider === "DEMO" && view !== "paid" && (
          <Alert variant="info" title="Chế độ demo">
            <p>Không trừ tiền thật. Bấm “Thanh toán” thay cho việc quét mã.</p>
            {view === "pending" && (
              <DemoPay
                appTransId={attempt.appTransId}
                onPaid={checkNow}
              />
            )}
          </Alert>
        )}
        {!ready || !attempt || !view ? (
          <QrSkeleton />
        ) : view === "paid" ? (
          <PaymentResult
            kind="success"
            courseSlug={slug}
            purchaseId={ready.session.purchaseId}
          />
        ) : view === "failed" ? (
          <PaymentResult
            kind="failed"
            courseSlug={slug}
            purchaseId={ready.session.purchaseId}
            retry={renew}
          />
        ) : (
          <QrPanel
            attempt={attempt}
            view={view}
            secondsLeft={secondsLeft(attempt.expiresAt, now)}
            onRenew={() => void open()}
          />
        )}
      </div>
      <div className="grid content-start gap-6">
        <OrderSummary
          variant="checkout"
          title={courseTitle}
          href={`/courses/${slug}`}
          priceVnd={attempt?.amountVnd ?? null}
        />
        {view && view !== "paid" && view !== "failed" && (
          <PaymentStatus view={view} checking={checking} onCheck={checkNow} />
        )}
      </div>
    </div>
  );
}

/**
 * Demo only: stands in for scanning the QR. The API runs the same signed
 * confirmation a real payment does; the panel then shows "paid" only once the
 * stored order says so, read right away instead of on the next poll.
 */
function DemoPay({
  appTransId,
  onPaid,
}: {
  appTransId: string;
  onPaid: () => Promise<void>;
}) {
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setPaying(true);
    setError(null);
    try {
      await apiFetch(
        `/dev/payments/${encodeURIComponent(appTransId)}/confirm`,
        { method: "POST" },
      );
      await onPaid();
    } catch (caught) {
      const code = caught instanceof ApiError ? caught.code : "INTERNAL";
      // The session-expired toast already says it and redirects.
      if (code !== "UNAUTHENTICATED") setError(t(code));
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="mt-3 grid justify-items-start gap-2">
      <Button size="lg" loading={paying} onClick={() => void pay()}>
        {error ? "Thử thanh toán lại" : "Thanh toán"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function QrSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Đang tạo mã QR"
      className="grid justify-items-center gap-4 rounded-xl border border-border bg-card p-6"
    >
      <Skeleton className="h-7 w-48" />
      <Skeleton className="size-[264px]" />
      <Skeleton className="h-5 w-40" />
    </section>
  );
}

function Blocked({
  reason,
  message,
  retryAfterSeconds,
  slug,
  onRetry,
}: {
  reason: "email" | "unavailable" | "rate-limited" | "error";
  message: string;
  retryAfterSeconds?: number;
  slug: string;
  onRetry: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const again = (label: string) => (
    <Button
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await onRetry();
        } finally {
          setBusy(false);
        }
      }}
    >
      {label}
    </Button>
  );

  return (
    <div className="mx-auto grid w-full max-w-xl gap-4">
      {reason === "email" && (
        <>
          <Alert variant="warning" title={message}>
            Chúng tôi cần biết email của bạn là thật trước khi nhận thanh toán.
          </Alert>
          <ResendVerificationButton />
          <div>{again("Tôi đã xác minh, thử lại")}</div>
        </>
      )}
      {reason === "unavailable" && (
        <>
          <Alert variant="warning" title="Khóa học này hiện không nhận đăng ký">
            Tải lại trang khóa học để xem trạng thái mới nhất.
          </Alert>
          <div>
            <Link href={`/courses/${slug}`} className={buttonClass("outline")}>
              Về trang khóa học
            </Link>
          </div>
        </>
      )}
      {reason === "rate-limited" && (
        <>
          <Alert variant="warning" title={message}>
            {retryAfterSeconds
              ? `Thử lại sau khoảng ${retryAfterSeconds} giây.`
              : "Thử lại sau ít phút."}
          </Alert>
          <div>{again("Thử lại")}</div>
        </>
      )}
      {reason === "error" && (
        <>
          <Alert variant="destructive" title="Không tạo được mã QR">
            {message} Thử lại sau ít phút hoặc liên hệ hỗ trợ.
          </Alert>
          <div>{again("Tạo lại mã QR")}</div>
        </>
      )}
    </div>
  );
}
