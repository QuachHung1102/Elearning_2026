import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { hashPassword } from '../src/auth/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

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

  async function signIn(role: 'ADMIN' | 'STUDENT'): Promise<Session> {
    const email = `${role.toLowerCase()}-${randomUUID()}@example.com`;
    await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(PASSWORD),
        displayName: role === 'ADMIN' ? 'Quản trị viên' : 'Học viên',
        role,
        emailVerifiedAt: new Date(),
      },
    });

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
    const { CatalogService } = await import('../src/catalog/catalog.service.js');
    const service = app.get(CatalogService);
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
});
