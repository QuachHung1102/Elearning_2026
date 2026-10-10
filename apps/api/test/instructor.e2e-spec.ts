import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { AdminUserController } from '../src/admin/admin-user.controller.js';
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
    await app.listen(0, '127.0.0.1');
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

  it('audits ownership reassignment with from/to instructor ids', async () => {
    const admin = await createUser('ADMIN');
    const a = await createUser('INSTRUCTOR');
    const b = await createUser('INSTRUCTOR');
    const sa = await signIn(admin.email);
    const sInst = await signIn(a.email);
    const course = await api().post('/api/v1/admin/courses').set(as(sInst))
      .send({ title: 'Khóa học chuyển giao' }).expect(201);

    await api().patch(`/api/v1/admin/courses/${course.body.id}`).set(as(sa))
      .send({ subtitle: 'Không đổi giảng viên' }).expect(200);
    const unchanged = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'course.updated', entityId: course.body.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(unchanged.metadata).toEqual({ slug: course.body.slug });

    await api().patch(`/api/v1/admin/courses/${course.body.id}`).set(as(sa))
      .send({ instructorId: b.id }).expect(200);
    const reassigned = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'course.updated', entityId: course.body.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(reassigned.metadata).toEqual({
      slug: course.body.slug,
      fromInstructorId: a.id,
      toInstructorId: b.id,
    });
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

  it('rejects a resource objectKey that does not belong to the target lesson', async () => {
    const a = await createUser('INSTRUCTOR');
    const b = await createUser('INSTRUCTOR');
    const sa = await signIn(a.email);
    const sb = await signIn(b.email);

    const courseA = await api().post('/api/v1/admin/courses').set(as(sa))
      .send({ title: 'Khóa học A' }).expect(201);
    const sectionA = await api().post(`/api/v1/admin/courses/${courseA.body.id}/sections`)
      .set(as(sa)).send({ title: 'Chương A' }).expect(201);
    const lessonA = await api().post(`/api/v1/admin/sections/${sectionA.body.id}/lessons`)
      .set(as(sa)).send({ title: 'Bài A', type: 'ARTICLE' }).expect(201);

    const courseB = await api().post('/api/v1/admin/courses').set(as(sb))
      .send({ title: 'Khóa học B' }).expect(201);
    const sectionB = await api().post(`/api/v1/admin/courses/${courseB.body.id}/sections`)
      .set(as(sb)).send({ title: 'Chương B' }).expect(201);
    const lessonB = await api().post(`/api/v1/admin/sections/${sectionB.body.id}/lessons`)
      .set(as(sb)).send({ title: 'Bài B', type: 'ARTICLE' }).expect(201);

    await api().post(`/api/v1/admin/lessons/${lessonB.body.id}/resources`).set(as(sb))
      .send({
        objectKey: `lessons/${lessonA.body.id}/resources/${randomUUID()}-tai-lieu.pdf`,
        filename: 'tai-lieu.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1024,
      }).expect(400);
  });

  it('rejects a coverImageKey that does not belong to the target course', async () => {
    const a = await createUser('INSTRUCTOR');
    const sa = await signIn(a.email);

    const courseA = await api().post('/api/v1/admin/courses').set(as(sa))
      .send({ title: 'Khóa học có ảnh bìa' }).expect(201);
    const otherCourseId = randomUUID();

    await api().patch(`/api/v1/admin/courses/${courseA.body.id}`).set(as(sa))
      .send({
        coverImageKey: `public/courses/${otherCourseId}/cover/${randomUUID()}.jpg`,
      }).expect(400);
  });

  it('rejects a resource objectKey that traverses out of its own lesson prefix', async () => {
    const a = await createUser('INSTRUCTOR');
    const b = await createUser('INSTRUCTOR');
    const sa = await signIn(a.email);
    const sb = await signIn(b.email);

    const courseA = await api().post('/api/v1/admin/courses').set(as(sa))
      .send({ title: 'Khóa học A2' }).expect(201);
    const sectionA = await api().post(`/api/v1/admin/courses/${courseA.body.id}/sections`)
      .set(as(sa)).send({ title: 'Chương A2' }).expect(201);
    const lessonA = await api().post(`/api/v1/admin/sections/${sectionA.body.id}/lessons`)
      .set(as(sa)).send({ title: 'Bài A2', type: 'ARTICLE' }).expect(201);

    const courseB = await api().post('/api/v1/admin/courses').set(as(sb))
      .send({ title: 'Khóa học B2' }).expect(201);
    const sectionB = await api().post(`/api/v1/admin/courses/${courseB.body.id}/sections`)
      .set(as(sb)).send({ title: 'Chương B2' }).expect(201);
    const lessonB = await api().post(`/api/v1/admin/sections/${sectionB.body.id}/lessons`)
      .set(as(sb)).send({ title: 'Bài B2', type: 'ARTICLE' }).expect(201);

    const file = `${randomUUID()}-tai-lieu.pdf`;
    await api().post(`/api/v1/admin/lessons/${lessonB.body.id}/resources`).set(as(sb))
      .send({
        objectKey: `lessons/${lessonB.body.id}/resources/../../${lessonA.body.id}/resources/${file}`,
        filename: 'tai-lieu.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1024,
      }).expect(400);
    await api().post(`/api/v1/admin/lessons/${lessonB.body.id}/resources`).set(as(sb))
      .send({
        objectKey: `lessons/${lessonB.body.id}/resources/..\\..\\${lessonA.body.id}\\resources\\${file}`,
        filename: 'tai-lieu.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1024,
      }).expect(400);
  });

  it('lists only enrollments of the instructor’s courses, with progress', async () => {
    const admin = await createUser('ADMIN');
    const a = await createUser('INSTRUCTOR');
    const learner = await createUser('STUDENT');
    const sAdmin = await signIn(admin.email);
    const sa = await signIn(a.email);
    const mine = await api().post('/api/v1/admin/courses').set(as(sa))
      .send({ title: 'Khóa học của tôi' }).expect(201);
    const theirs = await api().post('/api/v1/admin/courses').set(as(sAdmin))
      .send({ title: 'Khóa học khác' }).expect(201);
    await prisma.course.updateMany({
      where: { id: { in: [mine.body.id, theirs.body.id] } },
      data: { status: 'PUBLISHED' },
    });
    for (const courseId of [mine.body.id, theirs.body.id]) {
      await api().post('/api/v1/admin/enrollments').set(as(sAdmin))
        .send({ userId: learner.id, courseId }).expect(201);
    }

    const list = await api().get('/api/v1/admin/enrollments').set(as(sa)).expect(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0].course.id).toBe(mine.body.id);
    expect(list.body.items[0].progress).toEqual({ completedLessons: 0, totalLessons: 0, percent: 0 });

    await api().post('/api/v1/admin/enrollments').set(as(sa))
      .send({ userId: learner.id, courseId: mine.body.id }).expect(404);

    const overview = await api().get('/api/v1/admin/reports/instructor-overview')
      .set(as(sa)).expect(200);
    expect(overview.body).toEqual({
      publishedCourses: 1, draftCourses: 0, activeEnrollments: 1, newEnrollments30d: 1,
    });
    await api().get('/api/v1/admin/reports/overview').set(as(sa)).expect(404);
  });

  it('lets an admin change a role, audited, never their own', async () => {
    const admin = await createUser('ADMIN');
    const user = await createUser('STUDENT');
    const sa = await signIn(admin.email);
    const su = await signIn(user.email);

    await api().get('/api/v1/admin/courses').set(as(su)).expect(404);
    await api().patch(`/api/v1/admin/users/${user.id}/role`).set(as(sa))
      .send({ role: 'INSTRUCTOR' }).expect(200);
    await api().get('/api/v1/admin/courses').set(as(su)).expect(200);

    const log = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'user.role_changed' },
      orderBy: { createdAt: 'asc' },
    });
    expect(log.metadata).toEqual({
      fromRole: 'STUDENT',
      toRole: 'INSTRUCTOR',
      releasedCourses: 0,
      releasedCourseIds: [],
      releasedVideoAssetIds: [],
    });

    const ownedCourse = await api().post('/api/v1/admin/courses').set(as(su))
      .send({ title: 'Khóa học sẽ bị thu hồi' }).expect(201);
    const ownedVideo = await prisma.videoAsset.create({
      data: { externalId: `vid-${randomUUID()}`, instructorId: user.id },
    });

    await api().patch(`/api/v1/admin/users/${user.id}/role`).set(as(sa))
      .send({ role: 'STUDENT' }).expect(200);
    await api().get('/api/v1/admin/courses').set(as(su)).expect(404);

    expect(
      (await prisma.course.findUniqueOrThrow({ where: { id: ownedCourse.body.id } })).instructorId,
    ).toBeNull();
    expect(
      (await prisma.videoAsset.findUniqueOrThrow({ where: { id: ownedVideo.id } })).instructorId,
    ).toBeNull();
    const demoteLog = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'user.role_changed' },
      orderBy: { createdAt: 'desc' },
    });
    // The ids stay in the audit row: releasing a course leaves no owner to read them from.
    expect(demoteLog.metadata).toEqual({
      fromRole: 'INSTRUCTOR',
      toRole: 'STUDENT',
      releasedCourses: 1,
      releasedCourseIds: [ownedCourse.body.id],
      releasedVideoAssetIds: [ownedVideo.id],
    });

    await api().patch(`/api/v1/admin/users/${admin.id}/role`).set(as(sa))
      .send({ role: 'STUDENT' }).expect(409);
    await api().patch(`/api/v1/admin/users/${user.id}/role`).set(as(sa))
      .send({ role: 'OWNER' }).expect(400);
    // Admin accounts come from the seed only (DATA_MODEL.md §User): the API
    // must not mint one, even for an admin asking.
    await api().patch(`/api/v1/admin/users/${user.id}/role`).set(as(sa))
      .send({ role: 'ADMIN' }).expect(400);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).role).toBe('STUDENT');
    await api().patch(`/api/v1/admin/users/${admin.id}/role`).set(as(su))
      .send({ role: 'ADMIN' }).expect(404);
  });

  // REVIEW F-29: two admins demoting each other both passed their checks and
  // left the site with none. The acting admin is re-checked under a lock on
  // every admin row, so a demoted actor's request is refused.
  it('never leaves the site without an admin', async () => {
    const x = await createUser('ADMIN');
    const y = await createUser('ADMIN');
    // x was demoted by a concurrent request a moment ago; this is y's request.
    await prisma.user.update({ where: { id: x.id }, data: { role: 'STUDENT' } });

    await expect(
      app
        .get(AdminUserController)
        .updateRole(y.id, { role: 'STUDENT' }, { actorId: x.id, ipAddress: null }),
    ).rejects.toMatchObject({ status: 404 });

    expect(await prisma.user.count({ where: { role: 'ADMIN' } })).toBe(1);
  });

  it('exposes the instructor display name on public course payloads', async () => {
    const teacher = await createUser('INSTRUCTOR');
    const course = await prisma.course.create({
      data: {
        slug: `khoa-${randomUUID().slice(0, 8)}`, title: 'Khóa công khai', description: '',
        priceVnd: 0, status: 'PUBLISHED', publishedAt: new Date(), instructorId: teacher.id,
        learningOutcomes: [], requirements: [], targetAudience: [],
      },
    });
    const detail = await api().get(`/api/v1/courses/${course.slug}`).expect(200);
    expect(detail.body.instructorName).toBe('Giảng viên');
    const list = await api().get('/api/v1/courses').expect(200);
    expect(list.body.items[0].instructorName).toBe('Giảng viên');
  });
});
