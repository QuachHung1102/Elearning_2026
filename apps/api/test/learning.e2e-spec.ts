import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { Test, type TestingModule } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { hashPassword } from '../src/auth/password.js';
import { playbackMessage, sign } from '../src/media/object-storage.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { STREAM_CLIENT, type StreamClient } from '../src/media/stream.client.js';

/**
 * Fixtures are the real seed (DATA_MODEL.md §Dữ liệu seed), run once against
 * the test database — it is idempotent. Nothing here truncates; every test
 * that mutates state (grant, revoke, progress, block) does it on a throwaway
 * user, so the seeded accounts look the same on every run.
 */
const C1 = 'lap-trinh-web-voi-react-va-nextjs';
const C5_DRAFT = 'kien-truc-backend-voi-nestjs';
const C6_ARCHIVED = 'lap-trinh-di-dong-voi-react-native';
const ADMIN = 'admin@elearning.local';
const STUDENT1 = 'student1@elearning.local';
const STUDENT2 = 'student2@elearning.local';
const STUDENT3 = 'student3@elearning.local';
const SEED_PASSWORDS: Record<string, string> = {
  [ADMIN]: 'Demo!Admin123',
  [STUDENT1]: 'Demo!Student123',
  [STUDENT2]: 'Demo!Student123',
  [STUDENT3]: 'Demo!Student123',
};
const THROWAWAY_PASSWORD = 'correct horse battery staple';

type Session = { cookies: string[]; token: string };
type LessonRow = {
  id: string;
  type: 'VIDEO' | 'ARTICLE';
  isPreview: boolean;
  videoAssetId: string | null;
};

describe('Phase 3 learning (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let admin: Session;
  let student1: Session;
  let student2: Session;
  let student3: Session;
  /** CSRF cookie and header, no session: the global CSRF guard runs first. */
  let guest: Session;
  let c1: { id: string; lessons: LessonRow[] };
  let c5: { id: string; lessons: LessonRow[] };
  let c6: { id: string; lessons: LessonRow[] };

  let clientIp = 0;
  const nextIp = () =>
    `10.3.${Math.floor(clientIp / 250)}.${(clientIp += 1) % 250}`;

  const jar = (value: string | string[] | undefined) =>
    (Array.isArray(value) ? value : value ? [value] : []).map(
      (cookie) => cookie.split(';')[0],
    );

  const http = () => request(app.getHttpServer());

  async function signIn(email: string, password?: string): Promise<Session> {
    const csrf = await http().get('/api/v1/auth/csrf').expect(200);
    const csrfCookies = jar(csrf.headers['set-cookie']);
    const token = csrf.body.csrfToken as string;
    const response = await http()
      .post('/api/v1/auth/login')
      .set('Cookie', csrfCookies.join('; '))
      .set('X-CSRF-Token', token)
      .set('X-Real-IP', nextIp())
      .send({ email, password: password ?? SEED_PASSWORDS[email] })
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

  /** A fresh learner, optionally granted `courseId` through the admin API. */
  async function throwawayLearner(courseId?: string) {
    const user = await prisma.user.create({
      data: {
        email: `hoc-vien-${randomUUID()}@example.com`,
        passwordHash: await hashPassword(THROWAWAY_PASSWORD),
        displayName: 'Học viên tạm',
      },
      select: { id: true, email: true },
    });
    let enrollmentId: string | undefined;
    if (courseId) {
      const granted = await http()
        .post('/api/v1/admin/enrollments')
        .set(as(admin))
        .send({ userId: user.id, courseId })
        .expect(201);
      enrollmentId = granted.body.id as string;
    }
    return {
      ...user,
      enrollmentId,
      session: await signIn(user.email, THROWAWAY_PASSWORD),
    };
  }

  async function loadCourse(slug: string) {
    const course = await prisma.course.findUniqueOrThrow({
      where: { slug },
      select: { id: true },
    });
    const lessons = await prisma.lesson.findMany({
      where: { section: { courseId: course.id } },
      orderBy: [{ section: { position: 'asc' } }, { position: 'asc' }],
      select: { id: true, type: true, isPreview: true, videoAssetId: true },
    });
    return { id: course.id, lessons };
  }

  const paidVideo = (course: { lessons: LessonRow[] }) =>
    course.lessons.find(
      (lesson) => lesson.type === 'VIDEO' && !lesson.isPreview,
    )!;
  const previewVideo = (course: { lessons: LessonRow[] }) =>
    course.lessons.find(
      (lesson) => lesson.type === 'VIDEO' && lesson.isPreview,
    )!;
  const article = (course: { lessons: LessonRow[] }) =>
    course.lessons.find((lesson) => lesson.type === 'ARTICLE')!;

  const playback = (lessonId: string, session: Session) =>
    http().post(`/api/v1/lessons/${lessonId}/playback-token`).set(as(session));
  const content = (lessonId: string, session: Session) =>
    http().get(`/api/v1/lessons/${lessonId}/content`).set(as(session));
  const shell = (slug: string, session: Session) =>
    http().get(`/api/v1/learn/${slug}`).set(as(session));
  const saveProgress = (lessonId: string, session: Session, body: object) =>
    http()
      .put(`/api/v1/lessons/${lessonId}/progress`)
      .set(as(session))
      .send(body);

  /** The media path of a playback URL, as the test server sees it. */
  const mediaPath = (url: string) => {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  };

  beforeAll(async () => {
    const apiDirectory = resolve(import.meta.dirname, '..');
    const tsx = createRequire(import.meta.url).resolve('tsx/cli');
    execFileSync(process.execPath, [tsx, 'prisma/seed.ts'], {
      cwd: apiDirectory,
      env: process.env,
      stdio: 'inherit',
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    [admin, student1, student2, student3] = await Promise.all([
      signIn(ADMIN),
      signIn(STUDENT1),
      signIn(STUDENT2),
      signIn(STUDENT3),
    ]);
    const csrf = await http().get('/api/v1/auth/csrf').expect(200);
    guest = {
      cookies: jar(csrf.headers['set-cookie']),
      token: csrf.body.csrfToken as string,
    };
    // The seeded draft has no preview lesson; the DEMO_MODE §2 matrix needs
    // one. Flipped here, restored in afterAll (and by the next seed run).
    const draft = await loadCourse(C5_DRAFT);
    await prisma.lesson.update({
      where: { id: paidVideo(draft).id },
      data: { isPreview: true },
    });
    [c1, c5, c6] = await Promise.all([
      loadCourse(C1),
      loadCourse(C5_DRAFT),
      loadCourse(C6_ARCHIVED),
    ]);
  }, 180_000);

  afterAll(async () => {
    await prisma.lesson.update({
      where: { id: previewVideo(c5).id },
      data: { isPreview: false },
    });
    await app.close();
  });

  it('issues a playback token with exactly three keys and serves it to its viewer only', async () => {
    // A3.4
    const token = await playback(paidVideo(c1).id, student1)
      .expect(200)
      .expect('Cache-Control', 'no-store');
    expect(Object.keys(token.body).sort()).toEqual([
      'expiresAt',
      'kind',
      'playbackUrl',
    ]);
    expect(token.body.kind).toBe('mp4');

    // N3.12: a signed, expiring URL on the shared media route.
    const url = new URL(token.body.playbackUrl as string);
    expect(url.pathname).toMatch(
      /^\/api\/v1\/media\/local\/videos\/[A-Za-z0-9_-]+\.mp4$/,
    );
    expect(url.searchParams.get('exp')).toMatch(/^\d+$/);
    expect(url.searchParams.get('sig')).toBeTruthy();
    expect(Date.parse(token.body.expiresAt as string)).toBe(
      Number(url.searchParams.get('exp')) * 1000,
    );

    // A3.5
    const path = mediaPath(token.body.playbackUrl as string);
    const full = await http()
      .get(path)
      .set(as(student1))
      .buffer(true)
      .parse((response, done) => {
        response.on('data', () => undefined);
        response.on('end', () => done(null, null));
      })
      .expect(200)
      .expect('Content-Type', 'video/mp4')
      .expect('Accept-Ranges', 'bytes')
      .expect('Cache-Control', 'private, no-store');
    const size = Number(full.headers['content-length']);
    expect(size).toBeGreaterThan(0);
    const partial = await http()
      .get(path)
      .set(as(student1))
      .set('Range', 'bytes=0-1023')
      .expect(206);
    expect(partial.headers['content-range']).toBe(`bytes 0-1023/${size}`);
    await http()
      .get(path)
      .set(as(student1))
      .set('Range', `bytes=${size}-`)
      .expect(416)
      .expect('Content-Range', `bytes */${size}`);

    // N3.4: student2 is enrolled in C1 too, and still cannot use this URL.
    await http()
      .get(path)
      .set(as(student2))
      .expect(403)
      .expect(({ body }) => expect(body.code).toBe('SIGNATURE_INVALID'));
    await http().get(path).expect(403);

    // N3.3: a correctly signed URL whose `exp` has passed.
    const me = await prisma.user.findUniqueOrThrow({
      where: { email: STUDENT1 },
      select: { id: true },
    });
    const key = url.pathname.replace('/api/v1/media/local/', '');
    const past = Math.floor(Date.now() / 1000) - 5;
    await http()
      .get(
        `/api/v1/media/local/${key}?exp=${past}&sig=${sign(playbackMessage(key, past, me.id))}`,
      )
      .set(as(student1))
      .expect(403)
      .expect(({ body }) => expect(body.code).toBe('SIGNATURE_INVALID'));
  });

  /**
   * DEMO_MODE §1/§2: the access matrix is written once and run against both
   * `StreamClient` implementations — the demo driver the app boots with, and
   * a stand-in for the Cloudflare one (ready, HLS) swapped in through
   * `overrideProvider`. Steps 1–6 must not depend on which driver answers.
   */
  const hlsStream: StreamClient = {
    getStatus: async () => ({ ready: true, durationSeconds: 60 }),
    signPlayback: async (uid, ttlSeconds) => ({
      playbackUrl: `https://stream.example.test/${uid}/manifest/video.m3u8`,
      kind: 'hls',
      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
    }),
  };

  it.each([
    ['LocalStreamClient', 'mp4'],
    ['a stub StreamClient', 'hls'],
  ] as const)('applies the DEMO_MODE §2 playback matrix with %s', async (_name, kind) => {
    let stubApp: NestExpressApplication | undefined;
    if (kind === 'hls') {
      const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(STREAM_CLIENT)
        .useValue(hlsStream)
        .compile();
      stubApp = moduleFixture.createNestApplication<NestExpressApplication>();
      configureApp(stubApp);
      await stubApp.init();
    }
    const server = (stubApp ?? app).getHttpServer();
    const playback = (lessonId: string, session: Session) =>
      request(server)
        .post(`/api/v1/lessons/${lessonId}/playback-token`)
        .set(as(session));
    try {
      // Preview lesson of a DRAFT course: hidden from students, open to admin.
      await playback(previewVideo(c5).id, student3).expect(404);
      await playback(previewVideo(c5).id, admin)
        .expect(200)
        .expect(({ body }) => expect(body.kind).toBe(kind));
      // Preview lesson of a PUBLISHED course: sign-in required, purchase not.
      await playback(previewVideo(c1).id, guest)
        .expect(401)
        .expect(({ body }) => expect(body.code).toBe('UNAUTHENTICATED'));
      await playback(previewVideo(c1).id, student3).expect(200);
      // N3.1, N3.2
      await playback(paidVideo(c1).id, student3)
        .expect(403)
        .expect(({ body }) => expect(body.code).toBe('NOT_ENROLLED'));
      await playback(paidVideo(c1).id, guest).expect(401);
      await playback(paidVideo(c1).id, student1).expect(200);
      await playback(paidVideo(c1).id, admin).expect(200);
      // N3.13
      await playback(article(c1).id, student1)
        .expect(404)
        .expect(({ body }) => expect(body.code).toBe('NOT_FOUND'));
      await playback(randomUUID(), student1).expect(404);
      await playback('khong-phai-uuid', student1).expect(400);
    } finally {
      await stubApp?.close();
    }
  });

  it('returns the learner shell with progress and the resume lesson', async () => {
    const response = await shell(C1, student1)
      .expect(200)
      .expect('Cache-Control', 'no-store');
    expect(Object.keys(response.body).sort()).toEqual([
      'completedLessonIds',
      'course',
      'progress',
      'resumeLessonId',
    ]);
    expect(response.body.course).toMatchObject({
      id: c1.id,
      slug: C1,
      status: 'PUBLISHED',
    });
    expect(response.body.course.sections.length).toBeGreaterThan(0);
    expect(response.text).not.toContain('videoAssetId');
    // Seed: the first eight lessons are done, the ninth is the resume point.
    expect(response.body.progress).toEqual({
      completedLessons: 8,
      totalLessons: c1.lessons.length,
      percent: Math.round((100 * 8) / c1.lessons.length),
    });
    expect(response.body.completedLessonIds).toEqual(
      c1.lessons.slice(0, 8).map(({ id }) => id),
    );
    expect(response.body.resumeLessonId).toBe(c1.lessons[8].id);

    await shell(C1, student3)
      .expect(403)
      .expect(({ body }) => expect(body.code).toBe('NOT_ENROLLED'));
    await http().get(`/api/v1/learn/${C1}`).expect(401);
    await shell(C5_DRAFT, student3).expect(404);
    await shell(C6_ARCHIVED, student3).expect(404);
    await shell('khong-ton-tai', student1).expect(404);
  });

  it('returns LessonContent by access mode and never leaks content to a non-enrolled learner', async () => {
    const resource = await prisma.lessonResource.findFirstOrThrow({
      where: { lesson: { section: { courseId: c1.id } } },
      orderBy: { position: 'asc' },
      select: { id: true, lessonId: true, filename: true },
    });

    const enrolled = await content(resource.lessonId, student1)
      .expect(200)
      .expect('Cache-Control', 'no-store');
    expect(Object.keys(enrolled.body).sort()).toEqual(
      [
        'content',
        'courseId',
        'durationSeconds',
        'hasVideo',
        'id',
        'isPreview',
        'nextLessonId',
        'prevLessonId',
        'progress',
        'resources',
        'sectionId',
        'title',
        'type',
      ].sort(),
    );
    expect(enrolled.body.resources).toContainEqual(
      expect.objectContaining({ id: resource.id, filename: resource.filename }),
    );
    expect(enrolled.text).not.toContain('objectKey');
    expect(enrolled.text).not.toContain('externalId');

    // prev/next run across section boundaries in curriculum order.
    // C1's first section has five lessons, so index 5 opens section 2.
    const firstOfSection2 = 5;
    const crossing = await content(
      c1.lessons[firstOfSection2].id,
      student1,
    ).expect(200);
    expect(crossing.body.prevLessonId).toBe(c1.lessons[firstOfSection2 - 1].id);
    expect(crossing.body.nextLessonId).toBe(c1.lessons[firstOfSection2 + 1].id);
    const first = await content(c1.lessons[0].id, student1).expect(200);
    expect(first.body.prevLessonId).toBeNull();
    expect(first.body.progress).toMatchObject({
      completedAt: expect.any(String),
    });
    const last = await content(c1.lessons.at(-1)!.id, student1).expect(200);
    expect(last.body.nextLessonId).toBeNull();

    // N3.10
    const denied = await content(paidVideo(c1).id, student3).expect(403);
    expect(denied.body.code).toBe('NOT_ENROLLED');
    expect(denied.body).not.toHaveProperty('content');

    // Preview: readable, but no resources and no progress.
    const preview = await content(previewVideo(c1).id, student3).expect(200);
    expect(preview.body).toMatchObject({
      isPreview: true,
      hasVideo: true,
      resources: [],
      progress: null,
    });
    await content(previewVideo(c5).id, student3).expect(404);
  });

  it('lets an admin without an enrollment preview a DRAFT course silently (A3.14)', async () => {
    const before = {
      progress: await prisma.lessonProgress.count(),
      enrollmentCount: (
        await prisma.course.findUniqueOrThrow({ where: { id: c5.id } })
      ).enrollmentCount,
    };

    const response = await shell(C5_DRAFT, admin).expect(200);
    expect(response.body.course.status).toBe('DRAFT');
    expect(response.body.progress).toEqual({
      completedLessons: 0,
      totalLessons: c5.lessons.length,
      percent: 0,
    });
    expect(response.body.completedLessonIds).toEqual([]);
    expect(response.body.resumeLessonId).toBe(c5.lessons[0].id);

    const lesson = await content(paidVideo(c5).id, admin).expect(200);
    expect(lesson.body).toMatchObject({ resources: [], progress: null });
    await playback(paidVideo(c5).id, admin).expect(200);
    await saveProgress(paidVideo(c5).id, admin, { lastPositionSeconds: 30 })
      .expect(403)
      .expect(({ body }) => expect(body.code).toBe('NOT_ENROLLED'));
    await http()
      .get(`/api/v1/learn/${C1}`)
      .set(as(admin))
      .expect(200)
      .expect(({ body }) => expect(body.progress.completedLessons).toBe(0));

    expect(await prisma.lessonProgress.count()).toBe(before.progress);
    expect(
      (await prisma.course.findUniqueOrThrow({ where: { id: c5.id } }))
        .enrollmentCount,
    ).toBe(before.enrollmentCount);
  });

  it('saves progress: position never goes back, completion is set once and can be un-marked', async () => {
    const learner = await throwawayLearner(c1.id);
    const video = paidVideo(c1);

    // A3.6
    const saved = await saveProgress(video.id, learner.session, {
      lastPositionSeconds: 120,
    })
      .expect(200)
      .expect('Cache-Control', 'no-store');
    expect(saved.body).toEqual({
      progress: { lastPositionSeconds: 120, completedAt: null },
      courseProgress: {
        completedLessons: 0,
        totalLessons: c1.lessons.length,
        percent: 0,
      },
    });
    await content(video.id, learner.session)
      .expect(200)
      .expect(({ body }) =>
        expect(body.progress.lastPositionSeconds).toBe(120),
      );
    await shell(C1, learner.session)
      .expect(200)
      .expect(({ body }) => expect(body.resumeLessonId).toBe(video.id));

    // A stale, lower position does not undo the later one.
    await saveProgress(video.id, learner.session, { lastPositionSeconds: 20 })
      .expect(200)
      .expect(({ body }) =>
        expect(body.progress.lastPositionSeconds).toBe(120),
      );

    // A3.7: the client sends completed=true once it passes the threshold.
    const done = await saveProgress(video.id, learner.session, {
      lastPositionSeconds: 130,
      completed: true,
    }).expect(200);
    expect(done.body.courseProgress.completedLessons).toBe(1);
    const row = await prisma.lessonProgress.findUniqueOrThrow({
      where: { userId_lessonId: { userId: learner.id, lessonId: video.id } },
    });
    expect(row.completedAt).not.toBeNull();
    await saveProgress(video.id, learner.session, {
      lastPositionSeconds: 140,
      completed: true,
    })
      .expect(200)
      .expect(({ body }) =>
        expect(body.progress.completedAt).toBe(row.completedAt!.toISOString()),
      );

    // An article only records 0, and un-marking clears completedAt.
    const reading = article(c1);
    await saveProgress(reading.id, learner.session, {
      lastPositionSeconds: 55,
      completed: true,
    })
      .expect(200)
      .expect(({ body }) => {
        expect(body.progress.lastPositionSeconds).toBe(0);
        expect(body.courseProgress.completedLessons).toBe(2);
      });
    await saveProgress(reading.id, learner.session, {
      lastPositionSeconds: 0,
      completed: false,
    })
      .expect(200)
      .expect(({ body }) => {
        expect(body.progress.completedAt).toBeNull();
        expect(body.courseProgress.completedLessons).toBe(1);
      });

    // Validation: DTO bounds and no unknown fields.
    await saveProgress(video.id, learner.session, {
      lastPositionSeconds: -1,
    }).expect(400);
    await saveProgress(video.id, learner.session, {
      lastPositionSeconds: 86_401,
    }).expect(400);
    await saveProgress(video.id, learner.session, {
      lastPositionSeconds: 1,
      completedAt: '2026-01-01',
    }).expect(400);
  });

  it('keeps completion and the highest position when saves race', async () => {
    const learner = await throwawayLearner(c1.id);
    const video = paidVideo(c1);
    // One complete toggle racing ten player ticks that omit `completed`.
    await Promise.all([
      saveProgress(video.id, learner.session, {
        lastPositionSeconds: 0,
        completed: true,
      }).expect(200),
      ...Array.from({ length: 10 }, (_, index) =>
        saveProgress(video.id, learner.session, {
          lastPositionSeconds: index + 1,
        }).expect(200),
      ),
    ]);
    const row = await prisma.lessonProgress.findUniqueOrThrow({
      where: { userId_lessonId: { userId: learner.id, lessonId: video.id } },
    });
    expect(row.completedAt).not.toBeNull();
    expect(row.lastPositionSeconds).toBe(10);
  });

  it('refuses progress for a course the caller is not enrolled in and writes nothing (N3.7)', async () => {
    const me = await prisma.user.findUniqueOrThrow({
      where: { email: STUDENT3 },
      select: { id: true },
    });
    await saveProgress(paidVideo(c1).id, student3, { lastPositionSeconds: 10 })
      .expect(403)
      .expect(({ body }) => expect(body.code).toBe('NOT_ENROLLED'));
    // A preview lesson is readable, but a preview view is not progress.
    await saveProgress(previewVideo(c1).id, student3, {
      lastPositionSeconds: 10,
    }).expect(403);
    await saveProgress(previewVideo(c5).id, student3, {
      lastPositionSeconds: 10,
    }).expect(404);
    // Scoped to the lessons tried: the seed upserts, so progress another file
    // gave student3 (checkout-flow buys a course) survives into this one.
    expect(
      await prisma.lessonProgress.count({
        where: {
          userId: me.id,
          lessonId: {
            in: [paidVideo(c1).id, previewVideo(c1).id, previewVideo(c5).id],
          },
        },
      }),
    ).toBe(0);
  });

  it('signs a resource download for an enrolled learner only (N3.6)', async () => {
    const resource = await prisma.lessonResource.findFirstOrThrow({
      where: { lesson: { section: { courseId: c1.id } } },
      select: { id: true, lessonId: true, filename: true },
    });
    const path = `/api/v1/lessons/${resource.lessonId}/resources/${resource.id}/download`;

    const signed = await http()
      .get(path)
      .set(as(student1))
      .expect(200)
      .expect('Cache-Control', 'no-store');
    expect(Object.keys(signed.body).sort()).toEqual([
      'expiresAt',
      'filename',
      'url',
    ]);
    expect(signed.body.filename).toBe(resource.filename);
    await http()
      .get(mediaPath(signed.body.url as string))
      .expect(200)
      .expect('Content-Type', /application\/pdf/)
      .expect(
        'Content-Disposition',
        `attachment; filename="${resource.filename}"; filename*=UTF-8''${resource.filename}`,
      );

    await http()
      .get(path)
      .set(as(student3))
      .expect(403)
      .expect(({ body }) => expect(body.code).toBe('NOT_ENROLLED'));
    await http().get(path).set(as(admin)).expect(403);
    await http().get(path).expect(401);
    // A resource id under the wrong lesson is not found, not borrowed.
    const otherLesson = c1.lessons.find(({ id }) => id !== resource.lessonId)!;
    await http()
      .get(
        `/api/v1/lessons/${otherLesson.id}/resources/${resource.id}/download`,
      )
      .set(as(student1))
      .expect(404);
  });

  it('locks a learner out after a revoke (N3.5, N3.11)', async () => {
    const learner = await throwawayLearner(c1.id);
    await shell(C1, learner.session).expect(200);
    await playback(paidVideo(c1).id, learner.session).expect(200);

    await http()
      .delete(`/api/v1/admin/enrollments/${learner.enrollmentId}`)
      .set(as(admin))
      .expect(204);

    await shell(C1, learner.session)
      .expect(403)
      .expect(({ body }) => expect(body.code).toBe('NOT_ENROLLED'));
    const lesson = await content(paidVideo(c1).id, learner.session).expect(403);
    expect(lesson.body).not.toHaveProperty('content');
    await playback(paidVideo(c1).id, learner.session).expect(403);
  });

  it('keeps an ARCHIVED course open to its ACTIVE learners only (A3.12)', async () => {
    const learner = await throwawayLearner(c6.id);
    const response = await shell(C6_ARCHIVED, learner.session).expect(200);
    expect(response.body.course.status).toBe('ARCHIVED');
    await content(paidVideo(c6).id, learner.session).expect(200);
    await playback(paidVideo(c6).id, learner.session).expect(200);
    await saveProgress(paidVideo(c6).id, learner.session, {
      lastPositionSeconds: 5,
    }).expect(200);

    // Not enrolled: the archived course does not exist for them.
    await content(previewVideo(c6).id, student3).expect(404);
    await playback(previewVideo(c6).id, student3).expect(404);
  });

  it('rejects a BLOCKED account at login exactly like a wrong password', async () => {
    const learner = await throwawayLearner();
    await prisma.user.update({
      where: { id: learner.id },
      data: { status: 'BLOCKED' },
    });
    const attempt = (password: string) =>
      http()
        .get('/api/v1/auth/csrf')
        .then((csrf) =>
          http()
            .post('/api/v1/auth/login')
            .set('Cookie', jar(csrf.headers['set-cookie']).join('; '))
            .set('X-CSRF-Token', csrf.body.csrfToken as string)
            .set('X-Real-IP', nextIp())
            .send({ email: learner.email, password }),
        );
    const blocked = await attempt(THROWAWAY_PASSWORD);
    const wrong = await attempt('sai mat khau hoan toan');
    expect(blocked.status).toBe(401);
    expect(blocked.body.code).toBe('INVALID_CREDENTIALS');
    expect(blocked.body).toEqual(wrong.body);
  });
});
