import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { hashPassword } from '../src/auth/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const PASSWORD = 'correct horse battery staple';

describe('Phase 3 enrollments (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  type Session = { cookies: string[]; token: string };

  // Login is limited to 10/60s per client IP; every sign-in gets its own.
  let clientIp = 0;
  const nextIp = () =>
    `10.2.${Math.floor(clientIp / 250)}.${(clientIp += 1) % 250}`;

  const jar = (value: string | string[] | undefined) =>
    (Array.isArray(value) ? value : value ? [value] : []).map(
      (cookie) => cookie.split(';')[0],
    );

  async function createUser(role: 'ADMIN' | 'STUDENT') {
    return prisma.user.create({
      data: {
        email: `${role.toLowerCase()}-${randomUUID()}@example.com`,
        passwordHash: await hashPassword(PASSWORD),
        displayName: role === 'ADMIN' ? 'Quản trị viên' : 'Học viên',
        role,
      },
      select: { id: true, email: true },
    });
  }

  async function signIn(email: string): Promise<Session> {
    const csrf = await request(app.getHttpServer())
      .get('/api/v1/auth/csrf')
      .expect(200);
    const csrfCookies = jar(csrf.headers['set-cookie']);
    const token = csrf.body.csrfToken as string;
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', csrfCookies.join('; '))
      .set('X-CSRF-Token', token)
      .set('X-Real-IP', nextIp())
      .send({ email, password: PASSWORD })
      .expect(200);
    return {
      cookies: [...csrfCookies, ...jar(response.headers['set-cookie'])],
      token,
    };
  }

  const as = (session: Session) => ({
    Cookie: session.cookies.join('; '),
    'X-CSRF-Token': session.token,
  });

  /** A course with two sections of two lessons each; `lessonCount` matches. */
  async function createCourse(status: 'PUBLISHED' | 'ARCHIVED' | 'DRAFT') {
    const slug = `khoa-${randomUUID().slice(0, 8)}`;
    return prisma.course.create({
      data: {
        slug,
        title: `Khóa ${slug}`,
        description: 'Mô tả',
        learningOutcomes: [],
        requirements: [],
        targetAudience: [],
        priceVnd: 499000,
        status,
        lessonCount: 4,
        sections: {
          create: [1, 2].map((section) => ({
            title: `Chương ${section}`,
            position: section,
            lessons: {
              create: [1, 2].map((lesson) => ({
                title: `Bài ${section}.${lesson}`,
                type: 'ARTICLE' as const,
                content: 'Nội dung',
                position: lesson,
              })),
            },
          })),
        },
      },
      include: {
        sections: {
          orderBy: { position: 'asc' },
          include: { lessons: { orderBy: { position: 'asc' } } },
        },
      },
    });
  }

  const grant = (session: Session, body: object) =>
    request(app.getHttpServer())
      .post('/api/v1/admin/enrollments')
      .set(as(session))
      .send(body);

  const mine = (session: Session, query = '') =>
    request(app.getHttpServer())
      .get(`/api/v1/enrollments/me${query}`)
      .set(as(session));

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
    `;
    const names = tables
      .map(({ tablename }) => `"${tablename.replaceAll('"', '""')}"`)
      .join(', ');
    if (names) {
      await prisma.$executeRawUnsafe(
        `TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`,
      );
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('grants once, answers a repeat with 200, and counts the learner once', async () => {
    const adminUser = await createUser('ADMIN');
    const admin = await signIn(adminUser.email);
    const student = await createUser('STUDENT');
    const course = await createCourse('PUBLISHED');
    const body = { userId: student.id, courseId: course.id, note: 'Tặng khóa' };

    // A3.1
    const first = await grant(admin, body).expect(201);
    expect(first.body).toEqual({
      id: expect.any(String),
      user: {
        id: student.id,
        email: student.email,
        displayName: 'Học viên',
      },
      course: { id: course.id, title: course.title },
      status: 'ACTIVE',
      source: 'MANUAL_GRANT',
      grantedAt: expect.any(String),
      revokedAt: null,
      grantedById: adminUser.id,
    });

    // A3.2: exactly one audit row, with the note in its metadata only.
    const granted = await prisma.auditLog.findMany({
      where: { action: 'enrollment.granted' },
    });
    expect(granted).toHaveLength(1);
    expect(granted[0]).toMatchObject({
      actorId: adminUser.id,
      entityType: 'ENROLLMENT',
      entityId: first.body.id,
      metadata: {
        courseId: course.id,
        userId: student.id,
        source: 'MANUAL_GRANT',
        note: 'Tặng khóa',
      },
    });

    // A3.8: the public card counts the real enrollment.
    const publicCourse = await request(app.getHttpServer())
      .get(`/api/v1/courses/${course.slug}`)
      .expect(200);
    expect(publicCourse.body.enrollmentCount).toBe(1);

    // A3.9
    const second = await grant(admin, body).expect(200);
    expect(second.body.id).toBe(first.body.id);
    expect(second.body.grantedAt).toBe(first.body.grantedAt);
    expect(
      await prisma.enrollment.count({
        where: { userId: student.id, courseId: course.id },
      }),
    ).toBe(1);
    expect(
      (await prisma.course.findUniqueOrThrow({ where: { id: course.id } }))
        .enrollmentCount,
    ).toBe(1);
    expect(
      await prisma.auditLog.count({ where: { action: 'enrollment.granted' } }),
    ).toBe(1);
  });

  it('refuses unknown users, draft courses and bad bodies', async () => {
    const admin = await signIn((await createUser('ADMIN')).email);
    const student = await createUser('STUDENT');
    const draft = await createCourse('DRAFT');
    const published = await createCourse('PUBLISHED');

    await grant(admin, { userId: randomUUID(), courseId: published.id }).expect(
      404,
    );
    await grant(admin, { userId: student.id, courseId: draft.id }).expect(404);
    await grant(admin, { userId: student.id, courseId: randomUUID() }).expect(
      404,
    );
    const invalid = await grant(admin, {
      userId: student.id,
      courseId: published.id,
      note: 'x'.repeat(501),
    }).expect(400);
    expect(invalid.body.code).toBe('VALIDATION_FAILED');
    expect(await prisma.enrollment.count()).toBe(0);

    // An archived course still accepts a grant (support and refunds).
    const archived = await createCourse('ARCHIVED');
    await grant(admin, { userId: student.id, courseId: archived.id }).expect(
      201,
    );
  });

  it('hides every enrollment endpoint from a student behind a plain 404', async () => {
    const student = await createUser('STUDENT');
    const session = await signIn(student.email);
    const course = await createCourse('PUBLISHED');
    const missing = await request(app.getHttpServer())
      .post('/api/v1/admin/does-not-exist')
      .set(as(session))
      .send({});

    // N3.8
    const refused = await grant(session, {
      userId: student.id,
      courseId: course.id,
    });
    expect(refused.status).toBe(404);
    expect(refused.body).toEqual(missing.body);
    await request(app.getHttpServer())
      .get('/api/v1/admin/enrollments')
      .set(as(session))
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/api/v1/admin/enrollments/${randomUUID()}`)
      .set(as(session))
      .expect(404);
    expect(await prisma.enrollment.count()).toBe(0);
  });

  it('revokes softly with one audit row, then a re-grant reactivates the same row', async () => {
    const adminUser = await createUser('ADMIN');
    const admin = await signIn(adminUser.email);
    const student = await createUser('STUDENT');
    const course = await createCourse('PUBLISHED');
    const { body: granted } = await grant(admin, {
      userId: student.id,
      courseId: course.id,
    }).expect(201);

    const revoke = () =>
      request(app.getHttpServer())
        .delete(`/api/v1/admin/enrollments/${granted.id}`)
        .set(as(admin));
    const revoked = await revoke().expect(204);
    expect(revoked.text).toBe('');
    const row = await prisma.enrollment.findUniqueOrThrow({
      where: { id: granted.id },
    });
    expect(row.status).toBe('REVOKED');
    expect(row.revokedAt).not.toBeNull();
    const audits = await prisma.auditLog.findMany({
      where: { action: 'enrollment.revoked' },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      actorId: adminUser.id,
      entityId: granted.id,
      metadata: {
        courseId: course.id,
        userId: student.id,
        reason: 'admin_revoke',
        trigger: 'admin',
      },
    });
    expect(
      (await prisma.course.findUniqueOrThrow({ where: { id: course.id } }))
        .enrollmentCount,
    ).toBe(0);

    // A second revoke changes nothing and writes nothing.
    await revoke().expect(204);
    expect(
      await prisma.auditLog.count({ where: { action: 'enrollment.revoked' } }),
    ).toBe(1);
    await request(app.getHttpServer())
      .delete(`/api/v1/admin/enrollments/${randomUUID()}`)
      .set(as(admin))
      .expect(404);

    // A different admin re-grants: the row follows the new grant.
    const otherAdminUser = await createUser('ADMIN');
    const otherAdmin = await signIn(otherAdminUser.email);
    const again = await grant(otherAdmin, {
      userId: student.id,
      courseId: course.id,
    }).expect(201);
    expect(again.body).toMatchObject({
      id: granted.id,
      status: 'ACTIVE',
      revokedAt: null,
      grantedAt: granted.grantedAt,
      grantedById: otherAdminUser.id,
    });
    const grantAudits = await prisma.auditLog.findMany({
      where: { action: 'enrollment.granted', entityId: granted.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(grantAudits).toHaveLength(2);
    expect(grantAudits[1]).toMatchObject({
      actorId: otherAdminUser.id,
      metadata: {
        courseId: course.id,
        userId: student.id,
        source: 'MANUAL_GRANT',
      },
    });
    expect(await prisma.enrollment.count()).toBe(1);
    expect(
      (await prisma.course.findUniqueOrThrow({ where: { id: course.id } }))
        .enrollmentCount,
    ).toBe(1);
  });

  it('lists and filters enrollments for the admin, newest grant first', async () => {
    const admin = await signIn((await createUser('ADMIN')).email);
    const [first, second] = [
      await createUser('STUDENT'),
      await createUser('STUDENT'),
    ];
    const course = await createCourse('PUBLISHED');
    const older = await grant(admin, {
      userId: first.id,
      courseId: course.id,
    }).expect(201);
    const newer = await grant(admin, {
      userId: second.id,
      courseId: course.id,
    }).expect(201);
    await request(app.getHttpServer())
      .delete(`/api/v1/admin/enrollments/${older.body.id}`)
      .set(as(admin))
      .expect(204);

    const all = await request(app.getHttpServer())
      .get('/api/v1/admin/enrollments')
      .set(as(admin))
      .expect(200)
      .expect('Cache-Control', 'no-store');
    expect(all.body).toMatchObject({ page: 1, pageSize: 20, total: 2 });
    expect(all.body.items.map(({ id }: { id: string }) => id)).toEqual([
      newer.body.id,
      older.body.id,
    ]);

    const active = await request(app.getHttpServer())
      .get(`/api/v1/admin/enrollments?status=ACTIVE&courseId=${course.id}`)
      .set(as(admin))
      .expect(200);
    expect(active.body.items).toHaveLength(1);
    expect(active.body.items[0].user.id).toBe(second.id);

    const byUser = await request(app.getHttpServer())
      .get(`/api/v1/admin/enrollments?userId=${first.id}`)
      .set(as(admin))
      .expect(200);
    expect(byUser.body.items[0].status).toBe('REVOKED');

    await request(app.getHttpServer())
      .get('/api/v1/admin/enrollments?status=PAUSED')
      .set(as(admin))
      .expect(400);
  });

  it("returns the learner's own courses with progress and a resume lesson", async () => {
    const admin = await signIn((await createUser('ADMIN')).email);
    const student = await createUser('STUDENT');
    const other = await createUser('STUDENT');
    const learning = await createCourse('PUBLISHED');
    const finished = await createCourse('ARCHIVED');
    const revoked = await createCourse('PUBLISHED');
    for (const course of [learning, finished, revoked]) {
      await grant(admin, { userId: student.id, courseId: course.id }).expect(
        201,
      );
    }
    await grant(admin, { userId: other.id, courseId: learning.id }).expect(201);
    const revokedRow = await prisma.enrollment.findFirstOrThrow({
      where: { userId: student.id, courseId: revoked.id },
    });
    await request(app.getHttpServer())
      .delete(`/api/v1/admin/enrollments/${revokedRow.id}`)
      .set(as(admin))
      .expect(204);

    const lessonsOf = (course: typeof learning) =>
      course.sections.flatMap(({ lessons }) => lessons);
    const [l1, l2, l3] = lessonsOf(learning);
    await prisma.lessonProgress.createMany({
      data: [
        {
          userId: student.id,
          lessonId: l1.id,
          completedAt: new Date('2026-09-01T10:00:00Z'),
          updatedAt: new Date('2026-09-01T10:00:00Z'),
        },
        {
          userId: student.id,
          lessonId: l2.id,
          completedAt: new Date('2026-09-01T10:10:00Z'),
          updatedAt: new Date('2026-09-01T10:10:00Z'),
        },
        {
          userId: student.id,
          lessonId: l3.id,
          lastPositionSeconds: 42,
          updatedAt: new Date('2026-09-02T09:00:00Z'),
        },
        // Someone else's progress never leaks into this learner's numbers.
        {
          userId: other.id,
          lessonId: lessonsOf(learning)[3].id,
          completedAt: new Date('2026-09-03T09:00:00Z'),
        },
        ...lessonsOf(finished).map((lesson) => ({
          userId: student.id,
          lessonId: lesson.id,
          completedAt: new Date('2026-08-01T10:00:00Z'),
          updatedAt: new Date('2026-08-01T10:00:00Z'),
        })),
      ],
    });
    const session = await signIn(student.email);

    // A3.3
    const all = await mine(session)
      .expect(200)
      .expect('Cache-Control', 'no-store');
    expect(all.body).toMatchObject({ page: 1, pageSize: 20, total: 3 });
    const item = all.body.items.find(
      ({ course }: { course: { id: string } }) => course.id === learning.id,
    );
    expect(Object.keys(item).sort()).toEqual(
      [
        'course',
        'grantedAt',
        'id',
        'progress',
        'resumeLessonId',
        'source',
        'status',
      ].sort(),
    );
    expect(item.progress).toEqual({
      completedLessons: 2,
      totalLessons: 4,
      percent: 50,
    });
    expect(item.resumeLessonId).toBe(l3.id);
    expect(item.course).toMatchObject({
      slug: learning.slug,
      status: 'PUBLISHED',
      enrollmentCount: 2,
    });
    expect(item.course).not.toHaveProperty('sections');

    const learningTab = await mine(
      session,
      '?status=ACTIVE&completed=false&sort=lastActivityAt:desc',
    ).expect(200);
    expect(
      learningTab.body.items.map(({ course }: { course: { id: string } }) => course.id),
    ).toEqual([learning.id]);

    const doneTab = await mine(session, '?status=ACTIVE&completed=true').expect(
      200,
    );
    expect(doneTab.body.items).toHaveLength(1);
    expect(doneTab.body.items[0]).toMatchObject({
      course: { id: finished.id, status: 'ARCHIVED' },
      progress: { completedLessons: 4, totalLessons: 4, percent: 100 },
    });

    const one = await mine(
      session,
      `?courseId=${revoked.id}&pageSize=1`,
    ).expect(200);
    expect(one.body.items).toHaveLength(1);
    expect(one.body.items[0].status).toBe('REVOKED');
    // Untouched course: resume at the first lesson in curriculum order.
    expect(one.body.items[0].resumeLessonId).toBe(lessonsOf(revoked)[0].id);

    const activityOrder = await mine(session, '?sort=lastActivityAt:desc').expect(
      200,
    );
    expect(
      activityOrder.body.items.map(({ course }: { course: { id: string } }) => course.id),
    // Never started: ranked by its grant time, which is the newest here.
    ).toEqual([revoked.id, learning.id, finished.id]);

    const both = await mine(session, '?status=ACTIVE,REVOKED').expect(200);
    expect(both.body.total).toBe(3);

    // D3: a revoked course that went back to DRAFT (or was archived) is no
    // longer visible to this learner, so its card must not leak.
    await prisma.course.update({
      where: { id: revoked.id },
      data: { status: 'DRAFT' },
    });
    const hidden = await mine(session).expect(200);
    expect(
      hidden.body.items.map(({ course }: { course: { id: string } }) => course.id),
    ).not.toContain(revoked.id);
    await prisma.course.update({
      where: { id: revoked.id },
      data: { status: 'ARCHIVED' },
    });
    expect(
      (await mine(session, `?courseId=${revoked.id}`).expect(200)).body.total,
    ).toBe(0);

    for (const bad of [
      '?sort=title:asc',
      '?completed=yes',
      '?status=PAUSED',
      '?courseId=abc',
    ]) {
      const response = await mine(session, bad).expect(400);
      expect(response.body.code).toBe('VALIDATION_FAILED');
    }

    await request(app.getHttpServer())
      .get('/api/v1/enrollments/me')
      .expect(401);
  });
});
