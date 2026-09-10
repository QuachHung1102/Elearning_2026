import { buildSearchText, normalize } from './search-text.js';

describe('normalize', () => {
  it('strips Vietnamese tone marks', () => {
    expect(normalize('Lập trình')).toBe('lap trinh');
  });

  it('maps đ and Đ to d — NFD does not decompose them', () => {
    expect(normalize('Đọc hiểu')).toBe('doc hieu');
  });

  it('lowercases and trims', () => {
    expect(normalize('  REACT  ')).toBe('react');
  });

  it('is idempotent, so a normalised query still matches', () => {
    expect(normalize(normalize('Lập trình'))).toBe('lap trinh');
  });
});

describe('buildSearchText', () => {
  it('lets an unaccented query match an accented title', () => {
    const searchText = buildSearchText(
      'Lập trình web với React và Next.js',
      'Khóa học đi từ nền tảng tới sản phẩm',
    );
    expect(searchText).toContain(normalize('lap trinh'));
    expect(searchText).toContain('san pham');
  });

  it('tolerates a missing subtitle', () => {
    expect(buildSearchText('Thiết kế', null)).toBe('thiet ke');
  });

  it('caps the stored value at the column width', () => {
    expect(buildSearchText('a'.repeat(500)).length).toBe(400);
  });
});
