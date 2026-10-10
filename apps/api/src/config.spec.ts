import { loadConfig } from './config.js';

const valid = {
  DATABASE_URL: 'postgresql://localhost/test',
  AUTH_JWT_SECRET: 'a'.repeat(32),
};

const REAL_SMTP = {
  SMTP_URL: 'smtps://user:secret@smtp.example.test:465',
  MAIL_FROM: 'E-learning <no-reply@example.test>',
};

describe('loadConfig', () => {
  it('fails with the missing variable name', () => {
    expect(() =>
      loadConfig({ AUTH_JWT_SECRET: valid.AUTH_JWT_SECRET }),
    ).toThrow(/DATABASE_URL/);
  });

  it('rejects a short JWT secret', () => {
    expect(() =>
      loadConfig({ ...valid, AUTH_JWT_SECRET: 'too-short' }),
    ).toThrow(/AUTH_JWT_SECRET/);
  });

  describe('logRequests', () => {
    it('is on unless it is switched off', () => {
      expect(loadConfig(valid).logRequests).toBe(true);
      expect(loadConfig({ ...valid, LOG_REQUESTS: 'true' }).logRequests).toBe(true);
    });

    it('is off for LOG_REQUESTS=false', () => {
      expect(loadConfig({ ...valid, LOG_REQUESTS: 'false' }).logRequests).toBe(false);
    });
  });

  it('refuses to boot in production with the test-only password cost', () => {
    const production = {
      ...valid,
      NODE_ENV: 'production',
      VIDEO_DRIVER: 'cloudflare',
      STORAGE_DRIVER: 'r2',
      MAIL_DRIVER: 'smtp',
      ...REAL_SMTP,
      PAYMENT_DRIVER: 'zalopay',
      ZALOPAY_APP_ID: '2553',
      ZALOPAY_KEY1: 'key-one',
      ZALOPAY_KEY2: 'key-two',
      ZALOPAY_CALLBACK_URL: 'https://example.com/api/v1/payments/zalopay/callback',
      INTERNAL_API_SECRET: 'c'.repeat(32),
    };

    expect(() => loadConfig(production)).not.toThrow();
    expect(() => loadConfig({ ...production, PASSWORD_HASH_COST: 'test' })).toThrow(/PASSWORD_HASH_COST/);
  });

  // T4.17: the Next server vouches for the visitor IP with this secret.
  describe('internalApiSecret', () => {
    const production = {
      ...valid,
      NODE_ENV: 'production',
      VIDEO_DRIVER: 'cloudflare',
      STORAGE_DRIVER: 'r2',
      MAIL_DRIVER: 'smtp',
      ...REAL_SMTP,
      PAYMENT_DRIVER: 'zalopay',
      ZALOPAY_APP_ID: '2553',
      ZALOPAY_KEY1: 'key-one',
      ZALOPAY_KEY2: 'key-two',
      ZALOPAY_CALLBACK_URL: 'https://example.com/api/v1/payments/zalopay/callback',
    };

    it('has a fixed default outside production', () => {
      expect(loadConfig(valid).internalApiSecret).toBe('dev-internal-api-secret-not-a-secret');
    });

    it('is required in production', () => {
      expect(() => loadConfig(production)).toThrow(/INTERNAL_API_SECRET/);
    });

    it('must be at least 32 bytes in production', () => {
      expect(() => loadConfig({ ...production, INTERNAL_API_SECRET: 'short' })).toThrow(
        /INTERNAL_API_SECRET/,
      );
      expect(
        loadConfig({ ...production, INTERNAL_API_SECRET: 'b'.repeat(32) }).internalApiSecret,
      ).toBe('b'.repeat(32));
    });
  });

  // REVIEW F-28: one answer to "is this production?" for the cookie flag, HSTS and the seed.
  describe('isProduction', () => {
    const allReal = {
      ...valid,
      VIDEO_DRIVER: 'cloudflare',
      STORAGE_DRIVER: 'r2',
      MAIL_DRIVER: 'smtp',
      ...REAL_SMTP,
      PAYMENT_DRIVER: 'zalopay',
      ZALOPAY_APP_ID: '2553',
      ZALOPAY_KEY1: 'key-one',
      ZALOPAY_KEY2: 'key-two',
      ZALOPAY_CALLBACK_URL: 'https://example.com/api/v1/payments/zalopay/callback',
      INTERNAL_API_SECRET: 'c'.repeat(32),
    };

    it('is off in development', () => {
      expect(loadConfig(valid).isProduction).toBe(false);
    });

    it('is on when NODE_ENV says production', () => {
      expect(loadConfig({ ...allReal, NODE_ENV: 'production' }).isProduction).toBe(true);
    });
  });

  // P4-9: an empty key2 means anyone can compute a valid MAC.
  describe('ZaloPay credentials', () => {
    const real = {
      ...valid,
      PAYMENT_DRIVER: 'zalopay',
      ZALOPAY_APP_ID: '2553',
      ZALOPAY_KEY1: 'key-one',
      ZALOPAY_KEY2: 'key-two',
      ZALOPAY_CALLBACK_URL: 'https://example.com/api/v1/payments/zalopay/callback',
    };

    it('gives the demo driver a fixed key2 even when the variable is empty', () => {
      expect(loadConfig(valid).zalopayKey2).not.toBe('');
      expect(loadConfig({ ...valid, ZALOPAY_KEY2: '' }).zalopayKey2).not.toBe('');
    });

    it('lets an explicit key2 win over the demo one', () => {
      expect(
        loadConfig({ ...valid, ZALOPAY_KEY2: 'sandbox-key2' }).zalopayKey2,
      ).toBe('sandbox-key2');
    });

    it('loads the real driver when every credential is present', () => {
      expect(loadConfig(real)).toMatchObject({
        zalopayAppId: '2553',
        zalopayKey1: 'key-one',
        zalopayKey2: 'key-two',
      });
    });

    it.each([
      'ZALOPAY_APP_ID',
      'ZALOPAY_KEY1',
      'ZALOPAY_KEY2',
      'ZALOPAY_CALLBACK_URL',
    ])('refuses the real driver without %s', (name) => {
      expect(() => loadConfig({ ...real, [name]: '' })).toThrow(name);
      expect(() => loadConfig({ ...real, [name]: undefined })).toThrow(name);
    });
  });

  describe('servesLocalFiles', () => {
    it('is on for the demo drivers', () => {
      expect(loadConfig(valid).servesLocalFiles).toBe(true);
    });

    it('stays on when only one of the two drivers is real (the demo video)', () => {
      expect(
        loadConfig({ ...valid, STORAGE_DRIVER: 'r2' }).servesLocalFiles,
      ).toBe(true);
      expect(
        loadConfig({ ...valid, VIDEO_DRIVER: 'cloudflare' }).servesLocalFiles,
      ).toBe(true);
    });

    it('is off only when both drivers are real', () => {
      expect(
        loadConfig({
          ...valid,
          STORAGE_DRIVER: 'r2',
          VIDEO_DRIVER: 'cloudflare',
        }).servesLocalFiles,
      ).toBe(false);
    });
  });

  // T4.12a: SmtpMailer cannot send without a server and a sender.
  describe('SMTP credentials', () => {
    const production = {
      ...valid,
      NODE_ENV: 'production',
      VIDEO_DRIVER: 'cloudflare',
      STORAGE_DRIVER: 'r2',
      MAIL_DRIVER: 'smtp',
      ...REAL_SMTP,
      PAYMENT_DRIVER: 'zalopay',
      ZALOPAY_APP_ID: '2553',
      ZALOPAY_KEY1: 'key-one',
      ZALOPAY_KEY2: 'key-two',
      ZALOPAY_CALLBACK_URL: 'https://example.com/api/v1/payments/zalopay/callback',
      INTERNAL_API_SECRET: 'c'.repeat(32),
    };

    it('boots in production when both are present', () => {
      expect(loadConfig(production)).toMatchObject({
        smtpUrl: REAL_SMTP.SMTP_URL,
        mailFrom: REAL_SMTP.MAIL_FROM,
      });
    });

    it.each(['SMTP_URL', 'MAIL_FROM'])('refuses to boot in production without %s', (name) => {
      expect(() => loadConfig({ ...production, [name]: '' })).toThrow(name);
      expect(() => loadConfig({ ...production, [name]: undefined })).toThrow(name);
    });

    it('keeps the demo defaults for MAIL_DRIVER=demo', () => {
      expect(loadConfig(valid)).toMatchObject({
        smtpUrl: '',
        mailFrom: 'E-learning <no-reply@localhost>',
      });
    });
  });
});
