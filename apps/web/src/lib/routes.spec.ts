import { describe, expect, it } from "vitest";
import { LEARNER_HOME, homeFor, safeNext } from "./routes";

describe("homeFor", () => {
  it("sends an instructor to their area and everyone else to the learner home", () => {
    expect(homeFor("INSTRUCTOR")).toBe("/instructor");
    expect(homeFor("STUDENT")).toBe(LEARNER_HOME);
    expect(homeFor("ADMIN")).toBe(LEARNER_HOME);
  });
});

describe("safeNext", () => {
  it("keeps a same-origin path with its query and hash", () => {
    expect(safeNext("/courses/react?denied=1#top")).toBe(
      "/courses/react?denied=1#top",
    );
  });

  // `?next=a&next=b` reaches the page as an array, and `.startsWith` on it threw
  // a TypeError, so /login and /register answered 500 (REVIEW F-16).
  it("reads the first value when the parameter repeats", () => {
    expect(safeNext(["/courses/react", "/other"])).toBe("/courses/react");
  });

  it.each([[["https://evil.com", "/ok"]], [[]]])(
    "still falls back for a repeated parameter that starts unsafe or empty: %j",
    (value) => {
      expect(safeNext(value)).toBe(LEARNER_HOME);
    },
  );

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
