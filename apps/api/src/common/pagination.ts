export const PAGE_SIZE_DEFAULT = 20;
export const PAGE_SIZE_MAX = 100;

export type Page = {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
};

export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

/**
 * Clamps a raw page/pageSize pair into a query window. Out-of-range and
 * unparseable values are clamped rather than rejected: `?pageSize=200` has to
 * answer 200 with `pageSize: 100` (ROADMAP.md A2.8), not 400.
 *
 * Kept free of decorators so it can be unit tested without a Nest container.
 */
export function resolvePage(
  query: { page?: unknown; pageSize?: unknown } = {},
  defaultPageSize = PAGE_SIZE_DEFAULT,
): Page {
  const page = Math.max(1, Math.trunc(toNumber(query.page, 1)));
  const pageSize = Math.min(
    PAGE_SIZE_MAX,
    Math.max(1, Math.trunc(toNumber(query.pageSize, defaultPageSize))),
  );
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function paginated<T>(
  items: T[],
  total: number,
  page: Page,
): Paginated<T> {
  return {
    items,
    page: page.page,
    pageSize: page.pageSize,
    total,
    totalPages: Math.ceil(total / page.pageSize),
  };
}

function toNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'string' ? Number(value.trim()) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed)
    ? parsed
    : fallback;
}
