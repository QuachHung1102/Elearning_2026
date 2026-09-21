import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { hashPassword } from '../src/auth/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const PASSWORD = 'correct horse battery staple';

describe('Phase 3 admin users and audit log (e2e)', () => {
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

  it('lists the audit log newest first, filtered by the closed vocabulary', async () => {
    const adminUser = await createUser('ADMIN');
    const admin = await signIn(adminUser.email);
    const student = await createUser('STUDENT');

    // A real mutation, so the row the viewer shows is the one the endpoint wrote.
    await setStatus(admin, student.id, 'BLOCKED').expect(200);

    const at = (minute: number) =>
      new Date(Date.UTC(2026, 8, 1, 3, minute)).toISOString();
    const granted = (minute: number, actorId: string | null) =>
      prisma.auditLog.create({
        data: {
          actorId,
          action: 'enrollment.granted',
          entityType: 'ENROLLMENT',
          entityId: randomUUID(),
          metadata: {
            courseId: randomUUID(),
            userId: student.id,
            source: 'MANUAL_GRANT',
          },
          ipAddress: '127.0.0.1',
          createdAt: at(minute),
        },
      });
    // Inserted out of order: the answer must sort, not echo insertion order.
    await granted(10, adminUser.id);
    await granted(30, null);
    await granted(20, adminUser.id);
    await prisma.auditLog.create({
      data: {
        actorId: adminUser.id,
        action: 'course.created',
        entityType: 'COURSE',
        entityId: randomUUID(),
        metadata: { slug: 'khoa-hoc' },
        createdAt: at(15),
      },
    });

    const list = (query: string) =>
      request(app.getHttpServer())
        .get(`/api/v1/admin/audit-logs${query}`)
        .set(as(admin));

    // A3.13
    const byAction = await list('?action=enrollment.granted&pageSize=200')
      .expect(200)
      .expect('Cache-Control', 'no-store');
    expect(byAction.body).toMatchObject({
      page: 1,
      pageSize: 100,
      total: 3,
      totalPages: 1,
    });
    expect(
      byAction.body.items.map(
        (item: { action: string; createdAt: string }) => [
          item.action,
          item.createdAt,
        ],
      ),
    ).toEqual([
      ['enrollment.granted', at(30)],
      ['enrollment.granted', at(20)],
      ['enrollment.granted', at(10)],
    ]);
    expect(Object.keys(byAction.body.items[0]).sort()).toEqual(
      [
        'action',
        'actorEmail',
        'actorId',
        'createdAt',
        'entityId',
        'entityType',
        'id',
        'ipAddress',
        'metadata',
      ].sort(),
    );
    // The system has no actor and therefore no email.
    expect(byAction.body.items[0]).toMatchObject({
      actorId: null,
      actorEmail: null,
    });
    expect(byAction.body.items[1]).toMatchObject({
      actorId: adminUser.id,
      actorEmail: adminUser.email,
      entityType: 'ENROLLMENT',
      metadata: { userId: student.id, source: 'MANUAL_GRANT' },
      ipAddress: '127.0.0.1',
    });

    // Unfiltered, the block written just now is the newest row.
    const all = await list('').expect(200);
    expect(all.body).toMatchObject({ pageSize: 20, total: 5 });
    expect(all.body.items[0]).toMatchObject({
      action: 'user.blocked',
      actorId: adminUser.id,
      actorEmail: adminUser.email,
      entityType: 'USER',
      entityId: student.id,
      metadata: { reason: null, revokedSessions: 0 },
    });
    expect(all.body.items[0].ipAddress).toBeTruthy();

    // Paging walks the same order without repeating a row.
    const first = await list('?pageSize=2').expect(200);
    const second = await list('?pageSize=2&page=2').expect(200);
    expect(first.body.totalPages).toBe(3);
    expect(
      [...first.body.items, ...second.body.items].map(
        (item: { id: string }) => item.id,
      ),
    ).toEqual(
      all.body.items.slice(0, 4).map((item: { id: string }) => item.id),
    );

    // Entity type, actor and an inclusive time window narrow the list.
    const courses = await list('?entityType=COURSE').expect(200);
    expect(courses.body.total).toBe(1);
    expect(courses.body.items[0].action).toBe('course.created');
    const byActor = await list(
      `?actorId=${adminUser.id}&action=enrollment.granted`,
    ).expect(200);
    expect(byActor.body.total).toBe(2);
    const window = await list(
      `?from=${encodeURIComponent(at(15))}&to=${encodeURIComponent(at(20))}`,
    ).expect(200);
    expect(
      window.body.items.map((item: { action: string }) => item.action),
    ).toEqual(['enrollment.granted', 'course.created']);
    // One calendar day in Vietnam time, the way the web page asks for it.
    const day = await list(
      `?from=${encodeURIComponent('2026-09-01T00:00:00+07:00')}&to=${encodeURIComponent('2026-09-01T23:59:59.999+07:00')}`,
    ).expect(200);
    expect(day.body.total).toBe(4);
    const inverted = await list(
      `?from=${encodeURIComponent(at(30))}&to=${encodeURIComponent(at(10))}`,
    ).expect(200);
    expect(inverted.body.total).toBe(0);
    // A bare date is UTC midnight.
    const sinceDay = await list('?from=2026-09-01&action=enrollment.granted');
    expect(sinceDay.status).toBe(200);
    expect(sinceDay.body.total).toBe(3);

    // Exact filters take a comma list (API_CONTRACT.md §2.8).
    const twoActions = await list('?action=course.created,user.blocked');
    expect(twoActions.status).toBe(200);
    expect(
      twoActions.body.items.map((item: { action: string }) => item.action),
    ).toEqual(['user.blocked', 'course.created']);
    const twoTypes = await list('?entityType=COURSE,USER').expect(200);
    expect(twoTypes.body.total).toBe(2);

    // A page number past any real list is clamped, not a 500.
    const farPage = await list('?page=1e30').expect(200);
    expect(farPage.body).toMatchObject({ page: 1_000_000, items: [] });

    // Outside the vocabulary, or malformed, is a 400, never a silent empty page.
    for (const query of [
      '?action=enrollment.deleted',
      '?action=ENROLLMENT.GRANTED',
      '?action=course.created,enrollment.deleted',
      '?entityType=Course',
      // A blank list would match nothing and pass for an empty trail.
      '?action=',
      '?action=,',
      '?entityType=',
      '?actorId=',
      '?actorId=not-a-uuid',
      '?actorId=00000000-0000-0000-0000-000000000001',
      '?from=2026-02-30',
      '?to=yesterday',
      // Strict ISO 8601 that `new Date` cannot read, or reads in local time.
      '?from=2026-W35',
      '?from=2026-244',
      '?from=20260901',
      '?to=2026-09-01T10',
      `?to=${encodeURIComponent('2026-09-01T10:00:00+07')}`,
      '?from=2026-09-01T00:00:00',
      '?sort=createdAt:asc',
    ]) {
      await list(query)
        .expect(400)
        .expect(({ body }) => expect(body.code, query).toBe('VALIDATION_FAILED'));
    }
  });

  it('hides the audit log from a student behind the same 404 as a missing path', async () => {
    const student = await createUser('STUDENT');
    const session = await signIn(student.email);
    await prisma.auditLog.create({
      data: {
        actorId: null,
        action: 'user.unblocked',
        entityType: 'USER',
        entityId: student.id,
        metadata: {},
      },
    });

    // N3.9
    const asStudent = await request(app.getHttpServer())
      .get('/api/v1/admin/audit-logs')
      .set(as(session))
      .expect(404);
    const anonymous = await request(app.getHttpServer())
      .get('/api/v1/admin/audit-logs')
      .expect(404);
    const unknownPath = await request(app.getHttpServer())
      .get('/api/v1/khong-co-duong-nay')
      .expect(404);
    expect(asStudent.body.code).toBe('NOT_FOUND');
    expect(asStudent.body).toEqual(unknownPath.body);
    expect(anonymous.body).toEqual(unknownPath.body);
  });
});
