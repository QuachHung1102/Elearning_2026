import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import dotenv from 'dotenv';

export function setup(): void {
  const apiDirectory = resolve(import.meta.dirname, '..');
  dotenv.config({ path: resolve(apiDirectory, '.env.test'), override: true });
  const prismaCli = createRequire(import.meta.url).resolve(
    'prisma/build/index.js',
  );
  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: apiDirectory,
    env: process.env,
    stdio: 'inherit',
  });
}
