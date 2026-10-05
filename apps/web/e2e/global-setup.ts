import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { apiEnv } from "./env";

/**
 * Back to the seed before every run, the way the API's e2e suite does it
 * (`prisma migrate deploy`, then `prisma/seed.ts`). Not a TRUNCATE of
 * everything: the web server is already up and its cached course pages carry
 * course and lesson ids, so the seeded rows keep theirs (the seed upserts by
 * email and slug). Only what a run creates or changes goes: orders, grants,
 * progress, sessions, and the `e2e-` accounts and courses.
 */
const RESET_SQL = `
TRUNCATE payment_attempts, purchases, enrollments, lesson_progress, sessions,
  auth_tokens, audit_logs CASCADE;
DELETE FROM courses WHERE slug LIKE 'e2e-%';
DELETE FROM users WHERE email LIKE 'e2e-%';
`;

export default function globalSetup(): void {
  const apiDirectory = resolve(__dirname, "../../api");
  const resolveFromApi = createRequire(resolve(apiDirectory, "package.json"))
    .resolve;
  const run = (args: string[], input?: string) =>
    execFileSync(process.execPath, args, {
      cwd: apiDirectory,
      env: { ...process.env, ...apiEnv },
      input,
      stdio: [input === undefined ? "ignore" : "pipe", "inherit", "inherit"],
    });

  const prisma = resolveFromApi("prisma/build/index.js");
  run([prisma, "migrate", "deploy"]);
  run([prisma, "db", "execute", "--stdin"], RESET_SQL);
  run([resolveFromApi("tsx/cli"), "prisma/seed.ts"]);
}
