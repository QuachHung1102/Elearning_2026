import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PurchaseService } from '../src/checkout/purchase.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import {
  as,
  bootApp,
  createPaidOrder,
  createUser,
  signIn,
  truncateAll,
  warmPool,
  type PaidOrderState,
  type Session,
} from './support.js';

const DAY = 86_400_000;
const REASON = 'Khóa học không đúng như mô tả, tôi muốn được hoàn tiền.';

/** The learner's own orders (API_CONTRACT.md §5.8): list, detail, refund request. */
describe('purchases (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await bootApp());
  });

  beforeEach(async () => {
    await truncateAll(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  async function learner() {
    const user = await createUser(prisma, 'STUDENT');
    return { user, session: await signIn(app, user.email) };
  }

  const get = (session: Session, path: string) =>
    request(app.getHttpServer()).get(`/api/v1${path}`).set(as(session));
  const post = (session: Session, path: string, body: object = {}) =>
    request(app.getHttpServer()).post(`/api/v1${path}`).set(as(session)).send(body);

  const bought = (userId: string, over: PaidOrderState = {}) =>
    createPaidOrder(prisma, userId, over);

  describe('GET /purchases/me', () => {
    it("lists only the caller's orders, newest first, in the PurchaseRow shape", async () => {
      const { user, session } = await learner();
      const other = await createUser(prisma, 'STUDENT');
      const older = await bought(user.id, { status: 'REFUNDED', lessons: 0 });
      await prisma.purchase.update({
        where: { id: older.purchase.id },
        data: { createdAt: new Date(Date.now() - DAY) },
      });
      const newer = await bought(user.id, { lessons: 0 });
      await bought(other.id, { lessons: 0 });

      const response = await get(session, '/purchases/me').expect(200);

      expect(response.body).toMatchObject({ page: 1, pageSize: 20, total: 2, totalPages: 1 });
      expect(response.body.items.map((row: { id: string }) => row.id)).toEqual([
        newer.purchase.id,
        older.purchase.id,
      ]);
      expect(response.body.items[0]).toEqual({
        id: newer.purchase.id,
        courseId: newer.course.id,
        courseSlug: newer.course.slug,
        courseTitle: 'Khóa có thể mua',
        priceVnd: 499_000,
        status: 'PAID',
        createdAt: expect.any(String),
        paidAt: expect.any(String),
        refundedAt: null,
      });
      expect(response.headers['cache-control']).toBe('no-store');
    });

    it('filters by status and pages', async () => {
      const { user, session } = await learner();
      await bought(user.id, { status: 'REFUNDED', lessons: 0 });
      await bought(user.id, { status: 'PAID', lessons: 0 });
      await bought(user.id, { status: 'PENDING', lessons: 0 });

      const paid = await get(session, '/purchases/me?status=PAID').expect(200);
      const twoStates = await get(session, '/purchases/me?status=PAID,PENDING').expect(200);
      const paged = await get(session, '/purchases/me?pageSize=2&page=2').expect(200);

      expect(paid.body.items.map((row: { status: string }) => row.status)).toEqual(['PAID']);
      expect(twoStates.body.total).toBe(2);
      expect(paged.body).toMatchObject({ page: 2, pageSize: 2, total: 3, totalPages: 2 });
      expect(paged.body.items).toHaveLength(1);
      await get(session, '/purchases/me?status=NOPE').expect(400);
    });

    it('needs a session', async () => {
      await request(app.getHttpServer()).get('/api/v1/purchases/me').expect(401);
    });
  });

  describe('GET /purchases/{id}', () => {
    it('returns the order with its QR history, newest first, leaving out attempts that never got a QR', async () => {
      const { user, session } = await learner();
      const { purchase } = await bought(user.id, { status: 'PENDING', lessons: 0 });
      const attempt = (minutesAgo: number, qrCode: string | null) =>
        prisma.paymentAttempt.create({
          data: {
            purchaseId: purchase.id,
            appTransId: `260930_${randomUUID().slice(0, 8)}`,
            amountVnd: 499_000,
            qrCode,
            orderUrl: qrCode && `http://localhost:3000/account/orders/${purchase.id}`,
            expiresAt: new Date(Date.now() + 900_000),
            createdAt: new Date(Date.now() - minutesAgo * 60_000),
          },
        });
      const first = await attempt(20, 'qr-old');
      const second = await attempt(5, 'qr-new');
      await attempt(1, null);

      const response = await get(session, `/purchases/${purchase.id}`).expect(200);

      expect(response.body).toMatchObject({ id: purchase.id, status: 'PENDING', courseTitle: 'Khóa có thể mua' });
      expect(response.body.attempts.map((row: { paymentAttemptId: string }) => row.paymentAttemptId)).toEqual([
        second.id,
        first.id,
      ]);
      expect(response.body.attempts[0]).toEqual({
        purchaseId: purchase.id,
        paymentAttemptId: second.id,
        status: 'PENDING',
        amountVnd: 499_000,
        provider: 'DEMO',
        qrCode: 'qr-new',
        orderUrl: `http://localhost:3000/account/orders/${purchase.id}`,
        createdAt: expect.any(String),
        expiresAt: expect.any(String),
      });
    });

    it('returns an empty history for an order with no attempt', async () => {
      const { user, session } = await learner();
      const { purchase } = await bought(user.id, { lessons: 0 });

      const response = await get(session, `/purchases/${purchase.id}`).expect(200);

      expect(response.body.attempts).toEqual([]);
    });

    it("answers 404, not 403, for someone else's order or an unknown one", async () => {
      const { session } = await learner();
      const other = await createUser(prisma, 'STUDENT');
      const { purchase } = await bought(other.id, { lessons: 0 });

      await get(session, `/purchases/${purchase.id}`).expect(404);
      await get(session, `/purchases/${randomUUID()}`).expect(404);
      await get(session, '/purchases/not-a-uuid').expect(400);
    });

    it('needs a session', async () => {
      await request(app.getHttpServer()).get(`/api/v1/purchases/${randomUUID()}`).expect(401);
    });
  });

  describe('POST /purchases/{id}/refund-request', () => {
    it('moves a paid order to REFUND_REQUESTED, keeps the access, and records why', async () => {
      const { user, session } = await learner();
      const { course, purchase } = await bought(user.id, { completed: 1 });

      const response = await post(session, `/purchases/${purchase.id}/refund-request`, { reason: REASON }).expect(202);

      expect(response.body).toMatchObject({ id: purchase.id, status: 'REFUND_REQUESTED' });
      expect((await prisma.purchase.findUniqueOrThrow({ where: { id: purchase.id } })).status).toBe('REFUND_REQUESTED');
      // Access ends only when an admin marks the order REFUNDED.
      expect(
        (await prisma.enrollment.findUniqueOrThrow({ where: { userId_courseId: { userId: user.id, courseId: course.id } } }))
          .status,
      ).toBe('ACTIVE');
      const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'purchase.refund_requested' } });
      expect(audit).toMatchObject({ actorId: user.id, entityType: 'PURCHASE', entityId: purchase.id });
      expect(audit.metadata).toMatchObject({ reason: REASON });
    });

    it('asks for a reason of 10 to 500 characters', async () => {
      const { user, session } = await learner();
      const { purchase } = await bought(user.id);

      await post(session, `/purchases/${purchase.id}/refund-request`, { reason: 'ngắn' }).expect(400);
      await post(session, `/purchases/${purchase.id}/refund-request`, { reason: 'x'.repeat(501) }).expect(400);
      await post(session, `/purchases/${purchase.id}/refund-request`, {}).expect(400);
      expect((await prisma.purchase.findUniqueOrThrow({ where: { id: purchase.id } })).status).toBe('PAID');
    });

    it.each([
      ['an unpaid order', { status: 'PENDING' as const }, 'NOT_PAID'],
      ['an order already refunded', { status: 'REFUNDED' as const }, 'ALREADY_REFUNDED'],
      ['an order already asked about', { status: 'REFUND_REQUESTED' as const }, 'ALREADY_REQUESTED'],
      ['access an admin granted by hand', { source: 'MANUAL_GRANT' as const }, 'NOT_PURCHASED'],
      ['a free course', { priceVnd: 0 }, 'FREE_COURSE'],
      ['an order paid 8 days ago', { paidDaysAgo: 8 }, 'OUTSIDE_WINDOW'],
      ['a learner 20% through the course', { lessons: 5, completed: 1 }, 'PROGRESS_TOO_HIGH'],
    ])('answers 409 PURCHASE_NOT_REFUNDABLE for %s', async (_label, over, reason) => {
      const { user, session } = await learner();
      const { purchase } = await bought(user.id, over);

      const response = await post(session, `/purchases/${purchase.id}/refund-request`, { reason: REASON }).expect(409);

      expect(response.body).toMatchObject({
        statusCode: 409,
        code: 'PURCHASE_NOT_REFUNDABLE',
        details: { reason },
      });
      expect((await prisma.purchase.findUniqueOrThrow({ where: { id: purchase.id } })).status).toBe(purchase.status);
      expect(await prisma.auditLog.count({ where: { action: 'purchase.refund_requested' } })).toBe(0);
    });

    it('tells the caller how far past the policy the order is', async () => {
      const { user, session } = await learner();
      const { purchase } = await bought(user.id, { paidDaysAgo: 31, lessons: 10, completed: 0 });

      const response = await post(session, `/purchases/${purchase.id}/refund-request`, { reason: REASON }).expect(409);

      expect(response.body.details).toEqual({
        reason: 'OUTSIDE_WINDOW',
        paidAt: purchase.paidAt?.toISOString() ?? expect.any(String),
        daysSincePaid: 31,
        progressPercent: 0,
      });
    });

    it("answers 404 for someone else's order", async () => {
      const { session } = await learner();
      const other = await createUser(prisma, 'STUDENT');
      const { purchase } = await bought(other.id);

      await post(session, `/purchases/${purchase.id}/refund-request`, { reason: REASON }).expect(404);
      expect((await prisma.purchase.findUniqueOrThrow({ where: { id: purchase.id } })).status).toBe('PAID');
    });

    it('accepts one request and refuses the same one twice', async () => {
      const { user, session } = await learner();
      const { purchase } = await bought(user.id);

      await post(session, `/purchases/${purchase.id}/refund-request`, { reason: REASON }).expect(202);
      const again = await post(session, `/purchases/${purchase.id}/refund-request`, { reason: REASON }).expect(409);

      expect(again.body.details.reason).toBe('ALREADY_REQUESTED');
      expect(await prisma.auditLog.count({ where: { action: 'purchase.refund_requested' } })).toBe(1);
    });

    // Straight at the service so the calls overlap (see `warmPool`). Every one
    // of them reads a PAID order; only the conditional write lets one through.
    it('records exactly one request out of several simultaneous ones', async () => {
      const { user } = await learner();
      const { purchase } = await bought(user.id);
      const service = app.get(PurchaseService);
      await warmPool(prisma);

      const results = await Promise.allSettled(
        Array.from({ length: 4 }, () => service.requestRefund(user.id, purchase.id, REASON, null)),
      );

      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      for (const result of results) {
        if (result.status === 'rejected') expect(result.reason.getStatus()).toBe(409);
      }
      expect(await prisma.auditLog.count({ where: { action: 'purchase.refund_requested' } })).toBe(1);
    });

    it('limits a learner to five attempts in five minutes', async () => {
      const { user, session } = await learner();
      const { purchase } = await bought(user.id);
      for (let call = 1; call <= 5; call += 1) {
        await post(session, `/purchases/${purchase.id}/refund-request`, { reason: 'ngắn' }).expect(400);
      }

      const response = await post(session, `/purchases/${purchase.id}/refund-request`, { reason: REASON }).expect(429);

      expect(response.body.code).toBe('RATE_LIMITED');
    });
  });
});
