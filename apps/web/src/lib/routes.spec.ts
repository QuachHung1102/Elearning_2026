import { describe, expect, it } from "vitest";
import { LEARNER_HOME, safeNext } from "./routes";

describe("safeNext", () => {
  it("keeps a same-origin path with its query and hash", () => {
    expect(safeNext("/courses/react?denied=1#top")).toBe(
      "/courses/react?denied=1#top",
    );
  });

  it.each([
    undefined,
    "",
    "https://evil.com",
    "//evil.com",
    String.raw`/\evil.com`,
    String.raw`/\/evil.com`,
    "/\t/evil.com",
    "javascript:alert(1)",
    "/.//evil.com",
    "/a/..//evil.com",
    "/%2e//evil.com",
  ])(
    "falls back to the learner home for %j",
    (value) => {
      expect(safeNext(value)).toBe(LEARNER_HOME);
    },
  );
});
