import { SLUG_PATTERN, slugify, uniqueSlug } from './slug.js';

describe('slugify', () => {
  it('strips Vietnamese diacritics', () => {
    expect(slugify('Lập trình JavaScript')).toBe('lap-trinh-javascript');
  });

  it('collapses runs of punctuation into a single hyphen', () => {
    expect(slugify('Lập trình JavaScript từ đầu — Khóa 2026')).toBe(
      'lap-trinh-javascript-tu-dau-khoa-2026',
    );
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  ***React***  ')).toBe('react');
  });

  it('produces a value the route param regex accepts', () => {
    expect(SLUG_PATTERN.test(slugify('Thiết kế giao diện với Figma'))).toBe(
      true,
    );
  });

  it('never ends on a hyphen after truncation', () => {
    expect(slugify('abcde fghij', 6)).toBe('abcde');
  });
});

describe('uniqueSlug', () => {
  const taken = (slugs: string[]) => async (slug: string) =>
    slugs.includes(slug);

  it('returns the plain slug when it is free', async () => {
    await expect(uniqueSlug('Lập trình', taken([]))).resolves.toBe(
      'lap-trinh',
    );
  });

  it('appends -2 on the second course with the same title', async () => {
    await expect(
      uniqueSlug('Lập trình', taken(['lap-trinh'])),
    ).resolves.toBe('lap-trinh-2');
  });

  it('appends -3 on the third', async () => {
    await expect(
      uniqueSlug('Lập trình', taken(['lap-trinh', 'lap-trinh-2'])),
    ).resolves.toBe('lap-trinh-3');
  });

  it('keeps the suffixed slug inside the column width', async () => {
    const slug = await uniqueSlug('a'.repeat(200), taken(['a'.repeat(120)]));
    expect(slug.length).toBeLessThanOrEqual(120);
    expect(slug.endsWith('-2')).toBe(true);
  });

  it('falls back to a usable base when the title has no ASCII left', async () => {
    await expect(uniqueSlug('«»', taken([]))).resolves.toBe('khoa-hoc');
  });
});
