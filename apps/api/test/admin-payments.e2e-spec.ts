import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DemoZaloPayClient } from '../src/checkout/demo-zalopay.client.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import {
  addAttempt,
  as,
  bootApp,
  createOrder,
  createUser,
  signIn,
  truncateAll,
  type Session,
} from './support.js';

const PRICE = 499_000;

/** The admin's payment screens (API_CONTRACT.md §5.8): the list and "ask the provider again". */
describe('admin payments (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let demo: DemoZaloPayClient;

  beforeAll(async () => {
    ({ app, prisma } = await bootApp());
    demo = app.get(DemoZaloPayClient);
  });

  beforeEach(async () => {
    await truncateAll(prisma);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  async function admin() {
    const user = await createUser(prisma, 'ADMIN');
    return { user, session: await signIn(app, user.email) };
  }

  const list = (session: Session | null, query = '') => {
    const call = request(app.getHttpServer()).get(`/api/v1/admin/payments${query}`);
    return session ? call.set(as(session)) : call;
  };
  const reconcile = (session: Session | null, attemptId: string) => {
    const call = request(app.getHttpServer()).post(`/api/v1/admin/payments/${attemptId}/reconcile`);
    return session ? call.set(as(session)) : call;
  };

  describe('GET /admin/payments', () => {
    it('lists orders newest first with the learner and every QR of each', async () => {
      const { session } = await admin();
      const older = await createOrder(prisma, { ageMinutes: 60 });
      await prisma.purchase.update({
        where: { id: older.purchase.id },
        data: { createdAt: new Date(Date.now() - 3_600_000) },
      });
      const newer = await createOrder(prisma, {});
      const second = await addAttempt(prisma, newer.purchase.id, { ageMinutes: 0 });
      await prisma.paymentAttempt.update({
        where: { id: newer.attempt.id },
        data: { createdAt: new Date(Date.now() - 600_000), status: 'EXPIRED' },
      });

      const response = await list(session).expect(200);

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
        priceVnd: PRICE,
        status: 'PENDING',
        createdAt: expect.any(String),
        paidAt: null,
        refundedAt: null,
        user: { id: newer.user.id, email: newer.user.email, displayName: 'Người dùng' },
        attempts: [
          expect.objectContaining({ id: second.id, appTransId: second.appTransId, status: 'PENDING' }),
          expect.objectContaining({ id: newer.attempt.id, appTransId: newer.attempt.appTransId, status: 'EXPIRED' }),
        ],
      });
      expect(response.body.items[0].attempts[0]).toEqual({
        id: second.id,
        appTransId: second.appTransId,
        providerTransId: null,
        provider: 'DEMO',
        status: 'PENDING',
        amountVnd: PRICE,
        expiresAt: expect.any(String),
        paidAt: null,
        createdAt: expect.any(String),
      });
    });

    it('filters by status, course and creation time, and pages', async () => {
      const { session } = await admin();
      const paid = await createOrder(prisma, { purchase: 'PAID' });
      await createOrder(prisma, {});
      await createOrder(prisma, { purchase: 'CANCELLED' });
      await prisma.purchase.update({
        where: { id: paid.purchase.id },
        data: { createdAt: new Date('2026-01-15T00:00:00.000Z') },
      });

      const byStatus = await list(session, '?status=PAID,CANCELLED').expect(200);
      const byCourse = await list(session, `?courseId=${paid.course.id}`).expect(200);
      const byTime = await list(session, '?from=2026-01-01T00:00:00.000Z&to=2026-02-01T00:00:00.000Z').expect(200);
      const paged = await list(session, '?pageSize=2&page=2').expect(200);

      expect(byStatus.body.total).toBe(2);
      expect(byCourse.body.items.map((row: { id: string }) => row.id)).toEqual([paid.purchase.id]);
      expect(byTime.body.items.map((row: { id: string }) => row.id)).toEqual([paid.purchase.id]);
      expect(paged.body).toMatchObject({ page: 2, pageSize: 2, total: 3, totalPages: 2 });
      expect(paged.body.items).toHaveLength(1);
    });

    // "Đưa giao dịch thừa vào danh sách cần xử lý hoàn tiền": an order with more
    // than one SUCCEEDED attempt. No column marks it; the query finds it.
    it('duplicatePaid=true lists only orders paid through more than one QR', async () => {
      const { session } = await admin();
      const twice = await createOrder(prisma, { purchase: 'PAID', attempt: 'PENDING' });
      const second = await addAttempt(prisma, twice.purchase.id);
      for (const attempt of [twice.attempt, second]) {
        await prisma.paymentAttempt.update({
          where: { id: attempt.id },
          data: { status: 'SUCCEEDED', providerTransId: `zp-${randomUUID()}`, paidAt: new Date() },
        });
      }
      const once = await createOrder(prisma, { purchase: 'PAID' });
      await prisma.paymentAttempt.update({
        where: { id: once.attempt.id },
        data: { status: 'SUCCEEDED', providerTransId: `zp-${randomUUID()}`, paidAt: new Date() },
      });

      const duplicates = await list(session, '?duplicatePaid=true').expect(200);
      const everything = await list(session, '?duplicatePaid=false').expect(200);

      expect(duplicates.body.items.map((row: { id: string }) => row.id)).toEqual([twice.purchase.id]);
      expect(everything.body.total).toBe(2);
    });

    it('rejects filters it cannot read', async () => {
      const { session } = await admin();

      await list(session, '?status=NOPE').expect(400);
      await list(session, '?courseId=not-a-uuid').expect(400);
      await list(session, '?duplicatePaid=maybe').expect(400);
      await list(session, '?from=yesterday').expect(400);
    });

    it('is invisible to everyone but an admin', async () => {
      const student = await createUser(prisma, 'STUDENT');
      const instructor = await createUser(prisma, 'INSTRUCTOR');

      await list(null).expect(404);
      await list(await signIn(app, student.email)).expect(404);
      await list(await signIn(app, instructor.email)).expect(404);
    });
  });

  describe('POST /admin/payments/{attemptId}/reconcile', () => {
    it('confirms an attempt the provider says was paid, as the admin who asked', async () => {
      const { user, session } = await admin();
      const { attempt, purchase } = await createOrder(prisma, {});
      demo.settle(attempt.appTransId, { amountVnd: PRICE, expiresAt: attempt.expiresAt });

      const response = await reconcile(session, attempt.id).expect(200);

      expect(response.body).toEqual({ status: 'SUCCEEDED', changed: true });
      expect((await prisma.purchase.findUniqueOrThrow({ where: { id: purchase.id } })).status).toBe('PAID');
      expect(await prisma.enrollment.count()).toBe(1);
      const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'payment.reconciled' } });
      expect(audit).toMatchObject({ actorId: user.id, entityId: attempt.id });
      expect(audit.metadata).toMatchObject({ fromStatus: 'PENDING', toStatus: 'SUCCEEDED' });

      const again = await reconcile(session, attempt.id).expect(200);
      expect(again.body).toEqual({ status: 'SUCCEEDED', changed: false });
      expect(await prisma.enrollment.count()).toBe(1);
    });

    it('reports an order the provider still calls processing without changing it', async () => {
      const { session } = await admin();
      const { attempt } = await createOrder(prisma, {});

      const response = await reconcile(session, attempt.id).expect(200);

      expect(response.body).toEqual({ status: 'PENDING', changed: false });
      expect(await prisma.auditLog.count()).toBe(0);
    });

    it('closes an attempt the provider says failed', async () => {
      const { user, session } = await admin();
      const { attempt, purchase } = await createOrder(prisma, {});
      vi.spyOn(demo, 'queryOrder').mockResolvedValueOnce({ returnCode: 2, returnMessage: 'declined' });

      const response = await reconcile(session, attempt.id).expect(200);

      expect(response.body).toEqual({ status: 'FAILED', changed: true });
      expect((await prisma.purchase.findUniqueOrThrow({ where: { id: purchase.id } })).status).toBe('PENDING');
      const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'payment.reconciled' } });
      expect(audit.actorId).toBe(user.id);
    });

    it.each([
      ['an EXPIRED attempt', { attempt: 'EXPIRED' as const }],
      ['a PENDING attempt whose QR has lapsed', { expiresInMinutes: -1 }],
    ])('answers 409 PAYMENT_EXPIRED for %s that the provider has no payment for', async (_label, over) => {
      const { session } = await admin();
      const { attempt } = await createOrder(prisma, over);

      const response = await reconcile(session, attempt.id).expect(409);

      expect(response.body.code).toBe('PAYMENT_EXPIRED');
    });

    // P4-4: paid just before the QR timed out, found only now.
    it('still confirms a payment the provider took before the QR lapsed', async () => {
      const { session } = await admin();
      const { attempt, purchase } = await createOrder(prisma, {});
      demo.settle(attempt.appTransId, { amountVnd: PRICE, expiresAt: attempt.expiresAt });
      await prisma.paymentAttempt.update({
        where: { id: attempt.id },
        data: { status: 'EXPIRED', expiresAt: new Date(Date.now() - 1_000) },
      });

      const response = await reconcile(session, attempt.id).expect(200);

      expect(response.body).toEqual({ status: 'SUCCEEDED', changed: true });
      expect((await prisma.purchase.findUniqueOrThrow({ where: { id: purchase.id } })).status).toBe('PAID');
      const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'payment.reconciled' } });
      expect(audit.metadata).toMatchObject({ fromStatus: 'EXPIRED', late: true });
    });

    it('answers 404 for an unknown attempt and 400 for a malformed id', async () => {
      const { session } = await admin();

      await reconcile(session, randomUUID()).expect(404);
      await reconcile(session, 'not-a-uuid').expect(400);
    });

    it('is invisible to everyone but an admin', async () => {
      const { attempt } = await createOrder(prisma, {});
      const student = await createUser(prisma, 'STUDENT');

      await reconcile(null, attempt.id).expect(404);
      await reconcile(await signIn(app, student.email), attempt.id).expect(404);
      expect(await prisma.auditLog.count()).toBe(0);
    });
  });
});
