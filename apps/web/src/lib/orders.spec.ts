import { afterEach, describe, expect, it, vi } from "vitest";
import {
  paymentView,
  qrStillLive,
  shortId,
  pollDelay,
  refundBlockMessage,
  secondsLeft,
  type PaymentViewInput,
} from "./orders";

const NOW = Date.parse("2026-09-30T10:00:00.000Z");
const IN = (seconds: number) => new Date(NOW + seconds * 1_000).toISOString();

const input = (over: Partial<PaymentViewInput> = {}): PaymentViewInput => ({
  purchase: "PENDING",
  attempt: { status: "PENDING", expiresAt: IN(600) },
  now: NOW,
  pollFailures: 0,
  ...over,
});

// UX_PLAN.md §5.5: the page never concludes "paid" from anything but the
// stored order, and a broken poll must not read as either outcome.
describe("paymentView", () => {
  it("waits while the order is open and its QR is live", () => {
    expect(paymentView(input())).toBe("pending");
  });

  it.each(["PAID", "REFUND_REQUESTED"] as const)("calls a %s order paid", (purchase) => {
    expect(paymentView(input({ purchase }))).toBe("paid");
  });

  it.each(["REFUNDED", "CANCELLED"] as const)(
    "treats a %s order as needing a new QR, not as a success",
    (purchase) => {
      expect(paymentView(input({ purchase }))).toBe("expired");
    },
  );

  it("decides the QR has lapsed by the client's own clock, without waiting for the server to say so", () => {
    expect(paymentView(input({ attempt: { status: "PENDING", expiresAt: IN(0) } }))).toBe("expired");
    expect(paymentView(input({ attempt: { status: "PENDING", expiresAt: IN(-30) } }))).toBe("expired");
    expect(paymentView(input({ attempt: { status: "PENDING", expiresAt: IN(1) } }))).toBe("pending");
  });

  it.each([
    ["EXPIRED", "expired"],
    ["FAILED", "failed"],
    ["CANCELLED", "failed"],
  ] as const)("reads a %s attempt of an open order as %s", (status, expected) => {
    expect(paymentView(input({ attempt: { status, expiresAt: IN(600) } }))).toBe(expected);
  });

  it("asks for a new QR when the open order has no attempt at all", () => {
    expect(paymentView(input({ attempt: null }))).toBe("expired");
  });

  it("gives up claiming anything after three failed polls in a row", () => {
    expect(paymentView(input({ pollFailures: 2 }))).toBe("pending");
    expect(paymentView(input({ pollFailures: 3 }))).toBe("unknown");
    expect(paymentView(input({ pollFailures: 9 }))).toBe("unknown");
  });
});

describe("pollDelay", () => {
  it("polls every 3 seconds for the first minute, then every 10", () => {
    expect(pollDelay(0)).toBe(3_000);
    expect(pollDelay(59_999)).toBe(3_000);
    expect(pollDelay(60_000)).toBe(10_000);
    expect(pollDelay(600_000)).toBe(10_000);
  });
});

describe("secondsLeft", () => {
  it("rounds up, so the clock shows 0:01 until the QR really lapses", () => {
    expect(secondsLeft(IN(90), NOW)).toBe(90);
    expect(secondsLeft(new Date(NOW + 1_200).toISOString(), NOW)).toBe(2);
    expect(secondsLeft(IN(0), NOW)).toBe(0);
  });

  it("never goes negative", () => {
    expect(secondsLeft(IN(-45), NOW)).toBe(0);
  });
});

describe("refundBlockMessage", () => {
  it("explains each reason in the learner's terms, with the numbers the API sent", () => {
    expect(refundBlockMessage({ reason: "OUTSIDE_WINDOW", daysSincePaid: 31, progressPercent: 0 })).toBe(
      "Đơn hàng đã thanh toán 31 ngày trước, quá thời hạn hoàn tiền 7 ngày.",
    );
    expect(refundBlockMessage({ reason: "PROGRESS_TOO_HIGH", daysSincePaid: 2, progressPercent: 35 })).toBe(
      "Đã học 35% khóa học; chính sách chỉ hoàn tiền khi dưới 20%.",
    );
    expect(refundBlockMessage({ reason: "ALREADY_REQUESTED", daysSincePaid: 1, progressPercent: 0 })).toBe(
      "Yêu cầu hoàn tiền của đơn hàng này đã được gửi.",
    );
  });

  it("has words for every reason the API can send", () => {
    const reasons = [
      "NOT_PAID",
      "ALREADY_REQUESTED",
      "ALREADY_REFUNDED",
      "NOT_PURCHASED",
      "FREE_COURSE",
      "OUTSIDE_WINDOW",
      "PROGRESS_TOO_HIGH",
    ] as const;
    for (const reason of reasons) {
      expect(refundBlockMessage({ reason, daysSincePaid: null, progressPercent: 0 })).toMatch(/\S/);
    }
  });

  it("falls back to a general sentence for a reason it does not know", () => {
    expect(refundBlockMessage({ reason: "SOMETHING_NEW" as never, daysSincePaid: null, progressPercent: 0 })).toBe(
      "Đơn hàng này không thể hoàn tiền.",
    );
  });
});

// A server page reads the clock through this, not in its render.
describe("qrStillLive", () => {
  afterEach(() => vi.useRealTimers());

  it("is true only for a PENDING attempt whose expiry is still ahead", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    expect(qrStillLive({ status: "PENDING", expiresAt: IN(1) })).toBe(true);
    expect(qrStillLive({ status: "PENDING", expiresAt: IN(0) })).toBe(false);
    expect(qrStillLive({ status: "PENDING", expiresAt: IN(-60) })).toBe(false);
    expect(qrStillLive({ status: "FAILED", expiresAt: IN(600) })).toBe(false);
    expect(qrStillLive({ status: "EXPIRED", expiresAt: IN(600) })).toBe(false);
    expect(qrStillLive(undefined)).toBe(false);
  });
});

// The learner quotes this to support and the admin searches for it: one form.
describe("shortId", () => {
  it("is the first eight characters in capitals, the same on every screen", () => {
    expect(shortId("3f2b8c1e-0000-4000-8000-000000000001")).toBe("3F2B8C1E");
  });
});
