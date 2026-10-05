import type { NestExpressApplication } from '@nestjs/platform-express';
import { bootApp } from './support.js';

/**
 * REVIEW F-31: an index that a query needs and the schema forgot. Read from
 * Postgres itself, after the migrations have been applied, not from the schema
 * file, which is exactly what could be out of step.
 */
describe('indexes the queries depend on (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: Awaited<ReturnType<typeof bootApp>>['prisma'];

  beforeAll(async () => {
    ({ app, prisma } = await bootApp());
  });

  afterAll(async () => {
    await app.close();
  });

  async function indexesOn(table: string): Promise<string[]> {
    const rows = await prisma.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = ${table}`;
    return rows.map((row) => row.indexdef);
  }

  it('finds the progress of a lesson without reading the whole table, which is what deleting a lesson asks', async () => {
    const definitions = await indexesOn('lesson_progress');

    expect(definitions.some((definition) => /\(lesson_id\)/.test(definition))).toBe(true);
  });
});
