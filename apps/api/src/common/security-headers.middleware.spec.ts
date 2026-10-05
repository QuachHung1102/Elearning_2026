import { securityHeaders } from './security-headers.middleware.js';

function run(options: { hsts: boolean }) {
  const setHeader = vi.fn();
  const next = vi.fn();
  securityHeaders(options)({} as never, { setHeader } as never, next);
  expect(next).toHaveBeenCalledOnce();
  return new Map(setHeader.mock.calls as Array<[string, string]>);
}

describe('securityHeaders (ROADMAP A5.1)', () => {
  it('forbids sniffing, framing and referrers, and lets nothing it sends load or run anything', () => {
    const headers = run({ hsts: false });

    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('X-Frame-Options')).toBe('DENY');
    expect(headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(headers.get('Content-Security-Policy')).toBe(
      "default-src 'none'; frame-ancestors 'none'",
    );
  });

  it('pins the browser to HTTPS only when asked, because a plain-HTTP dev server must not be pinned', () => {
    expect(run({ hsts: false }).has('Strict-Transport-Security')).toBe(false);
    expect(run({ hsts: true }).get('Strict-Transport-Security')).toBe(
      'max-age=31536000',
    );
  });
});
