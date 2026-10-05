export const WEB_URL = "http://localhost:3200";
export const API_URL = "http://localhost:3201";

/** Its own database: global setup deletes rows in it. Never a dev database. */
const DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  "postgresql://elearning_test:elearning_test@localhost:5432/elearning_e2e";

/**
 * Set explicitly, so neither the CI job's env (built for the API's own e2e
 * suite on 3000/3001) nor `apps/api/.env` decides them: `dotenv/config` never
 * overrides a variable that is already set. Values mirror `apps/api/.env.test`.
 */
export const apiEnv: Record<string, string> = {
  DATABASE_URL,
  NODE_ENV: "test",
  PORT: "3201",
  AUTH_JWT_SECRET: "test-only-secret-at-least-32-bytes-long",
  // The browser only ever talks to the web origin; `/api/*` is rewritten to
  // the API. Signed media and upload URLs must point there too.
  WEB_ORIGIN: WEB_URL,
  API_PUBLIC_URL: WEB_URL,
  VIDEO_DRIVER: "demo",
  STORAGE_DRIVER: "demo",
  MAIL_DRIVER: "demo",
  PAYMENT_DRIVER: "demo",
  LOCAL_MAIL_DIR: ".mail/e2e",
  STORAGE_LOCAL_DIR: ".storage/e2e",
  LOG_REQUESTS: "false",
  PASSWORD_HASH_COST: "test",
  RECONCILE_INTERVAL: "86400",
};

/** Read by `next build` (baked in) and by `next start`. */
export const webEnv: Record<string, string> = {
  NODE_ENV: "production",
  API_ORIGIN: API_URL,
  NEXT_PUBLIC_SITE_URL: WEB_URL,
  NEXT_PUBLIC_CHECKOUT_ENABLED: "true",
};
