import { defineConfig, devices } from "@playwright/test";
import { API_URL, WEB_URL, apiEnv, webEnv } from "./e2e/env";

/**
 * Browser e2e (ROADMAP.md A5.4): the production build of the web against the
 * built API, both on their own ports so a dev stack on 3000/3001 can keep
 * running. `e2e/global-setup.ts` puts the database back to the seed first.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "*.e2e.ts",
  globalSetup: "./e2e/global-setup.ts",
  // The four flows touch disjoint accounts, but one worker keeps the per-IP
  // rate limits (every request reaches the API from 127.0.0.1) far away.
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }]]
    : [["list"]],
  use: {
    baseURL: WEB_URL,
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Both are built on every run: NEXT_PUBLIC_CHECKOUT_ENABLED and the /api
  // rewrite target are baked in by `next build`. E2E_REUSE_SERVERS=1 reuses a
  // stack already listening on 3200/3201 instead (it must use the same env).
  webServer: [
    {
      command: "corepack pnpm build && node dist/main",
      cwd: "../api",
      url: `${API_URL}/api/v1/health`,
      env: apiEnv,
      timeout: 180_000,
      reuseExistingServer: Boolean(process.env.E2E_REUSE_SERVERS),
      stdout: "ignore",
      stderr: "pipe",
    },
    {
      command: "corepack pnpm build && corepack pnpm start --port 3200",
      url: WEB_URL,
      env: webEnv,
      timeout: 300_000,
      reuseExistingServer: Boolean(process.env.E2E_REUSE_SERVERS),
      stdout: "ignore",
      stderr: "pipe",
    },
  ],
});
