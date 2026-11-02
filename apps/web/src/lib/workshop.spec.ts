import { describe, expect, it } from "vitest";
import {
  filterResources,
  normalizeSearch,
  practiceResources,
} from "./workshop";
describe("practice resource search", () => {
  it("finds Vietnamese notes with or without accents", () => {
    expect(
      filterResources(practiceResources, "bien", "all", "vi").map(
        (item) => item.id,
      ),
    ).toEqual(["variables"]);
    expect(normalizeSearch(" ĐƯỜNG ")).toBe("duong");
  });
  it("combines a topic and search term without leaking other topics", () => {
    expect(filterResources(practiceResources, "HTML", "python", "en")).toEqual(
      [],
    );
    expect(
      filterResources(practiceResources, "HTML", "web", "en").map(
        (item) => item.id,
      ),
    ).toEqual(["html"]);
  });
  it("uses the selected language and returns an empty result for unknown terms", () => {
    expect(
      filterResources(practiceResources, "variables", "all", "en").map(
        (item) => item.id,
      ),
    ).toEqual(["variables"]);
    expect(
      filterResources(practiceResources, "not-a-resource", "all", "vi"),
    ).toEqual([]);
  });
  it("does not change the source notes while filtering", () => {
    const snapshot = JSON.stringify(practiceResources);
    filterResources(practiceResources, "lists", "python", "en");
    expect(JSON.stringify(practiceResources)).toBe(snapshot);
    expect(filterResources(practiceResources, "", "all", "vi")).toHaveLength(4);
  });
});
