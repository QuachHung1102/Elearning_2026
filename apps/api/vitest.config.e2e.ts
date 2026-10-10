import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    setupFiles: ['./test/setup-e2e.ts'],
    globalSetup: ['./test/global-setup.ts'],
    fileParallelism: false,
    // Sign-ins hash with scrypt and the course builders make many requests, so
    // a test sits near vitest's 5 s default and a busy machine tips it over.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
