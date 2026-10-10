import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

/**
 * REVIEW F-28, ROADMAP N5.2: the seed wipes and rewrites demo accounts, so it
 * must refuse a production environment. The database it is
 * pointed at cannot be reached: a seed that got past the guard dies on the
 * connection, with a different message, instead of touching anything.
 */
const tsx = createRequire(import.meta.url).resolve('tsx/cli');
const UNREACHABLE = 'postgresql://nobody:nothing@127.0.0.1:1/none';

function seed(env: Record<string, string>) {
  const result = spawnSync(process.execPath, [tsx, 'prisma/seed.ts'], {
    cwd: resolve(import.meta.dirname, '..'),
    env: {
      ...process.env,
      NODE_ENV: 'development',
      DATABASE_URL: UNREACHABLE,
      ...env,
    },
    encoding: 'utf8',
    timeout: 60_000,
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

describe('the seed refuses a production database', () => {
  it('when NODE_ENV says production', () => {
    const { status, output } = seed({ NODE_ENV: 'production' });

    expect(status).not.toBe(0);
    expect(output).toContain('Refusing to seed a production database');
  });

  it('does not mistake development for production', () => {
    const { output } = seed({});

    expect(output).not.toContain('Refusing to seed');
  });
});
