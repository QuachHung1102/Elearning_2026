import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { hashPassword } from '../src/auth/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const PASSWORD = 'correct horse battery staple';

describe('Instructor role (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  type Session = { cookies: string[]; token: string };

  // Login is limited to 10/60s per client IP; every sign-in gets its own.
  let clientIp = 0;
  const nextIp = () =>
    `10.3.${Math.floor(clientIp / 250)}.${(clientIp += 1) % 250}`;

  const jar = (value: string | string[] | undefined) =>
    (Array.isArray(value) ? value : value ? [value] : []).map(
      (cookie) => cookie.split(';')[0],
    );

  async function createUser(role: 'ADMIN' | 'STUDENT' | 'INSTRUCTOR') {
    return prisma.user.create({
      data: {
        email: `${role.toLowerCase()}-${randomUUID()}@example.com`,
        passwordHash: await hashPassword(PASSWORD),
        displayName: role === 'INSTRUCTOR' ? 'Giảng viên' : 'Người dùng',
        role,
        emailVerifiedAt: new Date(),
      },
      select: { id: true, email: true },
    });
  }
  const api = () => request(app.getHttpServer());

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

  it('lets an instructor create and edit only their own courses', async () => {
    const a = await createUser('INSTRUCTOR');
    const b = await createUser('INSTRUCTOR');
    const sa = await signIn(a.email);
    const sb = await signIn(b.email);

    const created = await api().post('/api/v1/admin/courses').set(as(sa))
      .send({ title: 'Khóa học của giảng viên A' }).expect(201);
    const id = created.body.id as string;
    const row = await prisma.course.findUniqueOrThrow({ where: { id } });
    expect(row.instructorId).toBe(a.id);

    await api().patch(`/api/v1/admin/courses/${id}`).set(as(sa))
      .send({ subtitle: 'Mới' }).expect(200);
    await api().patch(`/api/v1/admin/courses/${id}`).set(as(sb))
      .send({ subtitle: 'Chiếm' }).expect(404);
    await api().get(`/api/v1/admin/courses/${id.toUpperCase()}`).set(as(sb)).expect(404);
    await api().get('/api/v1/admin/courses/not-a-uuid').set(as(sb)).expect(400);

    const listA = await api().get('/api/v1/admin/courses').set(as(sa)).expect(200);
    const listB = await api().get('/api/v1/admin/courses').set(as(sb)).expect(200);
    expect(listA.body.items.map((c: { id: string }) => c.id)).toEqual([id]);
    expect(listB.body.items).toEqual([]);
  });

  it('hides site-owner courses and admin-only routes from instructors', async () => {
    const admin = await createUser('ADMIN');
    const teacher = await createUser('INSTRUCTOR');
    const sa = await signIn(admin.email);
    const st = await signIn(teacher.email);
    const owned = await api().post('/api/v1/admin/courses').set(as(sa))
      .send({ title: 'Khóa học của chủ sở hữu' }).expect(201);

    await api().get(`/api/v1/admin/courses/${owned.body.id}`).set(as(st)).expect(404);
    await api().post('/api/v1/admin/categories').set(as(st)).send({ name: 'X' }).expect(404);
    await api().get('/api/v1/admin/users').set(as(st)).expect(404);
    await api().get('/api/v1/admin/audit-logs').set(as(st)).expect(404);
    await api().get('/api/v1/admin/categories').set(as(st)).expect(200);
  });

  it('strips instructorId from an instructor and validates it for an admin', async () => {
    const admin = await createUser('ADMIN');
    const a = await createUser('INSTRUCTOR');
    const b = await createUser('INSTRUCTOR');
    const student = await createUser('STUDENT');
    const sa = await signIn(admin.email);
    const sInst = await signIn(a.email);
    const course = await api().post('/api/v1/admin/courses').set(as(sInst))
      .send({ title: 'Khóa học tự tạo' }).expect(201);

    await api().patch(`/api/v1/admin/courses/${course.body.id}`).set(as(sInst))
      .send({ instructorId: b.id }).expect(200);
    expect((await prisma.course.findUniqueOrThrow({ where: { id: course.body.id } })).instructorId).toBe(a.id);

    await api().patch(`/api/v1/admin/courses/${course.body.id}`).set(as(sa))
      .send({ instructorId: student.id }).expect(400);
    await api().patch(`/api/v1/admin/courses/${course.body.id}`).set(as(sa))
      .send({ instructorId: b.id }).expect(200);
    expect((await prisma.course.findUniqueOrThrow({ where: { id: course.body.id } })).instructorId).toBe(b.id);
    await api().patch(`/api/v1/admin/courses/${course.body.id}`).set(as(sa))
      .send({ instructorId: null }).expect(200);
  });

  it('lets an instructor build curriculum on their own course only', async () => {
    const a = await createUser('INSTRUCTOR');
    const b = await createUser('INSTRUCTOR');
    const sa = await signIn(a.email);
    const sb = await signIn(b.email);
    const course = await api().post('/api/v1/admin/courses').set(as(sa))
      .send({ title: 'Khóa học có chương' }).expect(201);
    const section = await api().post(`/api/v1/admin/courses/${course.body.id}/sections`)
      .set(as(sa)).send({ title: 'Chương 1' }).expect(201);
    const lesson = await api().post(`/api/v1/admin/sections/${section.body.id}/lessons`)
      .set(as(sa)).send({ title: 'Bài 1', type: 'ARTICLE' }).expect(201);

    await api().patch(`/api/v1/admin/sections/${section.body.id}`).set(as(sb))
      .send({ title: 'x' }).expect(404);
    await api().get(`/api/v1/admin/lessons/${lesson.body.id}`).set(as(sb)).expect(404);
    await api().delete(`/api/v1/admin/lessons/${lesson.body.id}`).set(as(sb)).expect(404);
    await api().get(`/api/v1/admin/lessons/${lesson.body.id}`).set(as(sa)).expect(200);
  });
});
