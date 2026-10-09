import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { LocalDiskStorage } from '../src/media/local-disk.storage.js';
import { bootApp, createCourse, truncateAll } from './support.js';

/**
 * REVIEW F-32: a resource is served under the name its author gave it, and a
 * Vietnamese name used to be a 500, because Node refuses a header value with a
 * character above 0xFF. The fake response of the unit spec cannot notice that;
 * a real one does.
 */
describe('a resource download (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: Awaited<ReturnType<typeof bootApp>>['prisma'];
  const storage = new LocalDiskStorage();
  const stored: string[] = [];

  beforeAll(async () => {
    ({ app, prisma } = await bootApp());
    await truncateAll(prisma);
  });

  afterAll(async () => {
    for (const key of stored) await storage.delete(key);
    await app.close();
  });

  async function resourceNamed(filename: string) {
    const course = await createCourse(prisma);
    const section = await prisma.section.create({ data: { courseId: course.id, title: 'Chương 1', position: 1 } });
    const lesson = await prisma.lesson.create({
      data: { sectionId: section.id, title: 'Bài 1', type: 'ARTICLE', position: 1 },
    });
    const key = `lessons/${lesson.id}/resources/${randomUUID()}-tai-lieu.pdf`;
    const upload = new URL(await storage.signedUploadUrl(key, 'application/pdf', 13, 300));
    await request(app.getHttpServer())
      .put(`/api/v1/media/local/${key}${upload.search}`)
      .set('Content-Type', 'application/pdf')
      .send(Buffer.from('%PDF-1.4 test'))
      .expect(204);
    stored.push(key);
    await prisma.lessonResource.create({
      data: { lessonId: lesson.id, objectKey: key, filename, contentType: 'application/pdf', sizeBytes: 13, position: 1 },
    });
    const download = new URL(await storage.signedDownloadUrl(key, 300));
    return request(app.getHttpServer()).get(`/api/v1/media/local/${key}${download.search}`);
  }

  it('names a Vietnamese file for the browser instead of failing', async () => {
    const response = await resourceNamed('Tài liệu bài 1.pdf');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/application\/pdf/);
    expect(response.headers['content-disposition']).toBe(
      `attachment; filename="Tai lieu bai 1.pdf"; filename*=UTF-8''T%C3%A0i%20li%E1%BB%87u%20b%C3%A0i%201.pdf`,
    );
    expect(response.body.toString()).toBe('%PDF-1.4 test');
  });

  it('serves a name in another script, and one with a quote in it', async () => {
    expect((await resourceNamed('報告 🎓.pdf')).status).toBe(200);
    const quoted = await resourceNamed('Bài "tập".pdf');

    expect(quoted.status).toBe(200);
    expect(quoted.headers['content-disposition']).toContain('filename="Bai tap.pdf"');
  });
});
