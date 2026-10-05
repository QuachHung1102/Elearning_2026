const FALLBACK_NAME = 'tai-lieu';

/**
 * The plain `filename="…"` that clients without RFC 5987 read: ASCII only, no
 * quote, no backslash. đ has no decomposition, so it is mapped by hand; a
 * character with no ASCII form becomes `_` (an emoji, being two UTF-16 units,
 * becomes two).
 */
function asciiName(name: string): string {
  return name
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/["\\]/g, '')
    .replace(/[^\x20-\x7e]/g, '_')
    .trim();
}

/** RFC 5987 `attr-char`: `encodeURIComponent` also leaves `'`, `(`, `)` and `*`, which it does not allow. */
function encodeExtended(name: string): string {
  return encodeURIComponent(name).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/**
 * `Content-Disposition` for a download (REVIEW F-32, RFC 6266): the name twice,
 * ASCII for old clients and UTF-8 for the rest. A name written straight into the
 * header made Node throw on the first character above 0xFF, so a Vietnamese file
 * name was a 500. Control characters are dropped: they have no place in a name,
 * and a line break in a header value is an injection.
 */
export function attachment(filename: string): string {
  // Matching the control characters is the point.
  // eslint-disable-next-line no-control-regex
  const name = filename.replace(/[\u0000-\u001f\u007f]/g, '').trim() || FALLBACK_NAME;
  return `attachment; filename="${asciiName(name) || FALLBACK_NAME}"; filename*=UTF-8''${encodeExtended(name)}`;
}
