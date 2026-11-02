/**
 * Shared by the server-rendered filter panel and the client radio group, so it
 * cannot live in a "use client" module.
 */
export const PRICE_BANDS = [
  { label: "Tất cả", min: "", max: "" },
  { label: "100.000 ₫", min: "100000", max: "100000" },
  { label: "150.000 ₫", min: "150000", max: "150000" },
  { label: "200.000 ₫", min: "200000", max: "200000" },
  { label: "Miễn phí", min: "0", max: "0" },
] as const;

export function bandIndex(min?: string, max?: string): number {
  const found = PRICE_BANDS.findIndex(
    (band) => band.min === (min ?? "") && band.max === (max ?? ""),
  );
  return found === -1 ? 0 : found;
}
