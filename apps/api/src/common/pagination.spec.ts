import {
  PAGE_MAX,
  PAGE_SIZE_DEFAULT,
  PAGE_SIZE_MAX,
  paginated,
  resolvePage,
} from './pagination.js';

describe('resolvePage', () => {
  it('clamps pageSize down to the maximum', () => {
    expect(resolvePage({ pageSize: 200 }).pageSize).toBe(PAGE_SIZE_MAX);
  });

  it.each([0, -1, '0', '-5'])('lifts page=%j back to 1', (page) => {
    expect(resolvePage({ page }).page).toBe(1);
  });

  it.each([undefined, null, 'abc', NaN, {}])(
    'falls back to defaults for pageSize=%j',
    (pageSize) => {
      expect(resolvePage({ pageSize }).pageSize).toBe(PAGE_SIZE_DEFAULT);
    },
  );

  it.each([1e30, '1e30', Number.MAX_VALUE])(
    'caps page=%j so the offset stays a valid query',
    (page) => {
      expect(resolvePage({ page, pageSize: 100 })).toMatchObject({
        page: PAGE_MAX,
        skip: (PAGE_MAX - 1) * 100,
      });
    },
  );

  it('accepts a per-endpoint default page size', () => {
    expect(resolvePage({}, 12).pageSize).toBe(12);
  });

  it('computes the offset from page and pageSize', () => {
    expect(resolvePage({ page: 3, pageSize: 12 })).toMatchObject({
      skip: 24,
      take: 12,
    });
  });
});

describe('paginated', () => {
  it('always reports totalPages', () => {
    expect(paginated([1, 2], 137, resolvePage({ pageSize: 20 }))).toEqual({
      items: [1, 2],
      page: 1,
      pageSize: 20,
      total: 137,
      totalPages: 7,
    });
  });

  it('reports zero pages for an empty result', () => {
    expect(paginated([], 0, resolvePage({})).totalPages).toBe(0);
  });
});
