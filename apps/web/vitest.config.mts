import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Pure-function specs only. The XSS boundary in `src/lib/markdown.ts` is not a
 * place to postpone a test to phase 5; browser-level checks still wait for
 * Playwright then.
 */
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["src/**/*.spec.ts"],
    environment: "node",
  },
});
