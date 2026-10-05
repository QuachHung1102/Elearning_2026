import { createRequire } from 'node:module';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import {
  as,
  bootApp,
  createCourse,
  createUser,
  signIn,
  truncateAll,
  type Session,
} from './support.js';

/**
 * REVIEW F-14 / T2.6: the enrollment lists cost a fixed number of SQL
 * statements whatever the page holds, and `/enrollments/me` reads one page of
 * rows, not every enrollment the learner has. Measured on the `pg` client the
 * Prisma adapter drives, so every statement is seen, Prisma's own included.
 */
const require = createRequire(createRequire(import.meta.url).resolve('@prisma/adapter-pg'));
type Query = (this: unknown, ...args: unknown[]) => unknown;
type Result = { rows?: unknown[] } | undefined;
const { Client } = require('pg') as { Client: { prototype: { query: Query } } };

describe('Enrollment list queries (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let admin: Session;
  let learner: Session;
  let courseId: string;

  /** `MEASURE=1` prints what `measure` saw, for a before/after comparison. */
  const report = (name: string, runs: Record<string, { statements: number; rows: number }>) => {
    if (!process.env.MEASURE) return;
    const summary = Object.entries(runs).map(([run, { statements, rows }]) => `${run}: ${statements} statements, ${rows} rows`);
    process.stderr.write(`${name} -> ${summary.join('; ')}
`);
  };

  /** SQL statements and rows read while serving one request. */
  async function measure(session: Session, path: string) {
    const original = Client.prototype.query;
    let statements = 0;
    let rows = 0;
    const count = (result: Result) => {
      rows += result?.rows?.length ?? 0;
    };
    // `pg.Pool#query` hands the client a callback; a transaction awaits a promise.
    const spy = vi
      .spyOn(Client.prototype, 'query')
      .mockImplementation(function (this: unknown, ...args: unknown[]) {
        statements += 1;
        const callback = args.at(-1);
        if (typeof callback === 'function') {
          args[args.length - 1] = (error: unknown, result: Result) => {
            count(result);
            return callback(error, result);
          };
          return original.apply(this, args);
        }
        const pending = original.apply(this, args) as Promise<Result>;
        pending.then(count, () => undefined);
        return pending;
      });
    try {
      const response = await request(app.getHttpServer())
        .get(`/api/v1${path}`)
        .set(as(session))
        .expect(200);
      return { statements, rows, body: response.body };
    } finally {
      spy.mockRestore();
    }
  }

  /** A published course with `lessons` lessons in one section. */
  async function course(lessons: number) {
    const created = await createCourse(prisma);
    await prisma.section.create({
      data: {
        courseId: created.id,
        title: 'Chương',
        position: 1,
        lessons: {
          create: Array.from({ length: lessons }, (_, index) => ({
            title: `Bài ${index + 1}`,
            type: 'ARTICLE' as const,
            position: index + 1,
          })),
        },
      },
    });
    return created;
  }

  beforeAll(async () => {
    ({ app, prisma } = await bootApp());
    await truncateAll(prisma);
    const boss = await createUser(prisma, 'ADMIN');
    const student = await createUser(prisma, 'STUDENT');
    admin = await signIn(app, boss.email);
    learner = await signIn(app, student.email);

    // Twelve learners in one course, each with one completed lesson.
    const shared = await course(3);
    courseId = shared.id;
    const [firstLesson] = await prisma.lesson.findMany({
      where: { section: { courseId } },
      orderBy: { position: 'asc' },
    });
    for (let i = 0; i < 12; i += 1) {
      const user = await createUser(prisma, 'STUDENT');
      await prisma.enrollment.create({
        data: { userId: user.id, courseId, source: 'MANUAL_GRANT' },
      });
      await prisma.lessonProgress.create({
        data: { userId: user.id, lessonId: firstLesson.id, completedAt: new Date() },
      });
    }

    // One learner in twelve courses of five lessons.
    for (let i = 0; i < 12; i += 1) {
      const owned = await course(5);
      await prisma.enrollment.create({
        data: { userId: student.id, courseId: owned.id, source: 'MANUAL_GRANT' },
      });
    }

    // Warm-up: the first authenticated request may touch the session row.
    await measure(admin, '/admin/enrollments?pageSize=1');
    await measure(learner, '/enrollments/me?pageSize=1');
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /admin/enrollments: the statement count does not grow with the page', async () => {
    const small = await measure(admin, `/admin/enrollments?courseId=${courseId}&pageSize=2`);
    const large = await measure(admin, `/admin/enrollments?courseId=${courseId}&pageSize=12`);
    expect(small.body.items).toHaveLength(2);
    expect(large.body.items).toHaveLength(12);
    expect(large.body.items[0].progress).toEqual({
      completedLessons: 1,
      totalLessons: 3,
      percent: 33,
    });
    report('admin enrollments', { pageSize2: small, pageSize12: large });
    expect(large.statements).toBe(small.statements);
  });

  it('GET /enrollments/me: reads one page of rows, at a fixed statement count', async () => {
    const small = await measure(learner, '/enrollments/me?pageSize=1');
    const large = await measure(learner, '/enrollments/me?pageSize=12');
    expect(small.body.total).toBe(12);
    expect(small.body.items).toHaveLength(1);
    expect(large.body.items).toHaveLength(12);
    report('enrollments/me', { pageSize1: small, pageSize12: large });
    expect(large.statements).toBe(small.statements);
    // Only the requested page is read from the database.
    expect(small.rows).toBeLessThan(large.rows);
  });
});
