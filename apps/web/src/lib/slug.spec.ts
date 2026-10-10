import { describe, expect, it } from "vitest";
import { baseSlug } from "./slug";

describe("baseSlug", () => {
  it("is the plain slug when it is long enough", () => {
    expect(baseSlug("Lập trình JavaScript")).toBe("lap-trinh-javascript");
  });

  it("gives a title that slugifies below three characters the API's prefix", () => {
    expect(baseSlug("C++")).toBe("khoa-hoc-c");
    expect(baseSlug("Go")).toBe("khoa-hoc-go");
  });

  it("falls back to the bare prefix when nothing ASCII is left", () => {
    expect(baseSlug("«»")).toBe("khoa-hoc");
  });
});
