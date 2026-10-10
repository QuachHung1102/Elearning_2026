import { describe, expect, it } from "vitest";
import {
  ORDER_STATUSES,
  canForceRefund,
  confirmToast,
  isDuplicatePaid,
  newestAttempt,
  orderActions,
  orderErrorMessage,
  orderFilters,
  ordersApiQuery,
  reconcileToast,
  refundBlockOf,
  validReason,
} from "./admin-orders";
import type { AdminAttempt, AdminPaymentRow } from "./orders";

const attempt = (over: Partial<AdminAttempt> = {}): AdminAttempt => ({
  id: "6f1d1c0e-3b1a-4c55-9d0e-0a1b2c3d4e5f",
  appTransId: "260930_a1b2c3d4",
  providerTransId: null,
  provider: "DEMO",
  status: "PENDING",
  amountVnd: 499_000,
  expiresAt: "2026-09-30T10:15:00.000Z",
  paidAt: null,
  createdAt: "2026-09-30T10:00:00.000Z",
  ...over,
});

/** The API sends attempts newest first, so the first argument is the newest. */
const order = (
  status: AdminPaymentRow["status"],
  ...attempts: AdminAttempt[]
) => ({ status, attempts });

describe("orderFilters", () => {
  it("shows every order when the URL says nothing", () => {
    expect(orderFilters({})).toEqual({ status: "", duplicatePaid: false });
  });

  it("keeps a status and the duplicate toggle the API accepts", () => {
    expect(orderFilters({ status: "REFUND_REQUESTED", duplicatePaid: "true" })).toEqual({
      status: "REFUND_REQUESTED",
      duplicatePaid: true,
    });
    for (const status of ORDER_STATUSES) {
      expect(orderFilters({ status }).status).toBe(status);
    }
  });

  it("drops anything the API would answer with a 400, widening the list instead", () => {
    expect(orderFilters({ status: "paid" }).status).toBe("");
    expect(orderFilters({ status: "SHIPPED" }).status).toBe("");
    expect(orderFilters({ status: "PAID,PENDING" }).status).toBe("");
    // Inherited keys are not part of the vocabulary.
    expect(orderFilters({ status: "toString" }).status).toBe("");
  });

  it("reads the first value of a repeated key", () => {
    expect(orderFilters({ status: ["PAID", "PENDING"] }).status).toBe("PAID");
    expect(orderFilters({ duplicatePaid: ["true", "false"] }).duplicatePaid).toBe(true);
  });

  it("filters duplicates only for the exact word `true`", () => {
    for (const value of ["false", "1", "on", "TRUE", ""]) {
      expect(orderFilters({ duplicatePaid: value }).duplicatePaid).toBe(false);
    }
  });
});

describe("ordersApiQuery", () => {
  const none = { status: "", duplicatePaid: false } as const;

  it("is empty when nothing is filtered", () => {
    expect(ordersApiQuery(none)).toBe("");
    expect(ordersApiQuery(none, "1")).toBe("");
  });

  it("carries the status, the duplicate toggle and the page", () => {
    expect(ordersApiQuery({ status: "PAID", duplicatePaid: true }, "3")).toBe(
      "?status=PAID&duplicatePaid=true&page=3",
    );
    expect(ordersApiQuery({ ...none, duplicatePaid: true })).toBe("?duplicatePaid=true");
    expect(ordersApiQuery(none, "2")).toBe("?page=2");
  });

  it("never sends a page it cannot vouch for", () => {
    for (const page of ["0", "-2", "2.5", "1e3", "abc", "007", "", " 2", "12345678"]) {
      expect(ordersApiQuery(none, page)).toBe("");
    }
    expect(ordersApiQuery(none, undefined)).toBe("");
  });
});

describe("newestAttempt", () => {
  it("is the first attempt, the API's newest", () => {
    const newer = attempt({ id: "newer" });
    expect(newestAttempt(order("PENDING", newer, attempt({ id: "older" })))).toBe(newer);
  });

  it("is undefined for an order with no attempt", () => {
    expect(newestAttempt(order("PENDING"))).toBeUndefined();
  });
});

describe("isDuplicatePaid", () => {
  it("flags an order with two or more SUCCEEDED attempts", () => {
    expect(
      isDuplicatePaid(order("PAID", attempt({ status: "SUCCEEDED" }), attempt({ status: "SUCCEEDED" }))),
    ).toBe(true);
    expect(
      isDuplicatePaid(
        order(
          "PAID",
          attempt({ status: "SUCCEEDED" }),
          attempt({ status: "EXPIRED" }),
          attempt({ status: "SUCCEEDED" }),
        ),
      ),
    ).toBe(true);
  });

  it("does not flag one payment, however many QR codes were opened", () => {
    expect(isDuplicatePaid(order("PAID", attempt({ status: "SUCCEEDED" })))).toBe(false);
    expect(
      isDuplicatePaid(
        order("PAID", attempt({ status: "SUCCEEDED" }), attempt({ status: "EXPIRED" }), attempt({ status: "FAILED" })),
      ),
    ).toBe(false);
    expect(isDuplicatePaid(order("PENDING", attempt({ status: "PENDING" }), attempt({ status: "FAILED" })))).toBe(false);
    expect(isDuplicatePaid(order("PENDING"))).toBe(false);
  });
});

describe("orderActions", () => {
  it("offers the demo confirm only on a PENDING demo QR, and asks the provider about it too", () => {
    const qr = attempt({ status: "PENDING", provider: "DEMO" });
    expect(orderActions(order("PENDING", qr))).toEqual({
      confirm: qr,
      reconcile: qr,
      refund: false,
      rejectRefund: false,
    });
  });

  it("never offers the demo confirm for a real provider", () => {
    const qr = attempt({ status: "PENDING", provider: "ZALOPAY" });
    expect(orderActions(order("PENDING", qr))).toMatchObject({ confirm: null, reconcile: qr });
  });

  it("lets an expired QR be asked about again (a late payment) but not confirmed", () => {
    const qr = attempt({ status: "EXPIRED" });
    expect(orderActions(order("PENDING", qr))).toMatchObject({ confirm: null, reconcile: qr });
  });

  it("offers nothing on a QR that is settled either way", () => {
    for (const status of ["SUCCEEDED", "FAILED", "CANCELLED"] as const) {
      expect(orderActions(order("PENDING", attempt({ status })))).toMatchObject({
        confirm: null,
        reconcile: null,
      });
    }
  });

  it("looks at the newest attempt only", () => {
    const actions = orderActions(
      order("PAID", attempt({ id: "new", status: "SUCCEEDED" }), attempt({ id: "old", status: "PENDING" })),
    );
    expect(actions).toMatchObject({ confirm: null, reconcile: null });
  });

  it("has no payment action for an order without attempts", () => {
    expect(orderActions(order("PENDING"))).toEqual({
      confirm: null,
      reconcile: null,
      refund: false,
      rejectRefund: false,
    });
  });

  it("offers a refund for PAID and REFUND_REQUESTED, a rejection for the latter only", () => {
    const paid = attempt({ status: "SUCCEEDED" });
    expect(orderActions(order("PAID", paid))).toMatchObject({ refund: true, rejectRefund: false });
    expect(orderActions(order("REFUND_REQUESTED", paid))).toMatchObject({
      refund: true,
      rejectRefund: true,
    });
    for (const status of ["PENDING", "REFUNDED", "CANCELLED"] as const) {
      expect(orderActions(order(status, paid))).toMatchObject({ refund: false, rejectRefund: false });
    }
  });
});

describe("validReason", () => {
  it("trims, then wants 3 to 500 characters, like the API's @trim @Length(3, 500)", () => {
    expect(validReason("  abc  ")).toBe("abc");
    expect(validReason("  ab  ")).toBeNull();
    expect(validReason("   ")).toBeNull();
    expect(validReason("")).toBeNull();
    expect(validReason("a".repeat(500))).toBe("a".repeat(500));
    expect(validReason("a".repeat(501))).toBeNull();
  });

  it("counts characters the way the API does, not UTF-16 units", () => {
    // Two emoji are four UTF-16 units but two characters: the API refuses them.
    expect(validReason("😀😀")).toBeNull();
    expect(validReason("😀😀😀")).toBe("😀😀😀");
    expect(validReason("Hoàn tiền vì khóa học bị lỗi")).toBe("Hoàn tiền vì khóa học bị lỗi");
  });
});

describe("refundBlockOf", () => {
  const refused = (details?: Record<string, unknown>) => ({
    status: 409,
    code: "PURCHASE_NOT_REFUNDABLE",
    details,
  });

  it("reads the block out of the 409's details", () => {
    expect(
      refundBlockOf(
        refused({ reason: "OUTSIDE_WINDOW", paidAt: "2026-08-01T00:00:00.000Z", daysSincePaid: 60, progressPercent: 10 }),
      ),
    ).toEqual({ reason: "OUTSIDE_WINDOW", daysSincePaid: 60, progressPercent: 10 });
    expect(refundBlockOf(refused({ reason: "NOT_PAID", daysSincePaid: null, progressPercent: 0 }))).toEqual({
      reason: "NOT_PAID",
      daysSincePaid: null,
      progressPercent: 0,
    });
  });

  it("tolerates missing numbers", () => {
    expect(refundBlockOf(refused({ reason: "FREE_COURSE" }))).toEqual({
      reason: "FREE_COURSE",
      daysSincePaid: null,
      progressPercent: 0,
    });
  });

  it("is null when there is nothing to read", () => {
    expect(refundBlockOf(null)).toBeNull();
    expect(refundBlockOf(refused())).toBeNull();
    expect(refundBlockOf(refused({ reason: 3 }))).toBeNull();
    expect(refundBlockOf({ status: 409, code: "CONFLICT", details: { reason: "NOT_PAID" } })).toBeNull();
    expect(refundBlockOf({ status: 500, code: "INTERNAL" })).toBeNull();
  });
});

describe("canForceRefund", () => {
  it("lets an admin waive the three policy rules", () => {
    for (const reason of ["OUTSIDE_WINDOW", "PROGRESS_TOO_HIGH", "FREE_COURSE"]) {
      expect(canForceRefund(reason)).toBe(true);
    }
  });

  it("never offers force for a data invariant, or for a reason it does not know", () => {
    for (const reason of ["NOT_PAID", "ALREADY_REQUESTED", "ALREADY_REFUNDED", "NOT_PURCHASED", "SOMETHING_NEW"]) {
      expect(canForceRefund(reason)).toBe(false);
    }
  });
});

describe("orderErrorMessage", () => {
  const error = (status: number, code: string, details?: Record<string, unknown>) => ({
    status,
    code,
    details,
  });

  it("explains an expired QR differently for the demo button and for the reconcile button", () => {
    expect(orderErrorMessage("confirm", error(409, "PAYMENT_EXPIRED"))).toBe(
      "Mã QR đã hết hạn, học viên cần tạo mã mới",
    );
    expect(orderErrorMessage("reconcile", error(409, "PAYMENT_EXPIRED"))).toBe(
      "Mã QR đã hết hạn và nhà cung cấp chưa nhận được tiền.",
    );
  });

  it("says which thing was not found", () => {
    expect(orderErrorMessage("confirm", error(404, "NOT_FOUND"))).toBe("Không tìm thấy giao dịch");
    expect(orderErrorMessage("reconcile", error(404, "NOT_FOUND"))).toBe("Không tìm thấy giao dịch");
    expect(orderErrorMessage("refund", error(404, "NOT_FOUND"))).toBe("Không tìm thấy đơn hàng");
    expect(orderErrorMessage("reject", error(404, "NOT_FOUND"))).toBe("Không tìm thấy đơn hàng");
  });

  it("gives a refused payment and a stale rejection a sentence of their own, not the generic outage one", () => {
    const generic = orderErrorMessage("confirm", null);
    for (const action of ["confirm", "reconcile", "reject"] as const) {
      const message = orderErrorMessage(action, error(409, "CONFLICT"));
      expect(message).toMatch(/Tải lại trang/);
      expect(message).not.toBe(generic);
    }
    expect(orderErrorMessage("reject", error(409, "CONFLICT"))).toMatch(/yêu cầu hoàn tiền/);
  });

  it("words a refused refund with the numbers the API sent", () => {
    expect(
      orderErrorMessage(
        "refund",
        error(409, "PURCHASE_NOT_REFUNDABLE", { reason: "OUTSIDE_WINDOW", daysSincePaid: 31, progressPercent: 0 }),
      ),
    ).toBe("Đơn hàng đã thanh toán 31 ngày trước, quá thời hạn hoàn tiền 7 ngày.");
    expect(
      orderErrorMessage(
        "refund",
        error(409, "PURCHASE_NOT_REFUNDABLE", { reason: "PROGRESS_TOO_HIGH", daysSincePaid: 2, progressPercent: 35 }),
      ),
    ).toBe("Đã học 35% khóa học; chính sách chỉ hoàn tiền khi dưới 20%.");
    expect(orderErrorMessage("refund", error(409, "PURCHASE_NOT_REFUNDABLE"))).toBe(
      "Đơn này ngoài chính sách hoàn tiền.",
    );
  });

  it("falls back to the shared messages for everything else", () => {
    expect(orderErrorMessage("refund", error(0, "NETWORK_ERROR"))).toBe(
      "Không thể kết nối máy chủ. Vui lòng thử lại.",
    );
    expect(orderErrorMessage("confirm", error(429, "RATE_LIMITED"))).toBe(
      "Bạn đã thử quá nhiều lần. Vui lòng đợi rồi thử lại.",
    );
    expect(orderErrorMessage("reject", error(400, "VALIDATION_FAILED"))).toBe("Thông tin chưa hợp lệ.");
    expect(orderErrorMessage("reconcile", null)).toBe("Đã có lỗi từ hệ thống. Vui lòng thử lại.");
    expect(orderErrorMessage("confirm", error(500, "SOMETHING_NEW"))).toBe(
      "Đã có lỗi từ hệ thống. Vui lòng thử lại.",
    );
  });
});

describe("confirmToast", () => {
  it("tells each outcome of the demo confirm apart", () => {
    expect(confirmToast("PAID")).toEqual({
      message: "Đã xác nhận thanh toán, học viên có quyền học",
      variant: "success",
    });
    expect(confirmToast("ALREADY_PROCESSED")).toEqual({
      message: "Đơn hàng đã được xác nhận trước đó",
      variant: "info",
    });
    expect(confirmToast("DUPLICATE_PAID")).toEqual({
      message: "Đây là thanh toán trùng, cần hoàn tiền cho học viên",
      variant: "info",
    });
  });

  it("claims nothing for an outcome it does not know", () => {
    const toast = confirmToast("SOMETHING_NEW" as never);
    expect(toast.variant).toBe("info");
    expect(toast.message).not.toMatch(/học viên có quyền học/);
  });
});

describe("reconcileToast", () => {
  it("names the new status when the provider's answer changed it", () => {
    expect(reconcileToast({ status: "SUCCEEDED", changed: true })).toEqual({
      message: "Đã cập nhật trạng thái giao dịch: Thành công",
      variant: "success",
    });
    expect(reconcileToast({ status: "FAILED", changed: true }).message).toBe(
      "Đã cập nhật trạng thái giao dịch: Thất bại",
    );
  });

  it("says the provider has not recorded a payment when nothing changed", () => {
    for (const status of ["PENDING", "EXPIRED", "FAILED"] as const) {
      expect(reconcileToast({ status, changed: false })).toEqual({
        message: "Nhà cung cấp chưa ghi nhận thanh toán",
        variant: "info",
      });
    }
  });

  it("does not say the provider recorded nothing about a payment that is already recorded", () => {
    // Someone else reconciled first: the API answers SUCCEEDED, changed false.
    const toast = reconcileToast({ status: "SUCCEEDED", changed: false });
    expect(toast.message).toBe("Giao dịch đã được ghi nhận thanh toán trước đó");
    expect(toast.variant).toBe("info");
  });
});
