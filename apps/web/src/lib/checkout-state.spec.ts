import { describe, expect, it } from "vitest";
import { ApiError } from "./api";
import {
  blockFor,
  checkoutReducer,
  currentAttempt,
  viewOf,
  type CheckoutState,
} from "./checkout-state";
import type { CheckoutSession, PurchaseDetail } from "./orders";

const NOW = Date.parse("2026-09-30T10:00:00.000Z");
const IN = (seconds: number) => new Date(NOW + seconds * 1_000).toISOString();

const session = (over: Partial<CheckoutSession> = {}): CheckoutSession => ({
  purchaseId: "purchase-1",
  paymentAttemptId: "attempt-1",
  appTransId: "260930_a1b2c3d4",
  status: "PENDING",
  amountVnd: 499_000,
  provider: "DEMO",
  qrCode: "qr-1",
  orderUrl: "http://localhost:3000/account/orders/purchase-1",
  createdAt: IN(-60),
  expiresAt: IN(600),
  ...over,
});

const detail = (over: Partial<PurchaseDetail> = {}): PurchaseDetail => ({
  id: "purchase-1",
  courseId: "course-1",
  courseSlug: "khoa-hoc",
  courseTitle: "Khóa học",
  priceVnd: 499_000,
  status: "PENDING",
  createdAt: IN(-60),
  paidAt: null,
  refundedAt: null,
  attempts: [session()],
  ...over,
});

const ready = (over: Partial<Extract<CheckoutState, { phase: "ready" }>> = {}) =>
  ({
    phase: "ready",
    session: session(),
    detail: null,
    pollFailures: 0,
    startedAt: NOW,
    ...over,
  }) as Extract<CheckoutState, { phase: "ready" }>;

describe("checkoutReducer", () => {
  it("starts opening, and reopening from anywhere goes back to opening", () => {
    expect(checkoutReducer(ready(), { type: "opening" })).toEqual({ phase: "opening" });
    expect(
      checkoutReducer({ phase: "blocked", reason: "error", message: "x" }, { type: "opening" }),
    ).toEqual({ phase: "opening" });
  });

  it("opens with the session, a clean poll history and the moment it started", () => {
    expect(checkoutReducer({ phase: "opening" }, { type: "opened", session: session(), now: NOW })).toEqual({
      phase: "ready",
      session: session(),
      detail: null,
      pollFailures: 0,
      startedAt: NOW,
    });
  });

  it("forgets the old order and its failed polls when a new QR is opened", () => {
    const stale = ready({ detail: detail(), pollFailures: 2 });
    const next = session({ paymentAttemptId: "attempt-2", qrCode: "qr-2" });

    expect(checkoutReducer(stale, { type: "opened", session: next, now: NOW + 5_000 })).toEqual({
      phase: "ready",
      session: next,
      detail: null,
      pollFailures: 0,
      startedAt: NOW + 5_000,
    });
  });

  it("keeps what the block was about", () => {
    const blocked = { type: "blocked", reason: "rate-limited", message: "Thử lại sau", retryAfterSeconds: 30 } as const;

    expect(checkoutReducer({ phase: "opening" }, blocked)).toEqual({
      phase: "blocked",
      reason: "rate-limited",
      message: "Thử lại sau",
      retryAfterSeconds: 30,
    });
  });

  it("takes the latest order state from a poll and forgives earlier failures", () => {
    const paid = detail({ status: "PAID" });

    expect(checkoutReducer(ready({ pollFailures: 2 }), { type: "polled", detail: paid })).toMatchObject({
      detail: paid,
      pollFailures: 0,
    });
  });

  it("counts failed polls one by one", () => {
    let state: CheckoutState = ready();
    for (const expected of [1, 2, 3]) {
      state = checkoutReducer(state, { type: "pollFailed" });
      expect(state).toMatchObject({ pollFailures: expected });
    }
  });

  it("ignores a poll that lands after the page moved on", () => {
    const opening: CheckoutState = { phase: "opening" };
    const blocked: CheckoutState = { phase: "blocked", reason: "email", message: "x" };

    expect(checkoutReducer(opening, { type: "polled", detail: detail() })).toBe(opening);
    expect(checkoutReducer(blocked, { type: "pollFailed" })).toBe(blocked);
  });
});

describe("currentAttempt", () => {
  it("is the QR the page opened until a poll says a newer one exists", () => {
    expect(currentAttempt(ready()).paymentAttemptId).toBe("attempt-1");

    const newer = session({ paymentAttemptId: "attempt-2", qrCode: "qr-2" });
    const state = ready({ detail: detail({ attempts: [newer, session()] }) });
    expect(currentAttempt(state)).toEqual(newer);
  });
});

describe("viewOf", () => {
  it("waits while the QR is live and nothing has been polled yet", () => {
    expect(viewOf(ready(), NOW)).toBe("pending");
  });

  it("reports paid only when a poll says the order is paid", () => {
    expect(viewOf(ready({ detail: detail({ status: "PAID" }) }), NOW)).toBe("paid");
  });

  it("lets the clock end a QR the server has not yet closed", () => {
    expect(viewOf(ready(), NOW + 601_000)).toBe("expired");
  });

  it("goes unknown after three failed polls, whatever else it knew", () => {
    expect(viewOf(ready({ pollFailures: 3 }), NOW)).toBe("unknown");
  });

  it("follows the newest attempt, not the one this tab opened", () => {
    const failed = session({ paymentAttemptId: "attempt-2", status: "FAILED" });
    expect(viewOf(ready({ detail: detail({ attempts: [failed, session()] }) }), NOW)).toBe("failed");
  });
});

// Every way opening the checkout can fail, and what the learner is told
// (API_CONTRACT.md §5.8, UX_PLAN.md §3.1).
describe("blockFor", () => {
  it("asks an unverified learner to verify, so they can come back and retry", () => {
    expect(blockFor(new ApiError(403, "EMAIL_NOT_VERIFIED"))).toEqual({
      reason: "email",
      message: "Xác minh email trước khi thanh toán.",
    });
  });

  it.each([
    [new ApiError(422, "COURSE_NOT_PURCHASABLE"), "Khóa học này hiện không bán."],
    [new ApiError(404, "NOT_FOUND"), "Không tìm thấy nội dung."],
  ])("calls %s unavailable", (error, message) => {
    expect(blockFor(error)).toEqual({ reason: "unavailable", message });
  });

  it("carries the wait a rate limit asked for", () => {
    expect(blockFor(new ApiError(429, "RATE_LIMITED", undefined, undefined, 42))).toEqual({
      reason: "rate-limited",
      message: "Bạn đã thử quá nhiều lần. Vui lòng đợi rồi thử lại.",
      retryAfterSeconds: 42,
    });
  });

  it("falls back to a general error for an outage, a network failure or something unknown", () => {
    expect(blockFor(new ApiError(500, "INTERNAL"))).toMatchObject({ reason: "error" });
    expect(blockFor(new ApiError(0, "NETWORK_ERROR"))).toEqual({
      reason: "error",
      message: "Không thể kết nối máy chủ. Vui lòng thử lại.",
    });
    expect(blockFor(null)).toMatchObject({ reason: "error" });
    expect(blockFor(new ApiError(418, "TEAPOT"))).toMatchObject({ reason: "error" });
  });
});
