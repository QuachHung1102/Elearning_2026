import { describe, expect, it } from "vitest";
import { formatDuration } from "./format";

// Minutes are rounded once, from the total, so 7199 s is "2 giờ" and never
// "1 giờ 60 phút" (REVIEW F-25).
describe("formatDuration", () => {
  it.each([
    [0, "dưới 1 phút"],
    [29, "dưới 1 phút"],
    [30, "1 phút"],
    [720, "12 phút"],
    [3570, "1 giờ"],
    [3600, "1 giờ"],
    [5400, "1 giờ 30 phút"],
    [7199, "2 giờ"],
  ])("formats %i seconds as %s", (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });
});
