import { randomUUID } from 'node:crypto';
import type { HttpException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { AUDIT_VOCABULARY } from '../src/audit/actions.js';
import { configureApp } from '../src/app.setup.js';
import { hashPassword } from '../src/auth/password.js';
import { EnrollmentService } from '../src/enrollment/enrollment.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { untilBlockedOnLock } from './support.js';

const PASSWORD = 'correct horse battery staple';
const LONG_DESCRIPTION = 'Mô tả đủ dài để vượt ngưỡng hai trăm ký tự. '.repeat(6);

describe('Phase 2 catalog (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  type Session = { cookies: string[]; token: string };

  // The login rate limit is 10/60s per client IP and this suite signs in far
  // more often than that, so each sign-in comes from its own address.
  let clientIp = 0;

  function setCookies(value: string | string[] | undefined): string[] {
    if (!value) throw new Error('Missing Set-Cookie header');
    return Array.isArray(value) ? value : [value];
  }

  function jar(headers: string[]): string[] {
    return headers.map((cookie) => cookie.split(';')[0]);
  }

  /** Creates a fresh user, or opens another session for `existingEmail`. */
  async function signIn(
    role: 'ADMIN' | 'STUDENT',
    existingEmail?: string,
  ): Promise<Session> {
    const email =
      existingEmail ?? `${role.toLowerCase()}-${randomUUID()}@example.com`;
    if (!existingEmail) {
      await prisma.user.create({
        data: {
          email,
          passwordHash: await hashPassword(PASSWORD),
          displayName: role === 'ADMIN' ? 'Quản trị viên' : 'Học viên',
          role,
          emailVerifiedAt: new Date(),
        },
      });
    }

    const csrf = await request(app.getHttpServer())
      .get('/api/v1/auth/csrf')
      .expect(200);
    const csrfCookies = jar(setCookies(csrf.headers['set-cookie']));
    const token = csrf.body.csrfToken as string;

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', csrfCookies.join('; '))
      .set('X-CSRF-Token', token)
      .set('X-Real-IP', `10.0.${Math.floor(clientIp / 250)}.${(clientIp += 1) % 250}`)
      .send({ email, password: PASSWORD })
      .expect(200);

    return {
      cookies: [...csrfCookies, ...jar(setCookies(login.headers['set-cookie']))],
      token,
    };
  }

  function as(session: Session) {
    return {
      Cookie: session.cookies.join('; '),
      'X-CSRF-Token': session.token,
    };
  }

  /** A DRAFT course with one section, one preview video lesson and a cover. */
  async function buildCourse(admin: Session, overrides: { title?: string } = {}) {
    const category = await request(app.getHttpServer())
      .post('/api/v1/admin/categories')
      .set(as(admin))
      .send({ name: 'Lập trình' })
      .expect(201);

    const course = await request(app.getHttpServer())
      .post('/api/v1/admin/courses')
      .set(as(admin))
      .send({
        title: overrides.title ?? 'Lập trình JavaScript',
        categoryId: category.body.id,
      })
      .expect(201);

    const section = await request(app.getHttpServer())
      .post(`/api/v1/admin/courses/${course.body.id}/sections`)
      .set(as(admin))
      .send({ title: 'Chương 1: Bắt đầu' })
      .expect(201);

    const video = await request(app.getHttpServer())
      .post('/api/v1/admin/videos')
      .set(as(admin))
      .send({ externalId: `demo/${randomUUID()}` })
      .expect(201);

    const lesson = await request(app.getHttpServer())
      .post(`/api/v1/admin/sections/${section.body.id}/lessons`)
      .set(as(admin))
      .send({ title: 'Bài 1: Cài đặt', type: 'VIDEO' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/lessons/${lesson.body.id}`)
      .set(as(admin))
      .send({ videoAssetId: video.body.id, isPreview: true })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/courses/${course.body.id}`)
      .set(as(admin))
      .send({
        description: LONG_DESCRIPTION,
        priceVnd: 499_000,
        learningOutcomes: ['Hiểu và áp dụng nền tảng'],
        coverImageKey: `public/courses/${course.body.id}/cover/${randomUUID()}.jpg`,
      })
      .expect(200);

    return {
      categoryId: category.body.id as string,
      courseId: course.body.id as string,
      sectionId: section.body.id as string,
      lessonId: lesson.body.id as string,
      videoAssetId: video.body.id as string,
      slug: course.body.slug as string,
    };
  }

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

  it('keeps DRAFT and ARCHIVED courses off the public catalog', async () => {
    const admin = await signIn('ADMIN');
    const { courseId, slug } = await buildCourse(admin);

    // N2.1 — a draft slug answers exactly like a slug that never existed.
    const draft = await request(app.getHttpServer())
      .get(`/api/v1/courses/${slug}`)
      .expect(404);
    const missing = await request(app.getHttpServer())
      .get('/api/v1/courses/khong-ton-tai-dau')
      .expect(404);
    expect(draft.body).toEqual(missing.body);

    await request(app.getHttpServer())
      .get('/api/v1/courses')
      .expect(200)
      .expect(({ body }) => expect(body.total).toBe(0));

    await request(app.getHttpServer())
      .post(`/api/v1/admin/courses/${courseId}/publish`)
      .set(as(admin))
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/courses')
      .expect(200)
      .expect(({ body }) => expect(body.total).toBe(1));

    // N2.2 — archiving takes it back out of the catalog.
    await request(app.getHttpServer())
      .post(`/api/v1/admin/courses/${courseId}/archive`)
      .set(as(admin))
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/courses')
      .expect(200)
      .expect(({ body }) => expect(body.total).toBe(0));
    await request(app.getHttpServer())
      .get(`/api/v1/courses/${slug}`)
      .expect(404);
  });

  it('returns the curriculum outline without lesson content for guests', async () => {
    const admin = await signIn('ADMIN');
    const { courseId, sectionId, slug } = await buildCourse(admin);

    // A second, non-preview lesson with content, to prove it stays hidden.
    const secret = await request(app.getHttpServer())
      .post(`/api/v1/admin/sections/${sectionId}/lessons`)
      .set(as(admin))
      .send({ title: 'Bài 2: Nội dung trả phí', type: 'ARTICLE' })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/lessons/${secret.body.id}`)
      .set(as(admin))
      .send({ content: 'Nội dung chỉ dành cho học viên' })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/courses/${courseId}/publish`)
      .set(as(admin))
      .expect(200);

    // A2.2 and A2.3
    const detail = await request(app.getHttpServer())
      .get(`/api/v1/courses/${slug}`)
      .expect(200);
    expect(detail.body.sections).toHaveLength(1);
    expect(detail.body.sections[0].lessons).toHaveLength(2);
    expect(detail.body.enrollmentCount).toBe(0);
    expect(detail.body).toMatchObject({
      ratingCount: 0,
      ratingAverage: null,
      demoStats: false,
    });

    // N2.5 — no `content`, no `videoAssetId` anywhere in the public payload.
    const serialised = JSON.stringify(detail.body);
    expect(serialised).not.toContain('Nội dung chỉ dành cho học viên');
    for (const lesson of detail.body.sections[0].lessons) {
      expect(Object.keys(lesson).sort()).toEqual([
        'durationSeconds',
        'id',
        'isPreview',
        'position',
        'title',
        'type',
      ]);
    }
  });

  it('answers 404 on every /admin route for a student and for an anonymous caller', async () => {
    const admin = await signIn('ADMIN');
    const student = await signIn('STUDENT');
    const { courseId } = await buildCourse(admin);

    const reads = [
      '/api/v1/admin/courses',
      `/api/v1/admin/courses/${courseId}`,
      '/api/v1/admin/categories',
      '/api/v1/admin/reports/overview',
    ];
    for (const path of reads) {
      // N2.9
      await request(app.getHttpServer())
        .get(path)
        .set(as(student))
        .expect(404);
      await request(app.getHttpServer()).get(path).expect(404);
    }

    // N2.3 and N2.4 must be byte-identical: a CSRF rejection would confirm
    // the route exists.
    const asStudent = await request(app.getHttpServer())
      .post('/api/v1/admin/courses')
      .set(as(student))
      .send({ title: 'Thử tạo khóa' })
      .expect(404);
    const anonymous = await request(app.getHttpServer())
      .post('/api/v1/admin/courses')
      .send({ title: 'Thử tạo khóa' })
      .expect(404);
    const unknownPath = await request(app.getHttpServer())
      .get('/api/v1/khong-co-duong-nay')
      .expect(404);
    expect(asStudent.body).toEqual(anonymous.body);
    expect(asStudent.body).toEqual(unknownPath.body);

    // Express routes without regard to case, so `/API/V1/ADMIN/...` is the
    // same surface: it must keep the 404 and the `no-store` (REVIEW F-26).
    const shouting = await request(app.getHttpServer())
      .post('/API/V1/ADMIN/courses')
      .send({ title: 'Thử tạo khóa' })
      .expect(404);
    expect(shouting.body).toEqual(anonymous.body);
    const cased = await request(app.getHttpServer())
      .get('/API/V1/ADMIN/courses')
      .set(as(admin))
      .expect(200);
    expect(cased.headers['cache-control']).toBe('no-store');
  });

  it('lists drafts for an admin and hides lesson content from the admin outline', async () => {
    const admin = await signIn('ADMIN');
    const { courseId } = await buildCourse(admin);

    // A2.9
    const list = await request(app.getHttpServer())
      .get('/api/v1/admin/courses')
      .set(as(admin))
      .expect(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0].status).toBe('DRAFT');
    expect(list.body).toMatchObject({ page: 1, total: 1, totalPages: 1 });

    // A2.10
    const detail = await request(app.getHttpServer())
      .get(`/api/v1/admin/courses/${courseId}`)
      .set(as(admin))
      .expect(200);
    expect(detail.body.sections[0].lessons[0]).not.toHaveProperty('content');
    expect(detail.body.sections[0].lessons[0]).not.toHaveProperty('resources');
    expect(detail.body.videoAssets).toHaveLength(1);
    expect(detail.body.videoAssets[0]).toMatchObject({ status: 'READY' });
  });

  it('reports every publish blocker in one response', async () => {
    const admin = await signIn('ADMIN');
    const course = await request(app.getHttpServer())
      .post('/api/v1/admin/courses')
      .set(as(admin))
      .send({ title: 'Khóa học chưa xong' })
      .expect(201);

    // A2.6 and N2.13
    const blocked = await request(app.getHttpServer())
      .post(`/api/v1/admin/courses/${course.body.id}/publish`)
      .set(as(admin))
      .expect(422);
    expect(blocked.body.code).toBe('COURSE_NOT_PUBLISHABLE');
    expect(blocked.body.details.issues).toContainEqual({
      field: 'coverImageKey',
      reason: 'MISSING',
    });
    expect(blocked.body.details.issues).toContainEqual({
      field: 'priceVnd',
      reason: 'MISSING',
    });
    expect(blocked.body.details.issues).toContainEqual({
      field: 'sections',
      reason: 'EMPTY',
    });
  });

  it('blocks publishing a lesson whose video is not ready', async () => {
    const admin = await signIn('ADMIN');
    const { courseId, lessonId, videoAssetId } = await buildCourse(admin);
    // The demo stream client always reports ready, so the not-ready branch is
    // forced through the database the way a real PENDING encode would look.
    await prisma.videoAsset.update({
      where: { id: videoAssetId },
      data: { status: 'PENDING' },
    });
    const { CourseService } = await import('../src/catalog/course.service.js');
    const service = app.get(CourseService);
    const stream = (service as unknown as { stream: { getStatus: unknown } })
      .stream;
    const original = stream.getStatus;
    (stream as { getStatus: unknown }).getStatus = async () => ({
      ready: false,
      durationSeconds: 0,
    });
    try {
      // N2.12
      const blocked = await request(app.getHttpServer())
        .post(`/api/v1/admin/courses/${courseId}/publish`)
        .set(as(admin))
        .expect(422);
      expect(blocked.body.details.issues).toContainEqual({
        field: 'videoAsset',
        reason: 'NOT_READY',
        lessonId,
      });
    } finally {
      (stream as { getStatus: unknown }).getStatus = original;
    }
  });

  it('keeps the denormalised counters in step with the curriculum', async () => {
    const admin = await signIn('ADMIN');
    const { courseId, sectionId } = await buildCourse(admin);

    const second = await request(app.getHttpServer())
      .post(`/api/v1/admin/sections/${sectionId}/lessons`)
      .set(as(admin))
      .send({ title: 'Bài 2: Thực hành', type: 'ARTICLE' })
      .expect(201);

    // A2.4
    let course = await prisma.course.findUniqueOrThrow({
      where: { id: courseId },
    });
    const lessons = await prisma.lesson.findMany({
      where: { section: { courseId } },
    });
    expect(course.lessonCount).toBe(lessons.length);
    expect(course.totalDurationSeconds).toBe(
      lessons.reduce((total, lesson) => total + lesson.durationSeconds, 0),
    );

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/lessons/${second.body.id}`)
      .set(as(admin))
      .expect(204);
    course = await prisma.course.findUniqueOrThrow({ where: { id: courseId } });
    expect(course.lessonCount).toBe(1);
  });

  it('reorders lessons into a contiguous 1..n sequence', async () => {
    const admin = await signIn('ADMIN');
    const { sectionId } = await buildCourse(admin);
    const ids = [
      (await request(app.getHttpServer())
        .post(`/api/v1/admin/sections/${sectionId}/lessons`)
        .set(as(admin))
        .send({ title: 'Bài 2', type: 'ARTICLE' })
        .expect(201)).body.id,
      (await request(app.getHttpServer())
        .post(`/api/v1/admin/sections/${sectionId}/lessons`)
        .set(as(admin))
        .send({ title: 'Bài 3', type: 'ARTICLE' })
        .expect(201)).body.id,
    ];
    const current = await prisma.lesson.findMany({
      where: { sectionId },
      orderBy: { position: 'asc' },
      select: { id: true },
    });

    // A2.5 — move the third lesson to position 2.
    await request(app.getHttpServer())
      .put(`/api/v1/admin/sections/${sectionId}/lessons/order`)
      .set(as(admin))
      .send({ lessonIds: [current[0].id, ids[1], ids[0]] })
      .expect(204);

    const after = await prisma.lesson.findMany({
      where: { sectionId },
      orderBy: { position: 'asc' },
    });
    expect(after.map((lesson) => lesson.position)).toEqual([1, 2, 3]);
    expect(after[1].id).toBe(ids[1]);

    // A partial list is a mismatch, not a silent partial reorder.
    await request(app.getHttpServer())
      .put(`/api/v1/admin/sections/${sectionId}/lessons/order`)
      .set(as(admin))
      .send({ lessonIds: [current[0].id] })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('ORDER_MISMATCH'));
  });

  it('locks the slug after the first publish and rejects a duplicate', async () => {
    const admin = await signIn('ADMIN');
    const { courseId, slug } = await buildCourse(admin);

    // N2.6 — an explicitly typed duplicate slug.
    await request(app.getHttpServer())
      .post('/api/v1/admin/courses')
      .set(as(admin))
      .send({ title: 'Khóa học khác', slug })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('SLUG_TAKEN'));

    // A server-generated duplicate gets a suffix instead of a 409.
    const twin = await request(app.getHttpServer())
      .post('/api/v1/admin/courses')
      .set(as(admin))
      .send({ title: 'Lập trình JavaScript' })
      .expect(201);
    expect(twin.body.slug).toBe(`${slug}-2`);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/courses/${courseId}/publish`)
      .set(as(admin))
      .expect(200);

    // A2.14
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/courses/${courseId}`)
      .set(as(admin))
      .send({ slug: 'mot-slug-hoan-toan-khac' })
      .expect(409);
    const unchanged = await prisma.course.findUniqueOrThrow({
      where: { id: courseId },
    });
    expect(unchanged.slug).toBe(slug);
  });

  it('unpublishes an archived course back to draft without clearing publishedAt', async () => {
    const admin = await signIn('ADMIN');
    const { courseId } = await buildCourse(admin);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/courses/${courseId}/publish`)
      .set(as(admin))
      .expect(200);
    const published = await prisma.course.findUniqueOrThrow({
      where: { id: courseId },
    });
    await request(app.getHttpServer())
      .post(`/api/v1/admin/courses/${courseId}/archive`)
      .set(as(admin))
      .expect(200);

    // Back to draft would lock out anyone still learning (PLAN_SUPPLEMENT
    // §4.10: a DRAFT gives enrollments no access), so it waits for a revoke.
    const learner = await prisma.user.create({
      data: {
        email: `learner-${randomUUID()}@example.com`,
        passwordHash: 'not-a-real-hash',
        displayName: 'Học viên',
      },
    });
    const enrollment = await prisma.enrollment.create({
      data: { userId: learner.id, courseId, source: 'MANUAL_GRANT' },
    });
    await request(app.getHttpServer())
      .post(`/api/v1/admin/courses/${courseId}/unpublish`)
      .set(as(admin))
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('COURSE_HAS_ENROLLMENTS'));
    expect(
      await prisma.course.findUniqueOrThrow({ where: { id: courseId } }),
    ).toMatchObject({ status: 'ARCHIVED' });
    expect(
      await prisma.auditLog.count({ where: { action: 'course.unpublished' } }),
    ).toBe(0);
    await prisma.enrollment.update({
      where: { id: enrollment.id },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });

    // A2.15
    await request(app.getHttpServer())
      .post(`/api/v1/admin/courses/${courseId}/unpublish`)
      .set(as(admin))
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('DRAFT');
        expect(body.archivedAt).toBeNull();
      });
    const draft = await prisma.course.findUniqueOrThrow({
      where: { id: courseId },
    });
    expect(draft.publishedAt?.toISOString()).toBe(
      published.publishedAt?.toISOString(),
    );

    // Unpublishing a draft is a conflict, not a no-op.
    await request(app.getHttpServer())
      .post(`/api/v1/admin/courses/${courseId}/unpublish`)
      .set(as(admin))
      .expect(409);
  });

  it('makes a grant wait for a racing unpublish and then refuse the new draft', async () => {
    const admin = await signIn('ADMIN');
    const { courseId } = await buildCourse(admin);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/courses/${courseId}/publish`)
      .set(as(admin))
      .expect(200);
    const actor = await prisma.user.findFirstOrThrow({
      where: { role: 'ADMIN' },
    });
    const learner = await prisma.user.create({
      data: {
        email: `learner-${randomUUID()}@example.com`,
        passwordHash: 'not-a-real-hash',
        displayName: 'Học viên',
      },
    });

    // The open transaction holds the course row lock an unpublish holds
    // between its status update and its commit. Without a lock of its own,
    // the grant reads PUBLISHED, inserts, and lands on the draft.
    let grant!: Promise<unknown>;
    await prisma.$transaction(async (tx) => {
      await tx.course.update({
        where: { id: courseId },
        data: { status: 'DRAFT' },
      });
      grant = app
        .get(EnrollmentService)
        .grant({
          userId: learner.id,
          courseId,
          source: 'MANUAL_GRANT',
          actorId: actor.id,
        })
        .catch((error: HttpException) => error.getStatus());
      // The grant is really waiting on the lock now, not merely given time to.
      await untilBlockedOnLock(prisma);
    });

    expect(await grant).toBe(404);
    expect(await prisma.enrollment.count({ where: { courseId } })).toBe(0);
    expect(
      await prisma.course.findUniqueOrThrow({ where: { id: courseId } }),
    ).toMatchObject({ status: 'DRAFT', enrollmentCount: 0 });
  });

  it('registers a demo video that is ready immediately', async () => {
    const admin = await signIn('ADMIN');
    // A2.12
    const created = await request(app.getHttpServer())
      .post('/api/v1/admin/videos')
      .set(as(admin))
      .send({ externalId: 'demo/c1-s1-l1' })
      .expect(201);
    expect(created.body.status).toBe('READY');

    await request(app.getHttpServer())
      .get(`/api/v1/admin/videos/${created.body.id}`)
      .set(as(admin))
      .expect(200)
      .expect(({ body }) => expect(body.status).toBe('READY'));

    await request(app.getHttpServer())
      .post('/api/v1/admin/videos')
      .set(as(admin))
      .send({ externalId: 'demo/c1-s1-l1' })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('EXTERNAL_ID_TAKEN'));
  });

  it('attaches a resource to a lesson through a server-generated key', async () => {
    const admin = await signIn('ADMIN');
    const { lessonId } = await buildCourse(admin);

    const signed = await request(app.getHttpServer())
      .post(`/api/v1/admin/lessons/${lessonId}/resources/upload-url`)
      .set(as(admin))
      .send({
        filename: 'Bài tập chương 1.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1024,
      })
      .expect(201);
    expect(signed.body.objectKey).toMatch(
      new RegExp(`^lessons/${lessonId}/resources/`),
    );
    expect(signed.body.method).toBe('PUT');

    // A2.13
    await request(app.getHttpServer())
      .post(`/api/v1/admin/lessons/${lessonId}/resources`)
      .set(as(admin))
      .send({
        objectKey: signed.body.objectKey,
        filename: 'bai-tap.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1024,
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/v1/admin/lessons/${lessonId}/resources`)
      .set(as(admin))
      .expect(200)
      .expect(({ body }) => expect(body.items).toHaveLength(1));

    // 415 on a type outside the five-value allowlist.
    await request(app.getHttpServer())
      .post(`/api/v1/admin/lessons/${lessonId}/resources`)
      .set(as(admin))
      .send({
        objectKey: signed.body.objectKey,
        filename: 'x.svg',
        contentType: 'image/svg+xml',
        sizeBytes: 10,
      })
      .expect(400);
  });

  it('rejects a negative price at the DTO and at the database', async () => {
    const admin = await signIn('ADMIN');
    const { courseId } = await buildCourse(admin);

    // N2.7 — first the DTO.
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/courses/${courseId}`)
      .set(as(admin))
      .send({ priceVnd: -1 })
      .expect(400);

    // Then the handwritten CHECK, bypassing the application entirely.
    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE courses SET price_vnd = -1 WHERE id = '${courseId}'`,
      ),
    ).rejects.toThrow(/courses_price_vnd_check/);
  });

  it('rejects a strike-through price that is not above the selling price', async () => {
    const admin = await signIn('ADMIN');
    const { courseId } = await buildCourse(admin);
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/courses/${courseId}`)
      .set(as(admin))
      .send({ compareAtPriceVnd: 100_000 })
      .expect(400);

    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE courses SET compare_at_price_vnd = 1 WHERE id = '${courseId}'`,
      ),
    ).rejects.toThrow(/courses_compare_price_check/);
  });

  it('clamps pageSize and always answers with the full pagination shape', async () => {
    // A2.8
    await request(app.getHttpServer())
      .get('/api/v1/courses?pageSize=200')
      .expect(200)
      .expect(({ body }) => {
        expect(Object.keys(body).sort()).toEqual([
          'items',
          'page',
          'pageSize',
          'total',
          'totalPages',
        ]);
        expect(body.pageSize).toBe(100);
      });

    // A page past the end is an empty list, not a 404.
    await request(app.getHttpServer())
      .get('/api/v1/courses?page=99')
      .expect(200)
      .expect(({ body }) => expect(body.items).toEqual([]));

    // Sort outside the whitelist is a validation error, not a silent default.
    await request(app.getHttpServer())
      .get('/api/v1/courses?sort=passwordHash:asc')
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('VALIDATION_FAILED'));
  });

  it('matches an unaccented query against an accented title', async () => {
    const admin = await signIn('ADMIN');
    const { courseId } = await buildCourse(admin, {
      title: 'Lập trình web hiện đại',
    });
    await request(app.getHttpServer())
      .post(`/api/v1/admin/courses/${courseId}/publish`)
      .set(as(admin))
      .expect(200);

    // A2.1
    await request(app.getHttpServer())
      .get('/api/v1/courses?q=lap%20trinh')
      .expect(200)
      .expect(({ body }) => {
        expect(body.total).toBe(1);
        expect(body.items[0].title).toBe('Lập trình web hiện đại');
      });

    await request(app.getHttpServer())
      .get('/api/v1/courses?q=khong-co-gi-khop')
      .expect(200)
      .expect(({ body }) => expect(body.total).toBe(0));
  });

  it('refuses to serve a traversal key even with a valid signature', async () => {
    const { LocalDiskStorage } = await import(
      '../src/media/local-disk.storage.js'
    );
    const storage = new LocalDiskStorage();
    const url = new URL(await storage.signedDownloadUrl('../../.env', 300));

    // N2.10
    await request(app.getHttpServer())
      .get(`/api/v1/media/local/../../.env${url.search}`)
      .expect((response) => {
        expect([403, 404]).toContain(response.status);
        expect(JSON.stringify(response.body)).not.toContain('AUTH_JWT_SECRET');
      });
  });

  it('serves a public cover key without a signature and refuses an unsigned write', async () => {
    const { LocalDiskStorage } = await import(
      '../src/media/local-disk.storage.js'
    );
    const storage = new LocalDiskStorage();
    const courseId = randomUUID();
    const key = `public/courses/${courseId}/cover/${randomUUID()}.png`;
    const upload = new URL(
      await storage.signedUploadUrl(key, 'image/png', 300),
    );

    await request(app.getHttpServer())
      .put(`/api/v1/media/local/${key}${upload.search}`)
      .set('Content-Type', 'image/png')
      .send(Buffer.from([0x89, 0x50, 0x4e, 0x47]))
      .expect(204);

    // A2.7 — read back with no exp and no sig at all.
    await request(app.getHttpServer())
      .get(`/api/v1/media/local/${key}`)
      .expect(200)
      .expect('Content-Type', /image\/png/)
      .expect('X-Content-Type-Options', 'nosniff');

    // N2.14 — a valid signature does not buy a write outside the cover shape.
    const rogue = new URL(
      await storage.signedUploadUrl('public/x.svg', 'image/png', 300),
    );
    await request(app.getHttpServer())
      .put(`/api/v1/media/local/public/x.svg${rogue.search}`)
      .set('Content-Type', 'image/png')
      .send(Buffer.from('<svg/>'))
      .expect(403)
      .expect(({ body }) => expect(body.code).toBe('SIGNATURE_INVALID'));

    await storage.delete(key);
  });

  it('refuses to delete a category that still has courses', async () => {
    const admin = await signIn('ADMIN');
    const { categoryId } = await buildCourse(admin);
    await request(app.getHttpServer())
      .delete(`/api/v1/admin/categories/${categoryId}`)
      .set(as(admin))
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('CATEGORY_NOT_EMPTY'));
  });

  it('reports the real draft count on the admin overview', async () => {
    const admin = await signIn('ADMIN');
    await buildCourse(admin);

    // A2.11
    await request(app.getHttpServer())
      .get('/api/v1/admin/reports/overview')
      .set(as(admin))
      .expect(200)
      .expect(({ body }) => {
        expect(Object.keys(body).sort()).toEqual([
          'activeEnrollments',
          'draftCourses',
          'newStudents',
          'paidPurchases',
          'pendingPaymentAttempts',
          'revenueVnd',
          'series',
          'videoAssetsNotReady',
        ]);
        expect(body.draftCourses).toBe(1);
        expect(body.series.length).toBeGreaterThan(0);
        expect(body.series[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
  });

  it('writes exactly one audit row per admin mutation, with the actor and the required metadata', async () => {
    const admin = await signIn('ADMIN');
    const { id: adminId } = await prisma.user.findFirstOrThrow({
      where: { role: 'ADMIN' },
    });
    const { categoryId, courseId, lessonId, videoAssetId } =
      await buildCourse(admin);

    // buildCourse: category, course, section, video, lesson, the lesson PATCH
    // that attaches the video, the course PATCH.
    const built = await prisma.auditLog.findMany();
    expect(built.map((row) => row.action).sort()).toEqual([
      'category.created',
      'course.created',
      'course.updated',
      'lesson.created',
      'section.created',
      'video.attached',
      'video.registered',
    ]);

    const archive = () =>
      request(app.getHttpServer())
        .post(`/api/v1/admin/courses/${courseId}/archive`)
        .set(as(admin));
    // Rejected mutations change nothing, so they record nothing. A draft was
    // never sold, so it cannot be archived (DATA_MODEL §Chuyển trạng thái).
    await archive().expect(409);
    const publish = () =>
      request(app.getHttpServer())
        .post(`/api/v1/admin/courses/${courseId}/publish`)
        .set(as(admin));
    await publish().expect(200);
    // PUBLISHED → PUBLISHED is not a transition.
    await publish().expect(409);
    await archive().expect(200);
    // Archiving twice would rewrite archivedAt.
    await archive().expect(409);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/courses/${courseId}/unpublish`)
      .set(as(admin))
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/lessons/${lessonId}`)
      .set(as(admin))
      .send({ title: 'Bài 1: Cài đặt môi trường' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/lessons/${lessonId}`)
      .set(as(admin))
      .send({ videoAssetId: null })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/courses/${courseId}/publish`)
      .set(as(admin))
      .expect(422);
    await request(app.getHttpServer())
      .delete(`/api/v1/admin/categories/${categoryId}`)
      .set(as(admin))
      .expect(409);

    // Deleting a lesson reports how much learner progress went with it.
    const learner = await prisma.user.create({
      data: {
        email: `learner-${randomUUID()}@example.com`,
        passwordHash: 'not-a-real-hash',
        displayName: 'Học viên',
      },
    });
    await prisma.lessonProgress.create({
      data: { userId: learner.id, lessonId, lastPositionSeconds: 30 },
    });
    await request(app.getHttpServer())
      .delete(`/api/v1/admin/lessons/${lessonId}`)
      .set(as(admin))
      .expect(204);
    expect(await prisma.lessonProgress.count({ where: { lessonId } })).toBe(0);

    const rows = await prisma.auditLog.findMany();
    expect(rows).toHaveLength(13);
    for (const row of rows) {
      const entry =
        AUDIT_VOCABULARY[row.action as keyof typeof AUDIT_VOCABULARY];
      expect(entry, row.action).toBeDefined();
      expect(row.entityType).toBe(entry.entityType);
      expect(row.actorId).toBe(adminId);
      expect(row.ipAddress).toBeTruthy();
      for (const key of entry.keys) {
        expect(row.metadata, `${row.action}.${key}`).toHaveProperty(key);
      }
    }

    const byAction = (action: string) =>
      rows.filter((row) => row.action === action);
    expect(byAction('lesson.updated')).toHaveLength(1);
    expect(byAction('lesson.updated')[0].metadata).toMatchObject({
      courseId,
      title: 'Bài 1: Cài đặt môi trường',
      changedFields: ['title'],
    });
    expect(byAction('video.detached')[0]).toMatchObject({
      entityId: lessonId,
      metadata: { videoAssetId, courseId, changedFields: ['videoAssetId'] },
    });
    expect(byAction('course.unpublished')[0].metadata).toMatchObject({
      fromStatus: 'ARCHIVED',
    });
    expect(byAction('lesson.deleted')[0].metadata).toMatchObject({
      deletedProgressRows: 1,
    });
    expect(byAction('course.published')).toHaveLength(1);
    expect(byAction('course.archived')).toHaveLength(1);
    expect(byAction('category.deleted')).toEqual([]);
  });

  it('enforces the learning tables at the database and counts real enrollments', async () => {
    const admin = await signIn('ADMIN');
    const { id: adminId } = await prisma.user.findFirstOrThrow({
      where: { role: 'ADMIN' },
    });
    const { courseId, lessonId } = await buildCourse(admin);
    const student = await prisma.user.create({
      data: {
        email: `student-${randomUUID()}@example.com`,
        passwordHash: 'not-a-real-hash',
        displayName: 'Học viên',
      },
    });

    const enrollment = await prisma.enrollment.create({
      data: {
        userId: student.id,
        courseId,
        source: 'MANUAL_GRANT',
        grantedById: adminId,
        status: 'REVOKED',
        revokedAt: new Date(),
      },
    });

    // One row per (user, course) and per (user, lesson), enforced by the
    // database rather than by the service that normally writes them.
    await expect(
      prisma.enrollment.create({
        data: { userId: student.id, courseId, source: 'MANUAL_GRANT' },
      }),
    ).rejects.toThrow();
    await prisma.lessonProgress.create({
      data: { userId: student.id, lessonId },
    });
    await expect(
      prisma.lessonProgress.create({ data: { userId: student.id, lessonId } }),
    ).rejects.toThrow();

    // Any enrollment row, a revoked one included, blocks a hard delete.
    await request(app.getHttpServer())
      .delete(`/api/v1/admin/courses/${courseId}`)
      .set(as(admin))
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('COURSE_HAS_ENROLLMENTS'));
    // And a user who ever held one cannot be hard-deleted (FK Restrict).
    await expect(
      prisma.user.delete({ where: { id: student.id } }),
    ).rejects.toThrow();

    const overview = async () =>
      (
        await request(app.getHttpServer())
          .get('/api/v1/admin/reports/overview')
          .set(as(admin))
          .expect(200)
      ).body.activeEnrollments;
    expect(await overview()).toBe(0);
    await prisma.enrollment.update({
      where: { id: enrollment.id },
      data: { status: 'ACTIVE', revokedAt: null },
    });
    expect(await overview()).toBe(1);
  });

  // REVIEW F-06 / F-13: positions, id sets and the lesson counter were read
  // outside the transaction, so two writers picked the same position and the
  // loser hit the unique index (or the counter drifted).
  it('takes eight simultaneous new lessons in one section without a collision', async () => {
    const admin = await signIn('ADMIN');
    const { courseId, sectionId } = await buildCourse(admin);

    const results = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        request(app.getHttpServer())
          .post(`/api/v1/admin/sections/${sectionId}/lessons`)
          .set(as(admin))
          .send({ title: `Bài song song ${index + 1}`, type: 'ARTICLE' }),
      ),
    );

    expect(results.map((response) => response.status)).toEqual(
      Array(8).fill(201),
    );
    const course = await request(app.getHttpServer())
      .get(`/api/v1/admin/courses/${courseId}`)
      .set(as(admin))
      .expect(200);
    const positions = course.body.sections[0].lessons.map(
      (lesson: { position: number }) => lesson.position,
    );
    expect(positions).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(course.body.lessonCount).toBe(9);
  });

  it('takes eight simultaneous new sections in one course without a collision', async () => {
    const admin = await signIn('ADMIN');
    const { courseId } = await buildCourse(admin);

    const results = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        request(app.getHttpServer())
          .post(`/api/v1/admin/courses/${courseId}/sections`)
          .set(as(admin))
          .send({ title: `Chương song song ${index + 1}` }),
      ),
    );

    expect(results.map((response) => response.status)).toEqual(
      Array(8).fill(201),
    );
    const course = await request(app.getHttpServer())
      .get(`/api/v1/admin/courses/${courseId}`)
      .set(as(admin))
      .expect(200);
    expect(
      course.body.sections.map((section: { position: number }) => section.position),
    ).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('deletes a draft course for good and frees its slug', async () => {
    const admin = await signIn('ADMIN');
    const { courseId, slug } = await buildCourse(admin);

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/courses/${courseId}`)
      .set(as(admin))
      .expect(204);
    await request(app.getHttpServer())
      .get(`/api/v1/admin/courses/${courseId}`)
      .set(as(admin))
      .expect(404);

    const recreated = await request(app.getHttpServer())
      .post('/api/v1/admin/courses')
      .set(as(admin))
      .send({ title: 'Lập trình JavaScript' })
      .expect(201);
    expect(recreated.body.slug).toBe(slug);
  });

  // REVIEW F-08 / DATA_MODEL.md §Xóa: only a draft may be deleted. A published
  // course with no students used to go too, freeing a slug that shared links
  // and the sitemap already point at.
  it('refuses to delete a published course even when nobody has enrolled', async () => {
    const admin = await signIn('ADMIN');
    const { courseId, slug } = await buildCourse(admin);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/courses/${courseId}/publish`)
      .set(as(admin))
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/courses/${courseId}`)
      .set(as(admin))
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('CONFLICT'));
    await request(app.getHttpServer()).get(`/api/v1/courses/${slug}`).expect(200);
  });

  it('rate limits admin mutations per admin but never admin reads', async () => {
    const admin = await signIn('ADMIN');
    const missing = randomUUID();
    const rename = (session: Session) =>
      request(app.getHttpServer())
        .patch(`/api/v1/admin/categories/${missing}`)
        .set(as(session))
        .send({ name: 'Không tồn tại' });

    for (let attempt = 0; attempt < 120; attempt += 1) {
      await rename(admin).expect(404);
    }
    await rename(admin)
      .expect(429)
      .expect('Retry-After', /^\d+$/)
      .expect(({ body }) => expect(body.code).toBe('RATE_LIMITED'));

    // Reads have no limit at all: more GETs than the mutation limit all pass.
    for (let attempt = 0; attempt <= 120; attempt += 1) {
      await request(app.getHttpServer())
        .get('/api/v1/admin/categories')
        .set(as(admin))
        .expect(200);
    }

    // The bucket belongs to the admin (per method and route, like the auth
    // limits): a second session of the same admin is still limited, while
    // another admin is not. Every e2e request shares one IP, so not the IP.
    const { email } = await prisma.user.findFirstOrThrow({
      where: { role: 'ADMIN' },
    });
    await rename(await signIn('ADMIN', email)).expect(429);
    await rename(await signIn('ADMIN')).expect(404);
  });
});
