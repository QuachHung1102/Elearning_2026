import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import {
  as,
  bootApp,
  createUser,
  signIn,
  truncateAll,
  type Session,
} from './support.js';

/**
 * One row per `@StaffAccess(<entity kind>)` handler (course 9, section 4,
 * lesson 6, resource 1 — `git grep` counts 20). Anyone who does not own the
 * course gets the same 404 as a missing route, and nothing changes; the owner
 * and an admin are never turned away (REVIEW F-12).
 */
type Fixture = {
  courseId: string;
  sectionId: string;
  lessonId: string;
  resourceId: string;
};
type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';
type Row = {
  name: string;
  method: Method;
  path: (f: Fixture) => string;
  body?: (f: Fixture) => object;
};

const ROWS: Row[] = [
  { name: 'GET /admin/courses/:id', method: 'get', path: (f) => `/admin/courses/${f.courseId}` },
  { name: 'PATCH /admin/courses/:id', method: 'patch', path: (f) => `/admin/courses/${f.courseId}`, body: () => ({ subtitle: 'Sửa bởi người ngoài' }) },
  { name: 'DELETE /admin/courses/:id', method: 'delete', path: (f) => `/admin/courses/${f.courseId}` },
  { name: 'POST /admin/courses/:id/publish', method: 'post', path: (f) => `/admin/courses/${f.courseId}/publish` },
  { name: 'POST /admin/courses/:id/unpublish', method: 'post', path: (f) => `/admin/courses/${f.courseId}/unpublish` },
  { name: 'POST /admin/courses/:id/archive', method: 'post', path: (f) => `/admin/courses/${f.courseId}/archive` },
  { name: 'POST /admin/courses/:id/sections', method: 'post', path: (f) => `/admin/courses/${f.courseId}/sections`, body: () => ({ title: 'Chương mới' }) },
  { name: 'PUT /admin/courses/:id/sections/order', method: 'put', path: (f) => `/admin/courses/${f.courseId}/sections/order`, body: (f) => ({ sectionIds: [f.sectionId] }) },
  { name: 'POST /admin/courses/:id/cover-upload-url', method: 'post', path: (f) => `/admin/courses/${f.courseId}/cover-upload-url`, body: () => ({ filename: 'a.png', contentType: 'image/png', sizeBytes: 1000 }) },
  { name: 'PATCH /admin/sections/:id', method: 'patch', path: (f) => `/admin/sections/${f.sectionId}`, body: () => ({ title: 'Đổi tên chương' }) },
  { name: 'DELETE /admin/sections/:id', method: 'delete', path: (f) => `/admin/sections/${f.sectionId}` },
  { name: 'POST /admin/sections/:id/lessons', method: 'post', path: (f) => `/admin/sections/${f.sectionId}/lessons`, body: () => ({ title: 'Bài mới', type: 'ARTICLE' }) },
  { name: 'PUT /admin/sections/:id/lessons/order', method: 'put', path: (f) => `/admin/sections/${f.sectionId}/lessons/order`, body: (f) => ({ lessonIds: [f.lessonId] }) },
  { name: 'GET /admin/lessons/:id', method: 'get', path: (f) => `/admin/lessons/${f.lessonId}` },
  { name: 'PATCH /admin/lessons/:id', method: 'patch', path: (f) => `/admin/lessons/${f.lessonId}`, body: () => ({ title: 'Đổi tên bài' }) },
  { name: 'DELETE /admin/lessons/:id', method: 'delete', path: (f) => `/admin/lessons/${f.lessonId}` },
  { name: 'GET /admin/lessons/:id/resources', method: 'get', path: (f) => `/admin/lessons/${f.lessonId}/resources` },
  { name: 'POST /admin/lessons/:id/resources', method: 'post', path: (f) => `/admin/lessons/${f.lessonId}/resources`, body: (f) => ({ objectKey: `lessons/${f.lessonId}/resources/${randomUUID()}-tai-lieu.pdf`, filename: 'tai-lieu.pdf', contentType: 'application/pdf', sizeBytes: 1000 }) },
  { name: 'POST /admin/lessons/:id/resources/upload-url', method: 'post', path: (f) => `/admin/lessons/${f.lessonId}/resources/upload-url`, body: () => ({ filename: 'a.pdf', contentType: 'application/pdf', sizeBytes: 1000 }) },
  { name: 'DELETE /admin/resources/:id', method: 'delete', path: (f) => `/admin/resources/${f.resourceId}` },
];

describe('Instructor ownership matrix (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let ownerId: string;
  let owner: Session;
  let other: Session;
  let student: Session;
  let admin: Session;

  /** A draft course owned by `ownerId`: one section, one lesson, one resource. */
  async function fixture(): Promise<Fixture> {
    const course = await prisma.course.create({
      data: {
        slug: `ma-tran-${randomUUID().slice(0, 8)}`,
        title: 'Khóa ma trận',
        description: '',
        priceVnd: 0,
        instructorId: ownerId,
        learningOutcomes: [],
        requirements: [],
        targetAudience: [],
        sections: {
          create: {
            title: 'Chương',
            position: 1,
            lessons: {
              create: {
                title: 'Bài',
                type: 'ARTICLE',
                position: 1,
                resources: {
                  create: {
                    objectKey: `lessons/${randomUUID()}/resources/${randomUUID()}-a.pdf`,
                    filename: 'a.pdf',
                    contentType: 'application/pdf',
                    sizeBytes: 10,
                    position: 1,
                  },
                },
              },
            },
          },
        },
      },
      include: {
        sections: { include: { lessons: { include: { resources: true } } } },
      },
    });
    const [section] = course.sections;
    const [lesson] = section.lessons;
    return {
      courseId: course.id,
      sectionId: section.id,
      lessonId: lesson.id,
      resourceId: lesson.resources[0].id,
    };
  }

  const call = (row: Row, f: Fixture, session: Session | null) => {
    let pending = request(app.getHttpServer())[row.method](
      `/api/v1${row.path(f)}`,
    );
    if (session) pending = pending.set(as(session));
    return row.body ? pending.send(row.body(f)) : pending;
  };

  beforeAll(async () => {
    ({ app, prisma } = await bootApp());
    await truncateAll(prisma);
    const [teacher, rival, learner, boss] = await Promise.all([
      createUser(prisma, 'INSTRUCTOR'),
      createUser(prisma, 'INSTRUCTOR'),
      createUser(prisma, 'STUDENT'),
      createUser(prisma, 'ADMIN'),
    ]);
    ownerId = teacher.id;
    owner = await signIn(app, teacher.email);
    other = await signIn(app, rival.email);
    student = await signIn(app, learner.email);
    admin = await signIn(app, boss.email);
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(ROWS)(
    'answers 404 to another instructor, a student and a stranger, and changes nothing: $name',
    async (row) => {
      const f = await fixture();

      for (const session of [other, student, null]) {
        expect((await call(row, f, session)).status).toBe(404);
      }

      const course = await prisma.course.findUniqueOrThrow({
        where: { id: f.courseId },
        include: { sections: { include: { lessons: { include: { resources: true } } } } },
      });
      expect(course.title).toBe('Khóa ma trận');
      expect(course.subtitle).toBeNull();
      expect(course.status).toBe('DRAFT');
      expect(course.sections).toHaveLength(1);
      expect(course.sections[0].title).toBe('Chương');
      expect(course.sections[0].lessons).toHaveLength(1);
      expect(course.sections[0].lessons[0].title).toBe('Bài');
      expect(course.sections[0].lessons[0].resources).toHaveLength(1);
    },
  );

  it.each(ROWS)('never turns the owning instructor away: $name', async (row) => {
    const f = await fixture();
    const { status } = await call(row, f, owner);
    expect(status).not.toBe(404);
    expect(status).toBeLessThan(500);
  });

  it.each(ROWS)('never turns an admin away: $name', async (row) => {
    const f = await fixture();
    const { status } = await call(row, f, admin);
    expect(status).not.toBe(404);
    expect(status).toBeLessThan(500);
  });

  // `EnrollmentService.decide()`: an instructor previews their own course like
  // an admin would, and is an ordinary non-enrolled learner everywhere else.
  describe('reading a course as a learner', () => {
    async function course(status: 'DRAFT' | 'PUBLISHED') {
      const asset = await prisma.videoAsset.create({
        data: {
          provider: 'DEMO',
          externalId: `demo/${randomUUID()}`,
          status: 'READY',
          durationSeconds: 60,
        },
      });
      const created = await prisma.course.create({
        data: {
          slug: `xem-${randomUUID().slice(0, 8)}`,
          title: 'Khóa xem trước',
          description: '',
          priceVnd: 100_000,
          status,
          publishedAt: status === 'PUBLISHED' ? new Date() : null,
          instructorId: ownerId,
          learningOutcomes: [],
          requirements: [],
          targetAudience: [],
          sections: {
            create: {
              title: 'Chương',
              position: 1,
              lessons: {
                create: [
                  { title: 'Bài đọc', type: 'ARTICLE', content: 'Nội dung kín', position: 1 },
                  { title: 'Bài video', type: 'VIDEO', videoAssetId: asset.id, durationSeconds: 60, position: 2 },
                ],
              },
            },
          },
        },
        include: { sections: { include: { lessons: { orderBy: { position: 'asc' } } } } },
      });
      const [article, video] = created.sections[0].lessons;
      return { slug: created.slug, article: article.id, video: video.id };
    }

    const get = (path: string, session: Session) =>
      request(app.getHttpServer()).get(`/api/v1${path}`).set(as(session));
    const playback = (lessonId: string, session: Session) =>
      request(app.getHttpServer())
        .post(`/api/v1/lessons/${lessonId}/playback-token`)
        .set(as(session));

    it('opens a DRAFT course to its owner only', async () => {
      const c = await course('DRAFT');

      await get(`/learn/${c.slug}`, owner).expect(200);
      await get(`/lessons/${c.article}/content`, owner).expect(200);
      await playback(c.video, owner).expect(200);

      for (const session of [other, student]) {
        await get(`/learn/${c.slug}`, session).expect(404);
        await get(`/lessons/${c.article}/content`, session).expect(404);
        await playback(c.video, session).expect(404);
      }
    });

    it('treats another instructor on a PUBLISHED course like a learner who has not enrolled', async () => {
      const c = await course('PUBLISHED');

      await get(`/lessons/${c.article}/content`, owner).expect(200);
      await playback(c.video, owner).expect(200);

      for (const session of [other, student]) {
        await get(`/lessons/${c.article}/content`, session)
          .expect(403)
          .expect(({ body }) => expect(body.code).toBe('NOT_ENROLLED'));
        await playback(c.video, session).expect(403);
      }
    });
  });
});
