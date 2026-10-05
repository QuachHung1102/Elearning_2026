afterEach(() => {
  vi.doUnmock('../config.js');
  vi.resetModules();
});

/** The cookie options read `config` once, at import: load them against a chosen one. */
async function cookieOptions(isProduction: boolean) {
  vi.resetModules();
  vi.doMock('../config.js', () => ({ config: { isProduction } }));
  return import('./auth.constants.js');
}

describe('session and CSRF cookies (REVIEW F-28)', () => {
  it.each([true, false])(
    'are Secure exactly when config says production is %s',
    async (isProduction) => {
      const { AUTH_COOKIE_OPTIONS, CSRF_COOKIE_OPTIONS } =
        await cookieOptions(isProduction);

      expect(AUTH_COOKIE_OPTIONS.secure).toBe(isProduction);
      expect(CSRF_COOKIE_OPTIONS.secure).toBe(isProduction);
    },
  );

  it('keep the session cookie out of scripts and the CSRF cookie readable by the page', async () => {
    const { AUTH_COOKIE_OPTIONS, CSRF_COOKIE_OPTIONS } = await cookieOptions(true);

    expect(AUTH_COOKIE_OPTIONS).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/' });
    expect(CSRF_COOKIE_OPTIONS).toMatchObject({ httpOnly: false, sameSite: 'lax', path: '/' });
  });
});
