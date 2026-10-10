import type { NextFunction, Request, Response } from 'express';

// The API answers with JSON and files, never a page a browser should render:
// nothing it sends may load or run anything (`default-src 'none'` also stops an
// uploaded SVG or HTML opened directly from running a script), and no page may
// frame it. Written by hand rather than through `helmet` for five headers
// (ROADMAP.md §9).
const HEADERS: ReadonlyArray<readonly [string, string]> = [
  ['X-Content-Type-Options', 'nosniff'],
  ['X-Frame-Options', 'DENY'],
  ['Referrer-Policy', 'no-referrer'],
  ['Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'"],
];

// One year, no `includeSubDomains`: this host does not own its siblings.
const HSTS = 'max-age=31536000';

/**
 * `hsts` is for production behind HTTPS. Browsers ignore the header over plain
 * HTTP, but a developer's HTTPS localhost would stay pinned for a year.
 */
export function securityHeaders({ hsts }: { hsts: boolean }) {
  return (_request: Request, response: Response, next: NextFunction): void => {
    for (const [name, value] of HEADERS) response.setHeader(name, value);
    if (hsts) response.setHeader('Strict-Transport-Security', HSTS);
    next();
  };
}
