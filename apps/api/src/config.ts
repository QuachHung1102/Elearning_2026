import 'dotenv/config';
import {
  assertDriverValuesAreKnown,
  assertNoDemoDriversInProduction,
} from './config/drivers.js';
import {
  assertNoTestSettingsInProduction,
  isProductionEnv,
} from './config/production.js';

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function integer(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
): number {
  const raw = env[name];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

// Not a secret: the demo driver signs and verifies its own callbacks with it.
// `assertNoDemoDriversInProduction` keeps it out of production.
const DEMO_ZALOPAY_KEY2 = 'demo-zalopay-key2-not-a-secret';
// Not a secret either: outside production a forged visitor IP costs nothing.
const DEV_INTERNAL_API_SECRET = 'dev-internal-api-secret-not-a-secret';

/** Shared with the web server so it can name the visitor behind its fetches (`clientIp`). */
function internalApiSecret(env: NodeJS.ProcessEnv): string {
  if (!isProductionEnv(env)) {
    return env.INTERNAL_API_SECRET || DEV_INTERNAL_API_SECRET;
  }
  const secret = required(env, 'INTERNAL_API_SECRET');
  if (Buffer.byteLength(secret) < 32) {
    throw new Error('INTERNAL_API_SECRET must contain at least 32 bytes');
  }
  return secret;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  assertDriverValuesAreKnown(env);
  assertNoDemoDriversInProduction(env);
  assertNoTestSettingsInProduction(env);

  const jwtSecret = required(env, 'AUTH_JWT_SECRET');
  if (Buffer.byteLength(jwtSecret) < 32) {
    throw new Error('AUTH_JWT_SECRET must contain at least 32 bytes');
  }

  const videoDriver = env.VIDEO_DRIVER ?? 'demo';
  const storageDriver = env.STORAGE_DRIVER ?? 'demo';
  const mailDriver = env.MAIL_DRIVER ?? 'demo';
  const paymentDriver = env.PAYMENT_DRIVER ?? 'demo';
  // An empty key2 lets anyone compute a valid callback MAC, so the real driver
  // refuses to boot without every credential (P4-9).
  const zalopay = (name: string) =>
    paymentDriver === 'zalopay' ? required(env, name) : (env[name] ?? '');

  return Object.freeze({
    databaseUrl: required(env, 'DATABASE_URL'),
    port: integer(env, 'PORT', 3001),
    isProduction: isProductionEnv(env),
    // One line per finished request (`requestLog`); the tests switch it off.
    logRequests: env.LOG_REQUESTS !== 'false',
    timezone: env.TZ ?? 'Asia/Ho_Chi_Minh',
    webOrigin: env.WEB_ORIGIN ?? 'http://localhost:3000',
    apiPublicUrl: env.API_PUBLIC_URL ?? 'http://localhost:3001',
    jwtSecret,
    videoDriver,
    storageDriver,
    mailDriver,
    paymentDriver,
    // `LocalFileController` (and the raw-body parser in front of it) exists
    // unless both drivers are real: the route is absent, not merely guarded.
    servesLocalFiles: !(storageDriver === 'r2' && videoDriver === 'cloudflare'),
    // Relative to the apps/api working directory; served only through a signed,
    // viewer-bound URL, never from a public folder.
    demoVideoFile: env.DEMO_VIDEO_FILE ?? 'assets/demo/sample.mp4',
    demoVideoDurationSeconds: integer(env, 'DEMO_VIDEO_DURATION_SECONDS', 60),
    storageLocalDir: env.STORAGE_LOCAL_DIR ?? '.storage',
    mailFrom:
      mailDriver === 'smtp'
        ? required(env, 'MAIL_FROM')
        : (env.MAIL_FROM ?? 'E-learning <no-reply@localhost>'),
    localMailDir: env.LOCAL_MAIL_DIR ?? '.mail',
    cloudflareAccountId: env.CLOUDFLARE_ACCOUNT_ID ?? '',
    cloudflareStreamApiToken: env.CLOUDFLARE_STREAM_API_TOKEN ?? '',
    cloudflareStreamSigningKeyId: env.CLOUDFLARE_STREAM_SIGNING_KEY_ID ?? '',
    cloudflareStreamSigningKeyPem: env.CLOUDFLARE_STREAM_SIGNING_KEY_PEM ?? '',
    playbackTokenTtlSeconds: integer(env, 'PLAYBACK_TOKEN_TTL_SECONDS', 3_600),
    r2Endpoint: env.R2_ENDPOINT ?? '',
    r2Bucket: env.R2_BUCKET ?? '',
    r2AccessKeyId: env.R2_ACCESS_KEY_ID ?? '',
    r2SecretAccessKey: env.R2_SECRET_ACCESS_KEY ?? '',
    r2PublicBaseUrl: env.R2_PUBLIC_BASE_URL ?? '',
    signedFileTtlSeconds: integer(env, 'SIGNED_FILE_TTL_SECONDS', 300),
    maxUploadBytes: integer(env, 'MAX_UPLOAD_BYTES', 52_428_800),
    smtpUrl:
      mailDriver === 'smtp' ? required(env, 'SMTP_URL') : (env.SMTP_URL ?? ''),
    emailVerifyTtlMinutes: integer(env, 'EMAIL_VERIFY_TTL_MINUTES', 1_440),
    passwordResetTtlMinutes: integer(env, 'PASSWORD_RESET_TTL_MINUTES', 60),
    zalopayAppId: zalopay('ZALOPAY_APP_ID'),
    zalopayKey1: zalopay('ZALOPAY_KEY1'),
    zalopayKey2: zalopay('ZALOPAY_KEY2') || DEMO_ZALOPAY_KEY2,
    zalopayEndpoint: env.ZALOPAY_ENDPOINT ?? 'https://sb-openapi.zalopay.vn/v2',
    zalopayCallbackUrl: zalopay('ZALOPAY_CALLBACK_URL'),
    checkoutQrTtlMinutes: integer(env, 'CHECKOUT_QR_TTL_MINUTES', 15),
    reconcileIntervalSeconds: integer(env, 'RECONCILE_INTERVAL', 60),
    reconcileMinAgeSeconds: integer(env, 'RECONCILE_MIN_AGE', 120),
    railwayEnvironmentId: env.RAILWAY_ENVIRONMENT_ID ?? '',
    internalApiSecret: internalApiSecret(env),
  });
}

process.env.TZ ??= 'Asia/Ho_Chi_Minh';
export const config = loadConfig();
