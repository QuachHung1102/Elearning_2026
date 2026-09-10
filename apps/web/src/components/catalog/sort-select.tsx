"use client";

import { useRouter } from "next/navigation";

export const SORT_OPTIONS = [
  { label: "Phổ biến nhất", value: "enrollmentCount:desc" },
  { label: "Mới nhất", value: "publishedAt:desc" },
  { label: "Giá thấp đến cao", value: "priceVnd:asc" },
  { label: "Giá cao đến thấp", value: "priceVnd:desc" },
] as const;

/**
 * No "Highest rated": the only non-zero ratings in the system are seeded
 * numbers, and sorting by them would produce an invented leaderboard.
 */
export function SortSelect({
  value,
  basePath,
  query,
}: {
  value: string;
  basePath: string;
  query: Record<string, string | string[] | undefined>;
}) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-semibold" htmlFor="sort">
        Sắp xếp
      </label>
      <select
        id="sort"
        name="sort"
        defaultValue={value}
        className="control min-h-11 w-auto"
        onChange={(event) => {
          const params = new URLSearchParams();
          for (const [key, entry] of Object.entries(query)) {
            if (entry === undefined || key === "sort" || key === "page") continue;
            for (const single of Array.isArray(entry) ? entry : [entry]) {
              if (single) params.append(key, single);
            }
          }
          params.set("sort", event.target.value);
          router.push(`${basePath}?${params.toString()}`);
        }}
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit" className="text-sm underline">
          Áp dụng
        </button>
      </noscript>
    </div>
  );
}
