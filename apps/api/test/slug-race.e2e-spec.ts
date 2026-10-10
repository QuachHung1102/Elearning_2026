import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { as, bootApp, createUser, signIn, truncateAll, warmPool, type Session } from './support.js';

/**
 * REVIEW F-06, plan T2.5: a slug is picked by reading which ones are taken and
 * then inserting, so two writers with the same title read the same answer.
 * Whoever loses the unique index must not see a 500 or a bare conflict for a
 * title that was perfectly good a millisecond earlier.
 */
describe('two writers, one slug (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: Awaited<ReturnType<typeof bootApp>>['prisma'];
  let admin: Session;

  beforeAll(async () => {
    ({ app, prisma } = await bootApp());
  });

  beforeEach(async () => {
    await truncateAll(prisma);
    admin = await signIn(app, (await createUser(prisma, 'ADMIN')).email);
    // A cold pool serves the first request at once and makes the rest wait, so the race never happens.
    await warmPool(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  const create = (path: string, body: object) =>
    request(app.getHttpServer()).post(`/api/v1/admin${path}`).set(as(admin)).send(body);

  describe.each([
    ['courses', '/courses', { title: 'Lập trình Go' }, 'lap-trinh-go'],
    ['categories', '/categories', { name: 'Thiết kế' }, 'thiet-ke'],
  ])('%s', (_label, path, body, base) => {
    it('gives six simultaneous writers of one title six different slugs, none of them an error', async () => {
      const results = await Promise.all(Array.from({ length: 6 }, () => create(path, body)));

      expect(results.map((response) => response.status)).toEqual(Array(6).fill(201));
      const slugs = results.map((response) => response.body.slug as string);
      expect(new Set(slugs).size).toBe(6);
      expect(slugs).toContain(base);
      for (const slug of slugs) expect(slug).toMatch(new RegExp(`^${base}(-\\d+)?$`));
    });

    it('gives one of four simultaneous writers of one explicit slug that slug, and tells the others it is taken', async () => {
      const results = await Promise.all(
        Array.from({ length: 4 }, () => create(path, { ...body, slug: 'ten-co-dinh' })),
      );

      expect(results.map((response) => response.status).sort()).toEqual([201, 409, 409, 409]);
      for (const refused of results.filter((response) => response.status === 409)) {
        expect(refused.body.code).toBe('SLUG_TAKEN');
      }
    });
  });
});
