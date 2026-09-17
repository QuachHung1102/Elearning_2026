import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { hashPassword } from '../src/auth/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const PASSWORD = 'correct horse battery staple';

describe('Phase 3 admin users (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  type Session = { cookies: string[]; token: string };

  // Login is limited to 10/60s per client IP; every sign-in gets its own.
  let clientIp = 0;
  const nextIp = () =>
    `10.1.${Math.floor(clientIp / 250)}.${(clientIp += 1) % 250}`;

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

  async function login(email: string, password = PASSWORD) {
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
      .send({ email, password });
    return {
      response,
      session: {
        cookies: [...csrfCookies, ...jar(response.headers['set-cookie'])],
        token,
      } as Session,
    };
  }

  async function signIn(email: string): Promise<Session> {
    const { response, session } = await login(email);
    expect(response.status).toBe(200);
    return session;
  }

  const as = (session: Session) => ({
    Cookie: session.cookies.join('; '),
    'X-CSRF-Token': session.token,
  });

  const setStatus = (session: Session, id: string, status: string) =>
    request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${id}`)
      .set(as(session))
      .send({ status });

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

  it('finds a user by part of the email without ever returning a password hash', async () => {
    const adminUser = await createUser('ADMIN');
    const admin = await signIn(adminUser.email);
    const student = await createUser('STUDENT');
    await createUser('STUDENT');
    await signIn(student.email);
    // Expired but never logged out: not an open session.
    await prisma.session.create({
      data: { userId: student.id, expiresAt: new Date(Date.now() - 60_000) },
    });

    // A3.10
    const fragment = student.email.slice(8, 20).toUpperCase();
    const list = await request(app.getHttpServer())
      .get(`/api/v1/admin/users?q=${encodeURIComponent(fragment)}`)
      .set(as(admin))
      .expect(200)
      .expect('Cache-Control', 'no-store');
    expect(list.text).not.toContain('passwordHash');
    expect(list.text).not.toContain('password');
    expect(list.body).toMatchObject({
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });
    expect(list.body.items).toHaveLength(1);
    expect(Object.keys(list.body.items[0]).sort()).toEqual(
      [
        'activeSessionCount',
        'createdAt',
        'displayName',
        'email',
        'emailVerifiedAt',
        'enrollmentCount',
        'id',
        'purchaseCount',
        'role',
        'status',
      ].sort(),
    );
    expect(list.body.items[0]).toMatchObject({
      id: student.id,
      email: student.email,
      role: 'STUDENT',
      status: 'ACTIVE',
      enrollmentCount: 0,
      purchaseCount: 0,
      activeSessionCount: 1,
    });

    // Filters, sort whitelist and clamped paging.
    const students = await request(app.getHttpServer())
      .get('/api/v1/admin/users?role=STUDENT&status=ACTIVE&sort=email:asc&pageSize=500')
      .set(as(admin))
      .expect(200);
    expect(students.body.pageSize).toBe(100);
    expect(students.body.total).toBe(2);
    const emails = students.body.items.map(
      (item: { email: string }) => item.email,
    );
    expect(emails).toEqual([...emails].sort());
    await request(app.getHttpServer())
      .get('/api/v1/admin/users?sort=passwordHash:asc')
      .set(as(admin))
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('VALIDATION_FAILED'));
    await request(app.getHttpServer())
      .get('/api/v1/admin/users?status=DELETED')
      .set(as(admin))
      .expect(400);
    await request(app.getHttpServer())
      .get(`/api/v1/admin/users?q=${'a'.repeat(101)}`)
      .set(as(admin))
      .expect(400);

    // `q` also matches the display name, case-insensitively.
    const byName = await request(app.getHttpServer())
      .get(`/api/v1/admin/users?q=${encodeURIComponent('HỌC VIÊN')}`)
      .set(as(admin))
      .expect(200);
    expect(byName.body.total).toBe(2);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/admin/users/${student.id}`)
      .set(as(admin))
      .expect(200)
      .expect('Cache-Control', 'no-store');
    expect(detail.text).not.toContain('passwordHash');
    expect(detail.body).toEqual({
      user: expect.objectContaining({ id: student.id, activeSessionCount: 1 }),
      enrollments: [],
      purchases: [],
    });
    await request(app.getHttpServer())
      .get(`/api/v1/admin/users/${randomUUID()}`)
      .set(as(admin))
      .expect(404);
  });

  it('lists every enrollment of a user, newest grant first', async () => {
    const adminUser = await createUser('ADMIN');
    const admin = await signIn(adminUser.email);
    const student = await createUser('STUDENT');
    const courses = await Promise.all(
      ['a', 'b'].map((suffix) =>
        prisma.course.create({
          data: {
            slug: `khoa-hoc-${suffix}-${randomUUID().slice(0, 8)}`,
            title: `Khóa học ${suffix}`,
            description: 'Mô tả',
            priceVnd: 499_000,
            status: 'PUBLISHED',
          },
        }),
      ),
    );
    await prisma.enrollment.create({
      data: {
        userId: student.id,
        courseId: courses[0].id,
        source: 'MANUAL_GRANT',
        grantedById: adminUser.id,
        grantedAt: new Date('2026-09-01T00:00:00.000Z'),
      },
    });
    await prisma.enrollment.create({
      data: {
        userId: student.id,
        courseId: courses[1].id,
        source: 'MANUAL_GRANT',
        grantedById: adminUser.id,
        status: 'REVOKED',
        revokedAt: new Date('2026-09-03T00:00:00.000Z'),
        grantedAt: new Date('2026-09-02T00:00:00.000Z'),
      },
    });

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/admin/users/${student.id}`)
      .set(as(admin))
      .expect(200);
    // Only the ACTIVE one counts; both are listed.
    expect(detail.body.user.enrollmentCount).toBe(1);
    expect(detail.body.enrollments).toEqual([
      {
        id: expect.any(String),
        user: {
          id: student.id,
          email: student.email,
          displayName: 'Học viên',
        },
        course: { id: courses[1].id, title: 'Khóa học b' },
        status: 'REVOKED',
        source: 'MANUAL_GRANT',
        grantedAt: '2026-09-02T00:00:00.000Z',
        revokedAt: '2026-09-03T00:00:00.000Z',
        grantedById: adminUser.id,
      },
      expect.objectContaining({
        course: { id: courses[0].id, title: 'Khóa học a' },
        status: 'ACTIVE',
        revokedAt: null,
      }),
    ]);
  });

  it('blocks a user: sessions revoked, old cookie dead, login refused like a wrong password', async () => {
    const adminUser = await createUser('ADMIN');
    const admin = await signIn(adminUser.email);
    const student = await createUser('STUDENT');
    const firstDevice = await signIn(student.email);
    await signIn(student.email);
    // Expired but never logged out: revoked too, yet not counted as open.
    await prisma.session.create({
      data: { userId: student.id, expiresAt: new Date(Date.now() - 60_000) },
    });

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set(as(firstDevice))
      .expect(200);

    // A3.11
    const blocked = await setStatus(admin, student.id, 'BLOCKED')
      .expect(200)
      .expect('Cache-Control', 'no-store');
    expect(blocked.text).not.toContain('passwordHash');
    expect(blocked.body.user).toMatchObject({
      id: student.id,
      status: 'BLOCKED',
      activeSessionCount: 0,
    });
    const row = await prisma.user.findUniqueOrThrow({
      where: { id: student.id },
    });
    expect(row.status).toBe('BLOCKED');
    const sessions = await prisma.session.findMany({
      where: { userId: student.id },
    });
    expect(sessions).toHaveLength(3);
    expect(sessions.every((session) => session.revokedAt !== null)).toBe(true);
    const audits = await prisma.auditLog.findMany({
      where: { entityId: student.id },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      actorId: adminUser.id,
      action: 'user.blocked',
      entityType: 'USER',
      metadata: { reason: null, revokedSessions: 2 },
    });

    // N3.15
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set(as(firstDevice))
      .expect(401);

    // N3.14: identical to a wrong password on an ordinary ACTIVE account, and
    // no session row appears.
    const bystander = await createUser('STUDENT');
    const wrongPassword = await login(
      bystander.email,
      'not the password at all',
    );
    const blockedLogin = await login(student.email);
    expect(blockedLogin.response.status).toBe(401);
    expect(blockedLogin.response.body.code).toBe('INVALID_CREDENTIALS');
    expect(blockedLogin.response.body).toEqual(wrongPassword.response.body);
    expect(blockedLogin.response.headers['set-cookie']).toBeUndefined();
    expect(await prisma.session.count({ where: { userId: student.id } })).toBe(
      3,
    );

    // Repeating the same status is a no-op without a second audit row.
    await setStatus(admin, student.id, 'BLOCKED').expect(200);
    expect(await prisma.auditLog.count({ where: { entityId: student.id } })).toBe(
      1,
    );

    // A login that raced the block can leave a live session row behind;
    // unblocking must not bring it back.
    const raced = await prisma.session.create({
      data: { userId: student.id, expiresAt: new Date(Date.now() + 3_600_000) },
    });

    // Unblocking lets the same password in again and writes its own action.
    const unblocked = await setStatus(admin, student.id, 'ACTIVE')
      .expect(200)
      .expect('Cache-Control', 'no-store');
    expect(unblocked.text).not.toContain('passwordHash');
    expect(unblocked.body.user).toMatchObject({
      status: 'ACTIVE',
      activeSessionCount: 0,
    });
    expect(
      (await prisma.session.findUniqueOrThrow({ where: { id: raced.id } }))
        .revokedAt,
    ).not.toBeNull();
    const unblock = await prisma.auditLog.findFirstOrThrow({
      where: { entityId: student.id, action: 'user.unblocked' },
    });
    expect(unblock).toMatchObject({
      actorId: adminUser.id,
      entityType: 'USER',
      metadata: {},
    });
    await signIn(student.email);
  });

  it('refuses a student with the same 404 as a path that does not exist', async () => {
    const student = await createUser('STUDENT');
    const session = await signIn(student.email);

    // N3.16
    const asStudent = await setStatus(session, student.id, 'BLOCKED').expect(
      404,
    );
    const anonymous = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${student.id}`)
      .send({ status: 'BLOCKED' })
      .expect(404);
    const unknownPath = await request(app.getHttpServer())
      .get('/api/v1/khong-co-duong-nay')
      .expect(404);
    expect(asStudent.body).toEqual(unknownPath.body);
    expect(anonymous.body).toEqual(unknownPath.body);
    for (const path of ['/api/v1/admin/users', `/api/v1/admin/users/${student.id}`]) {
      await request(app.getHttpServer()).get(path).set(as(session)).expect(404);
    }
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: student.id } }))
        .status,
    ).toBe('ACTIVE');
    expect(await prisma.auditLog.count()).toBe(0);
  });

  it('never lets an admin block their own account', async () => {
    const adminUser = await createUser('ADMIN');
    const admin = await signIn(adminUser.email);

    // N3.17, also for an upper-cased spelling of the same uuid.
    for (const id of [adminUser.id, adminUser.id.toUpperCase()]) {
      await setStatus(admin, id, 'BLOCKED')
        .expect(409)
        .expect(({ body }) => expect(body.code).toBe('SELF_ACTION_FORBIDDEN'));
    }
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: adminUser.id } }))
        .status,
    ).toBe('ACTIVE');
    expect(await prisma.auditLog.count()).toBe(0);
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set(as(admin))
      .expect(200);

    // Status is the only accepted field, and a missing target is a 404.
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${adminUser.id}`)
      .set(as(admin))
      .send({ status: 'BLOCKED', reason: 'thử' })
      .expect(400);
    await setStatus(admin, randomUUID(), 'BLOCKED').expect(404);
  });
});
