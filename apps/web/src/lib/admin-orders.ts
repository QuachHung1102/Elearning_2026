/**
 * `/admin/orders` (API_CONTRACT.md §5.8): the rules of the screen that need no
 * React, so they can be tested. Nothing here imports `./admin` on purpose: the
 * row actions are client components and `./admin` reads `next/headers`. The
 * page calls `adminFetch` itself, as its sibling pages do.
 */
import { t } from "../messages/vi";
import { STATUS_LABEL } from "./format";
import {
  refundBlockMessage,
  type AdminAttempt,
  type AdminPaymentRow,
  type AttemptStatus,
  type PurchaseStatus,
  type RefundBlock,
  type RefundBlockReason,
} from "./orders";

type SearchParams = Record<string, string | string[] | undefined>;

/** In the order an order travels; what the status select lists. */
export const ORDER_STATUSES = [
  "PENDING",
  "PAID",
  "REFUND_REQUESTED",
  "REFUNDED",
  "CANCELLED",
] as const satisfies readonly PurchaseStatus[];

export type OrderFilters = {
  status: PurchaseStatus | "";
  /** Only `true` filters, exactly as the API reads it. */
  duplicatePaid: boolean;
};

const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? "";

/**
 * Mirrors the API's rules so a hand-edited URL widens the list instead of
 * drawing a 400 that would read as an outage.
 */
export function orderFilters(params: SearchParams): OrderFilters {
  const status = first(params.status);
  return {
    status: ORDER_STATUSES.find((value) => value === status) ?? "",
    duplicatePaid: first(params.duplicatePaid) === "true",
  };
}

/** `?status=PAID&duplicatePaid=true&page=3`, or `""`. Page 1 is the default and stays off. */
export function ordersApiQuery(filters: OrderFilters, page?: string): string {
  const query = new URLSearchParams();
  if (filters.status) query.set("status", filters.status);
  if (filters.duplicatePaid) query.set("duplicatePaid", "true");
  if (page && page !== "1" && /^[1-9]\d{0,6}$/.test(page)) {
    query.set("page", page);
  }
  const serialised = query.toString();
  return serialised ? `?${serialised}` : "";
}

type WithAttempts = Pick<AdminPaymentRow, "attempts">;

/** The QR the learner was shown last: the API sends attempts newest first. */
export const newestAttempt = ({
  attempts,
}: WithAttempts): AdminAttempt | undefined => attempts[0];

/** Two payments landed on one order: the extra money has to go back (§5.8). */
export const isDuplicatePaid = ({ attempts }: WithAttempts): boolean =>
  attempts.filter(({ status }) => status === "SUCCEEDED").length > 1;

export { shortId } from "./orders";

export type OrderActionSet = {
  /** Demo only: stands in for scanning the QR. */
  confirm: AdminAttempt | null;
  /** Ask the provider again about a QR that has not paid (or has lapsed). */
  reconcile: AdminAttempt | null;
  refund: boolean;
  rejectRefund: boolean;
};

export function orderActions(
  order: Pick<AdminPaymentRow, "status" | "attempts">,
): OrderActionSet {
  const latest = newestAttempt(order);
  const open = latest?.status === "PENDING";
  return {
    confirm: latest && open && latest.provider === "DEMO" ? latest : null,
    reconcile: latest && (open || latest.status === "EXPIRED") ? latest : null,
    refund: order.status === "PAID" || order.status === "REFUND_REQUESTED",
    rejectRefund: order.status === "REFUND_REQUESTED",
  };
}

/** The API trims, then wants 3 to 500 characters; it counts characters, not UTF-16 units. */
export function validReason(text: string): string | null {
  const reason = text.trim();
  const length = [...reason].length;
  return length >= 3 && length <= 500 ? reason : null;
}

/** What `ApiError` carries; structural, so this file does not import `./api`. */
type ErrorLike = {
  status: number;
  code: string;
  details?: Record<string, unknown>;
};

/** The `details` of a `409 PURCHASE_NOT_REFUNDABLE`, or `null` for any other error. */
export function refundBlockOf(error: ErrorLike | null): RefundBlock | null {
  if (error?.status !== 409 || error.code !== "PURCHASE_NOT_REFUNDABLE") {
    return null;
  }
  const { reason, daysSincePaid, progressPercent } = error.details ?? {};
  if (typeof reason !== "string") return null;
  return {
    reason: reason as RefundBlockReason,
    daysSincePaid: typeof daysSincePaid === "number" ? daysSincePaid : null,
    progressPercent: typeof progressPercent === "number" ? progressPercent : 0,
  };
}

const WAIVABLE: readonly string[] = [
  "OUTSIDE_WINDOW",
  "PROGRESS_TOO_HIGH",
  "FREE_COURSE",
];

/**
 * The three policy rules are the owner's to waive with `force`; the other
 * reasons are data invariants that no flag lifts (API_CONTRACT.md §5.8).
 */
export const canForceRefund = (reason: string): boolean =>
  WAIVABLE.includes(reason);

export type OrderAction = "confirm" | "reconcile" | "refund" | "reject";

const NOT_FOUND: Record<OrderAction, string> = {
  confirm: "Không tìm thấy giao dịch",
  reconcile: "Không tìm thấy giao dịch",
  refund: "Không tìm thấy đơn hàng",
  reject: "Không tìm thấy đơn hàng",
};

const EXPIRED: Partial<Record<OrderAction, string>> = {
  confirm: "Mã QR đã hết hạn, học viên cần tạo mã mới",
  reconcile: "Mã QR đã hết hạn và nhà cung cấp chưa nhận được tiền.",
};

/**
 * A plain 409: the row changed under the admin's feet. `apiFetch` drops the
 * API's own `message` (English, and only ever a reason code), so the sentence
 * is written here.
 */
const REFUSED =
  "Giao dịch bị từ chối vì đơn hàng hoặc mã QR không còn hợp lệ. Tải lại trang để xem trạng thái mới nhất.";
const CONFLICT: Partial<Record<OrderAction, string>> = {
  confirm: REFUSED,
  reconcile: REFUSED,
  reject:
    "Đơn hàng này không còn yêu cầu hoàn tiền nào để từ chối. Tải lại trang để xem trạng thái mới nhất.",
};

/** Words for a failed row action, in the words of the button that was pressed. */
export function orderErrorMessage(
  action: OrderAction,
  error: ErrorLike | null,
): string {
  const code = error?.code ?? "INTERNAL";
  if (error?.status === 404) return NOT_FOUND[action];
  if (code === "PAYMENT_EXPIRED") return EXPIRED[action] ?? t(code);
  if (code === "CONFLICT") return CONFLICT[action] ?? t(code);
  const block = refundBlockOf(error);
  return block ? refundBlockMessage(block) : t(code);
}

type Toast = { message: string; variant: "success" | "info" };

/** `POST /dev/payments/{appTransId}/confirm` answers `{ status }`. */
export type ConfirmStatus = "PAID" | "ALREADY_PROCESSED" | "DUPLICATE_PAID";

export function confirmToast(status: ConfirmStatus): Toast {
  switch (status) {
    case "PAID":
      return {
        message: "Đã xác nhận thanh toán, học viên có quyền học",
        variant: "success",
      };
    case "ALREADY_PROCESSED":
      return {
        message: "Đơn hàng đã được xác nhận trước đó",
        variant: "info",
      };
    case "DUPLICATE_PAID":
      return {
        message: "Đây là thanh toán trùng, cần hoàn tiền cho học viên",
        variant: "info",
      };
    default:
      return { message: "Đã xử lý xác nhận thanh toán", variant: "info" };
  }
}

/** `POST /admin/payments/{attemptId}/reconcile` answers `{ status, changed }`. */
export type ReconcileResult = { status: AttemptStatus; changed: boolean };

export function reconcileToast({ status, changed }: ReconcileResult): Toast {
  if (changed) {
    return {
      message: `Đã cập nhật trạng thái giao dịch: ${STATUS_LABEL[status] ?? status}`,
      variant: "success",
    };
  }
  // Someone else reconciled first: the provider did record this payment.
  if (status === "SUCCEEDED") {
    return {
      message: "Giao dịch đã được ghi nhận thanh toán trước đó",
      variant: "info",
    };
  }
  return { message: "Nhà cung cấp chưa ghi nhận thanh toán", variant: "info" };
}
