import { defineConfig } from "vitest/config";

/**
 * Pure-function specs only. The XSS boundary in `src/lib/markdown.ts` is not a
 * place to postpone a test to phase 5; browser-level checks still wait for
 * Playwright then.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.spec.ts"],
    environment: "node",
  },
});
