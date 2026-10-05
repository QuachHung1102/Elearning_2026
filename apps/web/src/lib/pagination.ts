/**
 * The items of every page of a paginated list, in order.
 *
 * ponytail: `maxPages` bounds a list that never ends; 50 pages of 100 is far
 * past any catalog this site will have, and a sitemap has its own 50,000-URL
 * ceiling. Split into a sitemap index if it is ever reached.
 */
export async function collectPages<T>(
  fetchPage: (page: number) => Promise<{ items: T[]; totalPages: number }>,
  maxPages = 50,
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const { items, totalPages } = await fetchPage(page);
    all.push(...items);
    if (page >= totalPages) break;
  }
  return all;
}
