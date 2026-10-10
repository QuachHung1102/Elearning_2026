import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { as, bootApp, createCourse, createUser, signIn, truncateAll } from './support.js';

/**
 * REVIEW F-31: courses that tie on the sort key must still come back in one
 * fixed order, or a page boundary can repeat a course and skip another.
 */
describe('the admin course list (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: Awaited<ReturnType<typeof bootApp>>['prisma'];

  beforeAll(async () => {
    ({ app, prisma } = await bootApp());
    await truncateAll(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(['title:asc', 'title:desc', 'enrollmentCount:desc'])(
    'orders courses that tie on %s by id, so paging walks every one exactly once',
    async (sort) => {
      await truncateAll(prisma);
      const admin = await signIn(app, (await createUser(prisma, 'ADMIN')).email);
      // createCourse gives every course the same title, and none has an enrollment.
      const ids: string[] = [];
      for (let course = 0; course < 5; course += 1) ids.push((await createCourse(prisma)).id);

      const walked: string[] = [];
      for (const page of [1, 2, 3]) {
        const response = await request(app.getHttpServer())
          .get(`/api/v1/admin/courses?sort=${sort}&pageSize=2&page=${page}`)
          .set(as(admin))
          .expect(200);
        walked.push(...response.body.items.map((item: { id: string }) => item.id));
      }

      expect(walked).toHaveLength(5);
      expect(walked).toEqual([...ids].sort());
    },
  );
});
