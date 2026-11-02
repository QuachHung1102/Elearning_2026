import { describe, expect, it } from "vitest";
import { unsatisfiableVideoRange } from "./video-range";

describe("public video range validation", () => {
  it.each(["bytes=100-", "bytes=999999999999-", "bytes=-0", "bytes=20-10", "bytes=abc-def", "bytes=", "bytes=-", "bytes=0--1", "bytes=0-1,", "bytes=100-,200-"])("rejects %s for a 100-byte file", (range) => {
    expect(unsatisfiableVideoRange(range, 100)).toBe(true);
  });
  it.each([null, "bytes=0-31", "bytes=99-", "bytes=-32", "bytes=-200", "bytes=1-999", "nonsense", "bytes=0-1,3-4", "bytes= 0-1"])("leaves valid or unsupported ranges to the static server: %s", (range) => {
    expect(unsatisfiableVideoRange(range, 100)).toBe(false);
  });
});
