/**
 * Shared by the server-rendered filter panel and the client radio group, so it
 * cannot live in a "use client" module.
 */
export const PRICE_BANDS = [
  { label: "Tất cả", min: "", max: "" },
  { label: "Dưới 500.000 ₫", min: "", max: "499999" },
  { label: "500.000 – 1.000.000 ₫", min: "500000", max: "1000000" },
  { label: "Trên 1.000.000 ₫", min: "1000001", max: "" },
] as const;

export function bandIndex(min?: string, max?: string): number {
  const found = PRICE_BANDS.findIndex(
    (band) => band.min === (min ?? "") && band.max === (max ?? ""),
  );
  return found === -1 ? 0 : found;
}
