import { validateHeaderValue } from 'node:http';
import { attachment } from './content-disposition.js';

describe('attachment (REVIEW F-32, RFC 6266)', () => {
  it('names a plain file twice, for old clients and for new ones', () => {
    expect(attachment('report.pdf')).toBe(
      `attachment; filename="report.pdf"; filename*=UTF-8''report.pdf`,
    );
  });

  it('keeps a Vietnamese name whole for browsers that read filename*, and readable for those that do not', () => {
    expect(attachment('Tài liệu bài 1.pdf')).toBe(
      `attachment; filename="Tai lieu bai 1.pdf"; filename*=UTF-8''T%C3%A0i%20li%E1%BB%87u%20b%C3%A0i%201.pdf`,
    );
  });

  it('turns đ into d, which does not decompose into a letter and an accent', () => {
    expect(attachment('Đề cương đại số.pdf')).toContain('filename="De cuong dai so.pdf"');
  });

  it('replaces what has no ASCII form in the fallback and keeps it in filename*', () => {
    const header = attachment('報告 🎓.pdf');

    expect(header).toContain('filename="__ __.pdf"');
    expect(header).toContain("filename*=UTF-8''%E5%A0%B1%E5%91%8A%20%F0%9F%8E%93.pdf");
  });

  it('cannot break out of the quoted name or start another header', () => {
    const header = attachment('a"b\\c\r\nSet-Cookie: x=1.pdf');

    expect(header).not.toMatch(/[\r\n]/);
    expect(header.startsWith('attachment; filename="')).toBe(true);
    // The quoted fallback holds no quote or backslash of its own.
    const fallback = /^attachment; filename="([^"]*)"; filename\*=/.exec(header)?.[1];
    expect(fallback).toBeDefined();
    expect(fallback).not.toMatch(/["\\]/);
    expect(header).toContain('%22');
    expect(header).toContain('%5C');
    // A control character has no place in a file name: it is dropped, not encoded.
    expect(header).not.toContain('%0D');
    expect(header).not.toContain('%0A');
    expect(header).toContain('Set-Cookie');
  });

  it("percent-encodes the characters RFC 5987 does not allow in filename*, though encodeURIComponent leaves them", () => {
    expect(attachment("it's (1)*.pdf")).toContain("filename*=UTF-8''it%27s%20%281%29%2A.pdf");
  });

  it.each([[''], ['   '], ['\r\n']])('falls back to a name of its own for %j', (name) => {
    expect(attachment(name)).toBe(`attachment; filename="tai-lieu"; filename*=UTF-8''tai-lieu`);
  });

  it('gives the plain form a name of its own when only a quote and a backslash are left of it', () => {
    expect(attachment('"\\')).toBe(`attachment; filename="tai-lieu"; filename*=UTF-8''%22%5C`);
  });

  it.each([
    ['Tài liệu bài 1.pdf'],
    ['a\u0000b\u0007c.pdf'],
    ['\u0301\u0301.pdf'],
    ['x'.repeat(200)],
    ['ñandú/../etc/passwd'],
    ['; filename=evil.exe'],
    ['line\nbreak.pdf'],
  ])('is a value Node accepts as a header for %j', (name) => {
    expect(() => validateHeaderValue('Content-Disposition', attachment(name))).not.toThrow();
  });
});
