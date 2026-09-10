/**
 * Vietnamese search normalisation. Used for BOTH sides of the comparison:
 * when writing `Course.searchText` and when reading the `?q=` parameter, so
 * typing "lap trinh" matches "Lập trình".
 */
export function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim();
}

export const SEARCH_TEXT_MAX = 400;

/**
 * Source is title + subtitle only. `description` is long Markdown and would
 * make `LIKE '%q%'` noisy.
 *
 * ponytail: no index on `search_text` — `%q%` is unindexable by btree and a
 * sequential scan is cheap under ~500 courses. Add `pg_trgm` + a GIN index
 * when `EXPLAIN ANALYZE` of `GET /courses?q=` passes 50 ms.
 */
export function buildSearchText(
  title: string,
  subtitle?: string | null,
): string {
  return normalize(`${title} ${subtitle ?? ''}`).slice(0, SEARCH_TEXT_MAX);
}
