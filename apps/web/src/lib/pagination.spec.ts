import { describe, expect, it, vi } from "vitest";
import { collectPages } from "./pagination";

const pages = (sizes: number[]) => (page: number) =>
  Promise.resolve({
    items: Array.from({ length: sizes[page - 1] ?? 0 }, (_, index) => `${page}.${index}`),
    totalPages: sizes.length,
  });

describe("collectPages", () => {
  it("reads every page and joins them in order", async () => {
    expect(await collectPages(pages([2, 2, 1]))).toEqual(["1.0", "1.1", "2.0", "2.1", "3.0"]);
  });

  it("asks once when there is one page, and not at all twice", async () => {
    const fetchPage = vi.fn(pages([3]));

    expect(await collectPages(fetchPage)).toHaveLength(3);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith(1);
  });

  it("returns nothing for an empty catalog", async () => {
    expect(await collectPages(async () => ({ items: [], totalPages: 0 }))).toEqual([]);
  });

  it("stops at the limit rather than walking a catalog that never ends", async () => {
    const fetchPage = vi.fn(async (page: number) => ({ items: [page], totalPages: 1_000_000 }));

    expect(await collectPages(fetchPage, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(fetchPage).toHaveBeenCalledTimes(5);
  });
});
