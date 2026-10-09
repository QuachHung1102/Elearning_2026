/**
 * Orders and checkout (API_CONTRACT.md §4, §5.8). One home for the types and
 * the rules the learner pages and the admin screen share, so "is this QR still
 * good" and "why can't this be refunded" have exactly one answer.
 */

/** Selling is switched on per environment; the flag is read at build time. */
export const CHECKOUT_ENABLED =
  process.env.NEXT_PUBLIC_CHECKOUT_ENABLED === "true";

export type PurchaseStatus =
  | "PENDING"
  | "PAID"
  | "REFUND_REQUESTED"
  | "REFUNDED"
  | "CANCELLED";

export type AttemptStatus =
  | "PENDING"
  | "SUCCEEDED"
  | "FAILED"
  | "EXPIRED"
  | "CANCELLED";

export type PaymentProvider = "DEMO" | "ZALOPAY";

/** `3F2B8C1E`: enough to quote an order to support, the same on every screen. */
export const shortId = (id: string) => id.slice(0, 8).toUpperCase();

/** How a payment method is named to a person. */
export const PROVIDER_LABEL: Record<PaymentProvider, string> = {
  ZALOPAY: "ZaloPay",
  DEMO: "Thử nghiệm (demo)",
};

/** `PurchaseRow`. */
export type PurchaseRow = {
  id: string;
  courseId: string;
  /** The course page and `/checkout/[courseSlug]` are addressed by slug. */
  courseSlug: string;
  courseTitle: string;
  priceVnd: number;
  status: PurchaseStatus;
  createdAt: string;
  paidAt: string | null;
  refundedAt: string | null;
};

/** `CheckoutSession`: one QR of one order. */
export type CheckoutSession = {
  purchaseId: string;
  paymentAttemptId: string;
  /** The order code at the provider; the demo "Thanh toán" button sends it. */
  appTransId: string;
  status: AttemptStatus;
  amountVnd: number;
  provider: PaymentProvider;
  qrCode: string;
  orderUrl: string;
  createdAt: string;
  expiresAt: string;
};

/** `GET /purchases/{id}`: attempts newest first. */
export type PurchaseDetail = PurchaseRow & { attempts: CheckoutSession[] };

/** `AdminAttempt`. */
export type AdminAttempt = {
  id: string;
  appTransId: string;
  providerTransId: string | null;
  provider: PaymentProvider;
  status: AttemptStatus;
  amountVnd: number;
  expiresAt: string;
  paidAt: string | null;
  createdAt: string;
};

/** `AdminPaymentRow`: `GET /admin/payments`. */
export type AdminPaymentRow = PurchaseRow & {
  user: { id: string; email: string; displayName: string };
  attempts: AdminAttempt[];
};

/** What `PaymentStatus` shows (UX_PLAN.md §4.8). */
export type PaymentView = "pending" | "paid" | "failed" | "expired" | "unknown";

export type PaymentViewInput = {
  purchase: PurchaseStatus;
  /** The newest attempt, or `null` when the order has none. */
  attempt: { status: AttemptStatus; expiresAt: string } | null;
  /** Milliseconds since the epoch, from the caller's own clock. */
  now: number;
  /** Consecutive polls that failed. */
  pollFailures: number;
};

/** After this many failed polls in a row the page claims nothing about the payment. */
export const POLL_FAILURES_BEFORE_UNKNOWN = 3;

/**
 * The single place that turns stored state into what the learner is told. It
 * never says "paid" for anything but a stored PAID order, never trusts a
 * redirect, and lets the client's own clock decide a QR has lapsed: the stored
 * status only changes when the reconcile job next runs (API_CONTRACT.md §5.8).
 */
export function paymentView({
  purchase,
  attempt,
  now,
  pollFailures,
}: PaymentViewInput): PaymentView {
  if (pollFailures >= POLL_FAILURES_BEFORE_UNKNOWN) return "unknown";
  if (purchase === "PAID" || purchase === "REFUND_REQUESTED") return "paid";
  // A refunded or cancelled order is over: what the learner needs is a new QR.
  if (purchase !== "PENDING" || !attempt) return "expired";
  switch (attempt.status) {
    case "SUCCEEDED":
      return "paid";
    case "FAILED":
    case "CANCELLED":
      return "failed";
    case "EXPIRED":
      return "expired";
    case "PENDING":
      return Date.parse(attempt.expiresAt) <= now ? "expired" : "pending";
  }
}

/**
 * Whether a QR is still good right now. A server page calls this instead of
 * reading the clock in its render, which the purity lint rule (rightly) flags.
 */
export function qrStillLive(
  attempt: { status: AttemptStatus; expiresAt: string } | undefined,
): boolean {
  return attempt?.status === "PENDING" && Date.parse(attempt.expiresAt) > Date.now();
}

/** Every 3 seconds for the first minute, then every 10 (UX_PLAN.md §5.5). */
export function pollDelay(elapsedMs: number): number {
  return elapsedMs < 60_000 ? 3_000 : 10_000;
}

/** Whole seconds until `expiresAt`, rounded up so the clock never shows 0:00 early. */
export function secondsLeft(expiresAt: string, now: number): number {
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1_000));
}

/** `details.reason` of a `409 PURCHASE_NOT_REFUNDABLE`. */
export type RefundBlockReason =
  | "NOT_PAID"
  | "ALREADY_REQUESTED"
  | "ALREADY_REFUNDED"
  | "NOT_PURCHASED"
  | "FREE_COURSE"
  | "OUTSIDE_WINDOW"
  | "PROGRESS_TOO_HIGH";

export type RefundBlock = {
  reason: RefundBlockReason;
  daysSincePaid: number | null;
  progressPercent: number;
};

/** Why a refund was refused, in words, with the numbers the API sent. */
export function refundBlockMessage(block: RefundBlock): string {
  switch (block.reason) {
    case "NOT_PAID":
      return "Đơn hàng chưa được thanh toán.";
    case "ALREADY_REQUESTED":
      return "Yêu cầu hoàn tiền của đơn hàng này đã được gửi.";
    case "ALREADY_REFUNDED":
      return "Đơn hàng này đã được hoàn tiền.";
    case "NOT_PURCHASED":
      return "Quyền học này không đến từ đơn hàng nên không có gì để hoàn tiền.";
    case "FREE_COURSE":
      return "Khóa học miễn phí không áp dụng hoàn tiền.";
    case "OUTSIDE_WINDOW":
      return `Đơn hàng đã thanh toán ${block.daysSincePaid ?? "hơn 7"} ngày trước, quá thời hạn hoàn tiền 7 ngày.`;
    case "PROGRESS_TOO_HIGH":
      return `Đã học ${block.progressPercent}% khóa học; chính sách chỉ hoàn tiền khi dưới 20%.`;
    default:
      return "Đơn hàng này không thể hoàn tiền.";
  }
}
