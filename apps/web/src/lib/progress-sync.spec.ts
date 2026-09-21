import { beforeEach, describe, expect, it, vi } from "vitest";

// A save's answer, resolved by hand to control arrival order.
const calls: { resolve: (value: unknown) => void; reject: (error: unknown) => void }[] = [];

vi.mock("./api", () => {
  class ApiError extends Error {
    constructor(public readonly status: number, public readonly code: string) {
      super(code);
    }
  }
  return {
    ApiError,
    apiFetch: () =>
      new Promise((resolve, reject) => calls.push({ resolve, reject })),
  };
});

const answer = (completedAt: string | null) => ({
  progress: { lastPositionSeconds: 0, completedAt },
  courseProgress: { completedLessons: 0, totalLessons: 1, percent: 0 },
});

beforeEach(() => {
  calls.length = 0;
  vi.resetModules();
  vi.stubGlobal("window", {
    setTimeout: (run: () => void) => (queueMicrotask(run), 1),
    clearTimeout: () => undefined,
    addEventListener: () => undefined,
  });
  vi.stubGlobal("document", { visibilityState: "visible", addEventListener: () => undefined });
  vi.stubGlobal("navigator", { onLine: true });
});

describe("progress-sync", () => {
  it("announces only the newest answer when answers arrive out of order", async () => {
    const sync = await import("./progress-sync");
    const seen: (string | null)[] = [];
    sync.onProgressSync((event) => {
      if (event.type === "saved") seen.push(event.result.progress.completedAt);
    });
    sync.queueProgress("l1", { lastPositionSeconds: 30 }); // tick, sent first
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    const toggle = sync.saveProgressNow("l1", { lastPositionSeconds: 0, completed: true });
    calls[1].resolve(answer("2026-01-01T00:00:00Z"));
    await toggle;
    calls[0].resolve(answer(null));
    await new Promise((done) => setTimeout(done, 0));
    expect(seen).toEqual(["2026-01-01T00:00:00Z"]);
  });

  it("clears the unsynced flag without a success when the retry is refused", async () => {
    const sync = await import("./progress-sync");
    const { ApiError } = await import("./api");
    const statuses: object[] = [];
    sync.onProgressSync((event) => {
      if (event.type === "status") statuses.push(event);
    });
    sync.queueProgress("l1", { lastPositionSeconds: 5 });
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    calls[0].reject(new ApiError(429, "RATE_LIMITED"));
    await vi.waitFor(() => expect(calls).toHaveLength(2)); // retried on its own
    calls[1].reject(new ApiError(403, "NOT_ENROLLED"));
    await vi.waitFor(() => expect(statuses).toHaveLength(2));
    expect(statuses).toEqual([
      { type: "status", unsynced: true },
      { type: "status", unsynced: false, dropped: true },
    ]);
    expect(sync.isUnsynced()).toBe(false);
  });
});
