import 'dotenv/config';
import {
  assertDriverValuesAreKnown,
  assertNoDemoDriversInProduction,
} from './config/drivers.js';

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

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  assertDriverValuesAreKnown(env);
  assertNoDemoDriversInProduction(env);

  const jwtSecret = required(env, 'AUTH_JWT_SECRET');
  if (Buffer.byteLength(jwtSecret) < 32) {
    throw new Error('AUTH_JWT_SECRET must contain at least 32 bytes');
  }

  const videoDriver = env.VIDEO_DRIVER ?? 'demo';
  const storageDriver = env.STORAGE_DRIVER ?? 'demo';
  const mailDriver = env.MAIL_DRIVER ?? 'demo';
  const paymentDriver = env.PAYMENT_DRIVER ?? 'demo';

  return Object.freeze({
    databaseUrl: required(env, 'DATABASE_URL'),
    port: integer(env, 'PORT', 3001),
    nodeEnv: env.NODE_ENV ?? 'development',
    timezone: env.TZ ?? 'Asia/Ho_Chi_Minh',
    webOrigin: env.WEB_ORIGIN ?? 'http://localhost:3000',
    apiPublicUrl: env.API_PUBLIC_URL ?? 'http://localhost:3001',
    jwtSecret,
    videoDriver,
    storageDriver,
    mailDriver,
    paymentDriver,
    demoVideoUrl: env.DEMO_VIDEO_URL ?? '/demo/sample.mp4',
    demoVideoDurationSeconds: integer(env, 'DEMO_VIDEO_DURATION_SECONDS', 30),
    storageLocalDir: env.STORAGE_LOCAL_DIR ?? '.storage',
    mailFrom: env.MAIL_FROM ?? 'E-learning <no-reply@localhost>',
    localMailDir: env.LOCAL_MAIL_DIR ?? '.mail',
    cloudflareAccountId: env.CLOUDFLARE_ACCOUNT_ID ?? '',
    cloudflareStreamApiToken: env.CLOUDFLARE_STREAM_API_TOKEN ?? '',
    cloudflareStreamSigningKeyId: env.CLOUDFLARE_STREAM_SIGNING_KEY_ID ?? '',
    cloudflareStreamSigningKeyPem: env.CLOUDFLARE_STREAM_SIGNING_KEY_PEM ?? '',
    cloudflareStreamAllowedOrigins: env.CLOUDFLARE_STREAM_ALLOWED_ORIGINS ?? '',
    playbackTokenTtlSeconds: integer(env, 'PLAYBACK_TOKEN_TTL_SECONDS', 3_600),
    r2Endpoint: env.R2_ENDPOINT ?? '',
    r2Bucket: env.R2_BUCKET ?? '',
    r2AccessKeyId: env.R2_ACCESS_KEY_ID ?? '',
    r2SecretAccessKey: env.R2_SECRET_ACCESS_KEY ?? '',
    r2PublicBaseUrl: env.R2_PUBLIC_BASE_URL ?? '',
    signedFileTtlSeconds: integer(env, 'SIGNED_FILE_TTL_SECONDS', 300),
    maxUploadBytes: integer(env, 'MAX_UPLOAD_BYTES', 52_428_800),
    smtpUrl: env.SMTP_URL ?? '',
    emailVerifyTtlMinutes: integer(env, 'EMAIL_VERIFY_TTL_MINUTES', 1_440),
    passwordResetTtlMinutes: integer(env, 'PASSWORD_RESET_TTL_MINUTES', 60),
    zalopayAppId: env.ZALOPAY_APP_ID ?? '',
    zalopayKey1: env.ZALOPAY_KEY1 ?? '',
    zalopayKey2: env.ZALOPAY_KEY2 ?? '',
    zalopayEndpoint: env.ZALOPAY_ENDPOINT ?? 'https://sb-openapi.zalopay.vn/v2',
    zalopayCallbackUrl: env.ZALOPAY_CALLBACK_URL ?? '',
    checkoutQrTtlMinutes: integer(env, 'CHECKOUT_QR_TTL_MINUTES', 15),
    reconcileIntervalSeconds: integer(env, 'RECONCILE_INTERVAL', 60),
    reconcileMinAgeSeconds: integer(env, 'RECONCILE_MIN_AGE', 120),
    railwayEnvironmentId: env.RAILWAY_ENVIRONMENT_ID ?? '',
  });
}

process.env.TZ ??= 'Asia/Ho_Chi_Minh';
export const config = loadConfig();
