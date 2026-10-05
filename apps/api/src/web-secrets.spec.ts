import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

// ROADMAP.md N4.11 and N5.1: the web app is public code. A provider key or a
// storage secret that reaches it is a leak, and a leak nobody notices until the
// bundle is downloaded. This scans the sources, so a careless import or a
// pasted example fails here instead of in production.
const WEB = resolve(import.meta.dirname, '../../web');
const SKIP = new Set(['node_modules', '.next', 'coverage']);
const TEXT = /\.(ts|tsx|mts|mjs|cjs|js|json|css|md|example)$/;

function sources(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    if (SKIP.has(name)) return [];
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sources(path);
    return TEXT.test(name) ? [path] : [];
  });
}

const offenders = (pattern: RegExp, root = WEB) =>
  sources(root)
    .filter((path) => pattern.test(readFileSync(path, 'utf8')))
    .map((path) => relative(WEB, path));

describe('the web app holds no server secret', () => {
  it('never mentions the ZaloPay callback key (ROADMAP N4.11)', () => {
    expect(offenders(/key2/i, join(WEB, 'src'))).toEqual([]);
  });

  it('never names a provider or storage credential (ROADMAP N5.1)', () => {
    expect(
      offenders(/ZALOPAY_KEY|CF_STREAM_TOKEN|R2_SECRET|R2_ACCESS|CLOUDFLARE_STREAM_API_TOKEN/i),
    ).toEqual([]);
  });

  it('is scanning the real web sources, not an empty folder', () => {
    expect(sources(join(WEB, 'src')).length).toBeGreaterThan(50);
  });
});
