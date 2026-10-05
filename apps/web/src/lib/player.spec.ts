import { describe, expect, it } from "vitest";
import {
  commandForKey,
  mergeSave,
  playbackEngine,
  rateLabel,
  reachedCompletion,
  resumeAt,
  saveDelay,
  spokenTime,
  stepRate,
  tokenNeedsRefresh,
} from "./player";

describe("reachedCompletion", () => {
  it("fires at 95% of the playing file, not before", () => {
    expect(reachedCompletion(56.9, 60)).toBe(false);
    expect(reachedCompletion(57, 60)).toBe(true);
    expect(reachedCompletion(60, 60)).toBe(true);
  });

  it("never fires before the duration is known", () => {
    expect(reachedCompletion(0, Number.NaN)).toBe(false);
    expect(reachedCompletion(0, 0)).toBe(false);
    expect(reachedCompletion(10, Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe("resumeAt", () => {
  it("resumes at the saved position", () => {
    expect(resumeAt(42, 60)).toBe(42);
  });

  it("starts over within the last 10 seconds or past the end", () => {
    expect(resumeAt(50, 60)).toBe(0);
    expect(resumeAt(55, 60)).toBe(0);
    expect(resumeAt(400, 60)).toBe(0);
  });

  it("starts at 0 with nothing saved", () => {
    expect(resumeAt(null, 60)).toBe(0);
    expect(resumeAt(0, 60)).toBe(0);
  });
});

describe("tokenNeedsRefresh", () => {
  const expiresAt = "2026-09-20T08:00:00.000Z";
  const at = (iso: string) => Date.parse(iso);

  it("refreshes inside the last minute", () => {
    expect(tokenNeedsRefresh(expiresAt, at("2026-09-20T07:58:59.000Z"))).toBe(false);
    expect(tokenNeedsRefresh(expiresAt, at("2026-09-20T07:59:01.000Z"))).toBe(true);
  });
});

describe("progress save throttle", () => {
  it("sends the first save at once and spaces later ones 5 s apart", () => {
    expect(saveDelay(null, 1_000)).toBe(0);
    expect(saveDelay(1_000, 3_000)).toBe(3_000);
    expect(saveDelay(1_000, 7_000)).toBe(0);
  });

  it("merges pending saves into one body", () => {
    expect(mergeSave(undefined, { lastPositionSeconds: 30 })).toEqual({
      lastPositionSeconds: 30,
    });
    expect(
      mergeSave(
        { lastPositionSeconds: 45, completed: true },
        { lastPositionSeconds: 40 },
      ),
    ).toEqual({ lastPositionSeconds: 45, completed: true });
    expect(
      mergeSave(
        { lastPositionSeconds: 45, completed: true },
        { lastPositionSeconds: 50, completed: false },
      ),
    ).toEqual({ lastPositionSeconds: 50, completed: false });
  });
});

describe("spokenTime", () => {
  it("reads time as words", () => {
    expect(spokenTime(192)).toBe("3 phút 12 giây");
    expect(spokenTime(760)).toBe("12 phút 40 giây");
    expect(spokenTime(180)).toBe("3 phút");
    expect(spokenTime(3_725)).toBe("1 giờ 2 phút 5 giây");
    expect(spokenTime(0)).toBe("0 giây");
  });
});

describe("commandForKey", () => {
  it("maps the UX_PLAN §8.4 keys", () => {
    expect(commandForKey(" ")).toEqual({ type: "toggle-play" });
    expect(commandForKey("K")).toEqual({ type: "toggle-play" });
    expect(commandForKey("ArrowLeft")).toEqual({ type: "seek-by", seconds: -5 });
    expect(commandForKey("l")).toEqual({ type: "seek-by", seconds: 10 });
    expect(commandForKey("ArrowUp")).toEqual({ type: "volume-by", delta: 0.1 });
    expect(commandForKey("7")).toEqual({ type: "seek-to-fraction", fraction: 0.7 });
    expect(commandForKey(">")).toEqual({ type: "rate-step", step: 1 });
    expect(commandForKey("End")).toEqual({ type: "seek-to-end" });
    expect(commandForKey("?")).toEqual({ type: "help" });
  });

  it("leaves every other key to the browser", () => {
    expect(commandForKey("Tab")).toBeNull();
    expect(commandForKey("Enter")).toBeNull();
    expect(commandForKey("x")).toBeNull();
  });
});

describe("stepRate", () => {
  it("steps through the list and stops at both ends", () => {
    expect(stepRate(1, 1)).toBe(1.25);
    expect(stepRate(1, -1)).toBe(0.75);
    expect(stepRate(2, 1)).toBe(2);
    expect(stepRate(0.75, -1)).toBe(0.75);
    expect(rateLabel(1.25)).toBe("1,25x");
  });
});

describe("playbackEngine (REVIEW F-21)", () => {
  it("lets the element play MP4 and HLS it can play itself", () => {
    expect(playbackEngine("mp4", "")).toBe("native");
    expect(playbackEngine("hls", "maybe")).toBe("native");
    expect(playbackEngine("hls", "probably")).toBe("native");
  });

  it("hands HLS to hls.js when the element cannot play it", () => {
    expect(playbackEngine("hls", "")).toBe("hls.js");
  });
});
