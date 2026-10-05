import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { STREAM_CLIENT, type StreamClient } from '../src/media/stream.client.js';
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
 * REVIEW F-10 / T4.5: a video asset belongs to whoever registered it (null =
 * the site owner), another instructor cannot see or attach it, registering is
 * audited, and the status poll is rate limited and served from the row while
 * the provider's answer is still fresh.
 */
describe('Video assets (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let ownerId: string;
  let adminId: string;
  let owner: Session;
  let rival: Session;
  let rivalId: string;
  let admin: Session;

  const register = (session: Session) =>
    request(app.getHttpServer())
      .post('/api/v1/admin/videos')
      .set(as(session))
      .send({ externalId: `demo/${randomUUID()}` })
      .expect(201);
  const poll = (session: Session, id: string) =>
    request(app.getHttpServer())
      .get(`/api/v1/admin/videos/${id}`)
      .set(as(session));

  beforeAll(async () => {
    ({ app, prisma } = await bootApp());
    await truncateAll(prisma);
    const [teacher, other, boss] = await Promise.all([
      createUser(prisma, 'INSTRUCTOR'),
      createUser(prisma, 'INSTRUCTOR'),
      createUser(prisma, 'ADMIN'),
    ]);
    ownerId = teacher.id;
    rivalId = other.id;
    adminId = boss.id;
    owner = await signIn(app, teacher.email);
    rival = await signIn(app, other.email);
    admin = await signIn(app, boss.email);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('stamps the registering instructor as owner (null for an admin) and audits it', async () => {
    const mine = await register(owner);
    const site = await register(admin);
    expect(Object.keys(mine.body).sort()).toEqual(
      ['durationSeconds', 'externalId', 'id', 'provider', 'status', 'thumbnailUrl'],
    );

    const rows = await prisma.videoAsset.findMany({
      where: { id: { in: [mine.body.id, site.body.id] } },
    });
    const ownerOf = new Map(rows.map((row) => [row.id, row.instructorId]));
    expect(ownerOf.get(mine.body.id)).toBe(ownerId);
    expect(ownerOf.get(site.body.id)).toBeNull();

    const logs = await prisma.auditLog.findMany({
      where: { entityType: 'VIDEO_ASSET', entityId: { in: [mine.body.id, site.body.id] } },
      orderBy: { createdAt: 'asc' },
    });
    expect(logs).toEqual([
      expect.objectContaining({
        action: 'video.registered',
        actorId: ownerId,
        entityId: mine.body.id,
        metadata: expect.objectContaining({ provider: 'DEMO', externalId: mine.body.externalId }),
      }),
      expect.objectContaining({
        action: 'video.registered',
        actorId: adminId,
        entityId: site.body.id,
      }),
    ]);
  });

  it("answers 404 to an instructor polling a video they did not register", async () => {
    const mine = await register(owner);
    const site = await register(admin);

    expect((await poll(rival, mine.body.id)).status).toBe(404);
    expect((await poll(owner, site.body.id)).status).toBe(404);
    expect((await poll(owner, mine.body.id)).status).toBe(200);
    expect((await poll(admin, mine.body.id)).status).toBe(200);
  });

  it("refuses to attach another instructor's video to a lesson", async () => {
    const course = await prisma.course.create({
      data: {
        slug: `video-${randomUUID().slice(0, 8)}`,
        title: 'Khóa video',
        description: '',
        priceVnd: 0,
        instructorId: rivalId,
        learningOutcomes: [],
        requirements: [],
        targetAudience: [],
        sections: {
          create: {
            title: 'Chương',
            position: 1,
            lessons: { create: { title: 'Bài', type: 'VIDEO', position: 1 } },
          },
        },
      },
      include: { sections: { include: { lessons: true } } },
    });
    const lessonId = course.sections[0].lessons[0].id;
    const attach = (videoAssetId: string) =>
      request(app.getHttpServer())
        .patch(`/api/v1/admin/lessons/${lessonId}`)
        .set(as(rival))
        .send({ videoAssetId });

    const notTheirs = await register(owner);
    expect((await attach(notTheirs.body.id)).status).toBe(404);
    expect(
      (await prisma.lesson.findUniqueOrThrow({ where: { id: lessonId } })).videoAssetId,
    ).toBeNull();

    const theirs = await register(rival);
    expect((await attach(theirs.body.id)).status).toBe(200);
  });

  it('answers a READY or freshly polled asset from the row without calling the provider', async () => {
    const getStatus = vi.spyOn(app.get<StreamClient>(STREAM_CLIENT), 'getStatus');

    const ready = await register(admin);
    expect(ready.body.status).toBe('READY');
    getStatus.mockClear();
    expect((await poll(admin, ready.body.id)).body.status).toBe('READY');
    expect(getStatus).not.toHaveBeenCalled();

    const pending = await prisma.videoAsset.create({
      data: { provider: 'DEMO', externalId: `demo/${randomUUID()}` },
    });
    expect((await poll(admin, pending.id)).body.status).toBe('PENDING');
    expect(getStatus).not.toHaveBeenCalled();

    await prisma.videoAsset.update({
      where: { id: pending.id },
      data: { updatedAt: new Date(Date.now() - 60_000) },
    });
    expect((await poll(admin, pending.id)).body.status).toBe('READY');
    expect(getStatus).toHaveBeenCalledTimes(1);
  });

  it('rate limits status polls per user', async () => {
    const poller = await createUser(prisma, 'ADMIN');
    const session = await signIn(app, poller.email);
    const asset = await register(session);

    for (let i = 0; i < 30; i += 1) {
      expect((await poll(session, asset.body.id)).status).toBe(200);
    }
    const limited = await poll(session, asset.body.id);
    expect(limited.status).toBe(429);
    expect(limited.body.code).toBe('RATE_LIMITED');
    expect(limited.headers['retry-after']).toMatch(/^[1-9]\d*$/);
    // Another user is not affected.
    expect((await poll(admin, asset.body.id)).status).toBe(200);
  });
});
