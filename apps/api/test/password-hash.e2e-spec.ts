import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import {
  PASSWORD,
  as,
  bootApp,
  cookieJar,
  createCourse,
  createUser,
  signIn,
  truncateAll,
  type Session,
} from './support.js';

/**
 * API_CONTRACT.md §6.2, REVIEW F-30: the password hash never leaves the
 * database. The first layer is the Prisma client itself, which leaves the
 * column out of every query that does not ask for it; the last is a walk over
 * what the API answers.
 */
describe('the password hash (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: Awaited<ReturnType<typeof bootApp>>['prisma'];

  beforeAll(async () => {
    ({ app, prisma } = await bootApp());
  });

  beforeEach(async () => {
    await truncateAll(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('in the Prisma client', () => {
    it('is left out of a user query that does not ask for it', async () => {
      const { id } = await createUser(prisma, 'STUDENT');

      const row = await prisma.user.findUniqueOrThrow({ where: { id } });

      expect(row).not.toHaveProperty('passwordHash');
      expect(row.email).toEqual(expect.any(String));
    });

    it('is left out when a user comes through a relation', async () => {
      const { id } = await createUser(prisma, 'STUDENT');
      await prisma.session.create({ data: { userId: id, expiresAt: new Date(Date.now() + 60_000) } });

      const session = await prisma.session.findFirstOrThrow({ include: { user: true } });

      expect(session.user).not.toHaveProperty('passwordHash');
    });

    it('comes back only for the query that says so', async () => {
      const { id } = await createUser(prisma, 'STUDENT');

      const row = await prisma.user.findUniqueOrThrow({ where: { id }, omit: { passwordHash: false } });

      expect(row.passwordHash).toMatch(/^scrypt-v\d\$/);
    });
  });

  describe('in what the API answers', () => {
    async function hashesInTheDatabase() {
      const users = await prisma.user.findMany({ omit: { passwordHash: false } });
      return users.map((user) => user.passwordHash);
    }

    it('is in no successful response, and neither is any hash the database holds', async () => {
      const student = await createUser(prisma, 'STUDENT');
      const admin = await createUser(prisma, 'ADMIN');
      const instructor = await createUser(prisma, 'INSTRUCTOR');
      const course = await createCourse(prisma);
      const learner = await signIn(app, student.email);
      const owner = await signIn(app, admin.email);
      const teacher = await signIn(app, instructor.email);
      const csrf = await request(app.getHttpServer()).get('/api/v1/auth/csrf');
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('X-Real-IP', '198.51.100.90')
        .set('Cookie', cookieJar(csrf.headers['set-cookie']).join('; '))
        .set('X-CSRF-Token', csrf.body.csrfToken)
        .send({ email: student.email, password: PASSWORD })
        .expect(200);

      const walk = async (session: Session, paths: string[]) =>
        Promise.all(
          paths.map(async (path) => {
            const response = await request(app.getHttpServer()).get(`/api/v1${path}`).set(as(session));
            expect(response.status, path).toBeLessThan(300);
            return response.text;
          }),
        );
      const bodies = [
        login.text,
        ...(await walk(learner, ['/auth/me', '/users/me/sessions', '/enrollments/me', '/purchases/me', '/courses', `/courses/${course.slug}`])),
        ...(await walk(owner, [
          '/admin/users',
          `/admin/users/${student.id}`,
          `/admin/users/${instructor.id}`,
          '/admin/enrollments',
          '/admin/payments',
          '/admin/courses',
          `/admin/courses/${course.id}`,
          '/admin/audit-logs',
          '/admin/reports/overview',
        ])),
        ...(await walk(teacher, ['/auth/me', '/admin/courses'])),
      ];

      const hashes = await hashesInTheDatabase();
      expect(hashes).toHaveLength(3);
      for (const body of bodies) {
        expect(body).not.toContain('passwordHash');
        for (const hash of hashes) expect(body).not.toContain(hash);
      }
    });
  });
});
