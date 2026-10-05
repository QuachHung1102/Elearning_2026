import { t } from "../messages/vi";
import type { ApiError } from "./api";
import {
  paymentView,
  type CheckoutSession,
  type PaymentView,
  type PurchaseDetail,
} from "./orders";

/** Why the checkout page could not show a QR. */
export type BlockReason = "email" | "unavailable" | "rate-limited" | "error";

type Block = {
  reason: BlockReason;
  message: string;
  retryAfterSeconds?: number;
};

/**
 * What the learner is told when opening the checkout fails. Two outcomes are
 * not blocks and never reach here: `ALREADY_ENROLLED` sends them to the
 * course, and an expired session is handled by the session-expired toast.
 */
export function blockFor(error: ApiError | null): Block {
  if (error?.code === "EMAIL_NOT_VERIFIED") {
    return { reason: "email", message: t(error.code) };
  }
  if (error?.status === 422 || error?.status === 404) {
    return { reason: "unavailable", message: t(error.code) };
  }
  if (error?.status === 429) {
    return {
      reason: "rate-limited",
      message: t("RATE_LIMITED"),
      retryAfterSeconds: error.retryAfterSeconds,
    };
  }
  return { reason: "error", message: t(error?.code ?? "INTERNAL") };
}

export type CheckoutState =
  | { phase: "opening" }
  | {
      phase: "blocked";
      reason: BlockReason;
      message: string;
      retryAfterSeconds?: number;
    }
  | {
      phase: "ready";
      /** The QR this tab opened; a poll may reveal a newer one. */
      session: CheckoutSession;
      /** The stored order as of the last successful poll; `null` before it. */
      detail: PurchaseDetail | null;
      pollFailures: number;
      /** For the poll cadence: 3 s at first, 10 s after a minute. */
      startedAt: number;
    };

export type CheckoutEvent =
  | { type: "opening" }
  | { type: "opened"; session: CheckoutSession; now: number }
  | {
      type: "blocked";
      reason: BlockReason;
      message: string;
      retryAfterSeconds?: number;
    }
  | { type: "polled"; detail: PurchaseDetail }
  | { type: "pollFailed" };

/**
 * The page's whole state machine, free of I/O so its rules are unit tested. A
 * poll or a failure that lands after the page moved on (a new QR was opened, a
 * block appeared) is ignored, not applied to the wrong QR.
 */
export function checkoutReducer(
  state: CheckoutState,
  event: CheckoutEvent,
): CheckoutState {
  switch (event.type) {
    case "opening":
      return { phase: "opening" };
    case "opened":
      return {
        phase: "ready",
        session: event.session,
        detail: null,
        pollFailures: 0,
        startedAt: event.now,
      };
    case "blocked":
      return {
        phase: "blocked",
        reason: event.reason,
        message: event.message,
        retryAfterSeconds: event.retryAfterSeconds,
      };
    case "polled":
      return state.phase === "ready"
        ? { ...state, detail: event.detail, pollFailures: 0 }
        : state;
    case "pollFailed":
      return state.phase === "ready"
        ? { ...state, pollFailures: state.pollFailures + 1 }
        : state;
  }
}

type Ready = Extract<CheckoutState, { phase: "ready" }>;

/** The newest QR the order has: what the panel draws and the clock counts. */
export function currentAttempt(state: Ready): CheckoutSession {
  return state.detail?.attempts[0] ?? state.session;
}

export function viewOf(state: Ready, now: number): PaymentView {
  const attempt = currentAttempt(state);
  return paymentView({
    purchase: state.detail?.status ?? "PENDING",
    attempt: { status: attempt.status, expiresAt: attempt.expiresAt },
    now,
    pollFailures: state.pollFailures,
  });
}
