import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PurchaseService } from '../src/checkout/purchase.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import {
  as,
  bootApp,
  createCourse,
  createPaidOrder,
  createUser,
  signIn,
  truncateAll,
  warmPool,
  type PaidOrderState,
  type Session,
} from './support.js';

const REASON = 'Học viên đã liên hệ và được duyệt hoàn tiền';

/**
 * Refunds are bookkeeping (API_CONTRACT.md §5.8): the money moves outside the
 * system, and marking the order REFUNDED ends the access in the same
 * transaction, so there is never a refunded order that still teaches.
 */
describe('refunds (e2e)', () => {
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

  async function scene(over: PaidOrderState = {}) {
    const adminUser = await createUser(prisma, 'ADMIN');
    const buyerUser = await createUser(prisma, 'STUDENT');
    const { course, purchase } = await createPaidOrder(prisma, buyerUser.id, over);
    return {
      admin: { user: adminUser, session: await signIn(app, adminUser.email) },
      buyer: { user: buyerUser, session: await signIn(app, buyerUser.email) },
      course,
      purchase,
    };
  }

  const post = (session: Session | null, path: string, body: object = {}) => {
    const call = request(app.getHttpServer()).post(`/api/v1${path}`);
    return (session ? call.set(as(session)) : call).send(body);
  };
  const refund = (session: Session | null, purchaseId: string, body: object = { reason: REASON }) =>
    post(session, `/admin/purchases/${purchaseId}/refund`, body);

  const purchaseOf = (id: string) => prisma.purchase.findUniqueOrThrow({ where: { id } });
  const enrollmentOf = (userId: string, courseId: string) =>
    prisma.enrollment.findUniqueOrThrow({ where: { userId_courseId: { userId, courseId } } });
  const counter = async (courseId: string) =>
    (await prisma.course.findUniqueOrThrow({ where: { id: courseId } })).enrollmentCount;

  describe('POST /admin/purchases/{id}/refund', () => {
    it('closes the order and ends the access in one step, keeping the learner\'s progress', async () => {
      const { admin, buyer, course, purchase } = await scene({ completed: 1 });
      await request(app.getHttpServer()).get(`/api/v1/learn/${course.slug}`).set(as(buyer.session)).expect(200);

      const response = await refund(admin.session, purchase.id).expect(200);

      expect(response.body).toEqual({
        id: purchase.id,
        courseId: course.id,
        courseSlug: course.slug,
        courseTitle: 'Khóa có thể mua',
        priceVnd: 499_000,
        status: 'REFUNDED',
        createdAt: expect.any(String),
        paidAt: expect.any(String),
        refundedAt: expect.any(String),
      });
      expect(await purchaseOf(purchase.id)).toMatchObject({ status: 'REFUNDED', refundedAt: expect.any(Date) });
      expect(await enrollmentOf(buyer.user.id, course.id)).toMatchObject({
        status: 'REVOKED',
        revokedAt: expect.any(Date),
        source: 'PURCHASE',
        purchaseId: purchase.id,
      });
      expect(await counter(course.id)).toBe(0);
      expect(await prisma.lessonProgress.count({ where: { userId: buyer.user.id } })).toBe(1);
      await request(app.getHttpServer()).get(`/api/v1/learn/${course.slug}`).set(as(buyer.session)).expect(403);

      const refunded = await prisma.auditLog.findFirstOrThrow({ where: { action: 'purchase.refunded' } });
      expect(refunded).toMatchObject({ actorId: admin.user.id, entityType: 'PURCHASE', entityId: purchase.id });
      expect(refunded.metadata).toMatchObject({ amountVnd: 499_000, reason: REASON });
      expect(refunded.metadata).not.toHaveProperty('forced', true);
      // The admin is on `purchase.refunded`; the revoke it causes is the system's.
      const revoked = await prisma.auditLog.findFirstOrThrow({ where: { action: 'enrollment.revoked' } });
      expect(revoked.actorId).toBeNull();
      expect(revoked.metadata).toMatchObject({ trigger: 'refund' });
      expect(await prisma.auditLog.count({ where: { action: 'purchase.refund_approved' } })).toBe(0);
    });

    it('approves a learner\'s request: the approval and the refund are both on record', async () => {
      const { admin, buyer, course, purchase } = await scene({ status: 'REFUND_REQUESTED' });

      await refund(admin.session, purchase.id).expect(200);

      expect((await purchaseOf(purchase.id)).status).toBe('REFUNDED');
      expect((await enrollmentOf(buyer.user.id, course.id)).status).toBe('REVOKED');
      const approved = await prisma.auditLog.findFirstOrThrow({ where: { action: 'purchase.refund_approved' } });
      expect(approved).toMatchObject({ actorId: admin.user.id, entityId: purchase.id });
      expect(approved.metadata).toMatchObject({ reason: REASON });
      expect(await prisma.auditLog.count({ where: { action: 'purchase.refunded' } })).toBe(1);
    });

    it.each([
      ['an order paid more than seven days ago', { paidDaysAgo: 8 }, 'OUTSIDE_WINDOW'],
      ['a learner 20% through the course', { lessons: 5, completed: 1 }, 'PROGRESS_TOO_HIGH'],
      ['a free course', { priceVnd: 0 }, 'FREE_COURSE'],
      ['an order that was never paid', { status: 'PENDING' as const }, 'NOT_PAID'],
      ['an order already refunded', { status: 'REFUNDED' as const }, 'ALREADY_REFUNDED'],
      ['access an admin granted by hand', { source: 'MANUAL_GRANT' as const }, 'NOT_PURCHASED'],
    ])('answers 409 with the reason for %s and changes nothing', async (_label, over, reason) => {
      const { admin, buyer, course, purchase } = await scene(over);
      const before = {
        counter: await counter(course.id),
        enrollments: await prisma.enrollment.findMany({ where: { userId: buyer.user.id } }),
      };

      const response = await refund(admin.session, purchase.id).expect(409);

      expect(response.body).toMatchObject({
        statusCode: 409,
        code: 'PURCHASE_NOT_REFUNDABLE',
        details: { reason, progressPercent: expect.any(Number) },
      });
      expect((await purchaseOf(purchase.id)).status).toBe(purchase.status);
      expect(await counter(course.id)).toBe(before.counter);
      expect(await prisma.enrollment.findMany({ where: { userId: buyer.user.id } })).toEqual(before.enrollments);
      expect(await prisma.auditLog.count({ where: { action: 'purchase.refunded' } })).toBe(0);
    });

    describe('force', () => {
      it.each([
        ['an order paid more than seven days ago', { paidDaysAgo: 8 }],
        ['a learner well into the course', { lessons: 10, completed: 9 }],
        ['a free course', { priceVnd: 0 }],
      ])('lifts the policy for %s, and records that it did', async (_label, over) => {
        const { admin, buyer, course, purchase } = await scene(over);

        await refund(admin.session, purchase.id, { reason: REASON, force: true }).expect(200);

        expect((await purchaseOf(purchase.id)).status).toBe('REFUNDED');
        expect((await enrollmentOf(buyer.user.id, course.id)).status).toBe('REVOKED');
        const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'purchase.refunded' } });
        expect(audit.metadata).toMatchObject({ forced: true });
      });

      it.each([
        ['an order that was never paid', { status: 'PENDING' as const }],
        ['an order already refunded', { status: 'REFUNDED' as const }],
        ['access an admin granted by hand', { source: 'MANUAL_GRANT' as const }],
      ])('never lifts a data invariant: %s', async (_label, over) => {
        const { admin, purchase } = await scene(over);

        const response = await refund(admin.session, purchase.id, { reason: REASON, force: true }).expect(409);

        expect(response.body.code).toBe('PURCHASE_NOT_REFUNDABLE');
        expect((await purchaseOf(purchase.id)).status).toBe(purchase.status);
      });
    });

    it('refunds an order whose access an admin had already revoked, without dropping the counter twice', async () => {
      const { admin, buyer, course, purchase } = await scene();
      await prisma.enrollment.update({
        where: { userId_courseId: { userId: buyer.user.id, courseId: course.id } },
        data: { status: 'REVOKED', revokedAt: new Date() },
      });
      await prisma.course.update({ where: { id: course.id }, data: { enrollmentCount: 0 } });

      await refund(admin.session, purchase.id).expect(200);

      expect((await purchaseOf(purchase.id)).status).toBe('REFUNDED');
      expect(await counter(course.id)).toBe(0);
      expect(await prisma.auditLog.count({ where: { action: 'enrollment.revoked' } })).toBe(0);
    });

    it('acts once when two admins press it together', async () => {
      const { admin, course, purchase } = await scene();
      const service = app.get(PurchaseService);
      await warmPool(prisma);

      const results = await Promise.allSettled(
        [1, 2, 3].map(() =>
          service.refund(purchase.id, { reason: REASON }, { actorId: admin.user.id, ipAddress: null }),
        ),
      );

      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      for (const result of results) {
        if (result.status === 'rejected') expect(result.reason.getStatus()).toBe(409);
      }
      expect(await counter(course.id)).toBe(0);
      expect(await prisma.auditLog.count({ where: { action: 'purchase.refunded' } })).toBe(1);
    });

    it('needs a reason of 3 to 500 characters and a boolean force', async () => {
      const { admin, purchase } = await scene();

      await refund(admin.session, purchase.id, {}).expect(400);
      await refund(admin.session, purchase.id, { reason: 'ok' }).expect(400);
      await refund(admin.session, purchase.id, { reason: 'x'.repeat(501) }).expect(400);
      await refund(admin.session, purchase.id, { reason: REASON, force: 'yes' }).expect(400);
      expect((await purchaseOf(purchase.id)).status).toBe('PAID');
    });

    it('answers 404 for an unknown order and 400 for a malformed id', async () => {
      const { admin } = await scene();

      await refund(admin.session, randomUUID()).expect(404);
      await refund(admin.session, 'not-a-uuid').expect(400);
    });

    it('is invisible to everyone but an admin', async () => {
      const { buyer, purchase } = await scene();
      const instructor = await createUser(prisma, 'INSTRUCTOR');

      await refund(null, purchase.id).expect(404);
      await refund(buyer.session, purchase.id).expect(404);
      await refund(await signIn(app, instructor.email), purchase.id).expect(404);
      expect((await purchaseOf(purchase.id)).status).toBe('PAID');
    });
  });

  describe('POST /admin/purchases/{id}/refund-reject', () => {
    const reject = (session: Session | null, purchaseId: string, body: object = { reason: 'Đã học quá nửa khóa' }) =>
      post(session, `/admin/purchases/${purchaseId}/refund-reject`, body);

    it('puts a requested order back to PAID, keeps the access, and records why', async () => {
      const { admin, buyer, course, purchase } = await scene({ status: 'REFUND_REQUESTED' });

      const response = await reject(admin.session, purchase.id).expect(200);

      expect(response.body).toMatchObject({ id: purchase.id, status: 'PAID' });
      expect((await enrollmentOf(buyer.user.id, course.id)).status).toBe('ACTIVE');
      expect(await counter(course.id)).toBe(1);
      const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'purchase.refund_rejected' } });
      expect(audit).toMatchObject({ actorId: admin.user.id, entityId: purchase.id });
      expect(audit.metadata).toMatchObject({ reason: 'Đã học quá nửa khóa' });
    });

    it('answers 409 for an order nobody asked to refund, and asks for a reason', async () => {
      const { admin, purchase } = await scene();

      const response = await reject(admin.session, purchase.id).expect(409);
      await reject(admin.session, purchase.id, {}).expect(400);

      expect(response.body.message).toContain('refund request');
      expect((await purchaseOf(purchase.id)).status).toBe('PAID');
      expect(await prisma.auditLog.count({ where: { action: 'purchase.refund_rejected' } })).toBe(0);
    });

    it('is invisible to everyone but an admin', async () => {
      const { buyer, purchase } = await scene({ status: 'REFUND_REQUESTED' });

      await reject(null, purchase.id).expect(404);
      await reject(buyer.session, purchase.id).expect(404);
      expect((await purchaseOf(purchase.id)).status).toBe('REFUND_REQUESTED');
    });
  });

  // The whole loop through the real endpoints: pay, get refunded, buy again.
  it('lets a refunded learner buy the course again, and that payment reopens the same enrollment', async () => {
    const admin = await createUser(prisma, 'ADMIN');
    const adminSession = await signIn(app, admin.email);
    const buyer = await createUser(prisma, 'STUDENT');
    const buyerSession = await signIn(app, buyer.email);
    const course = await createCourse(prisma);
    const buy = async () => {
      const opened = await request(app.getHttpServer())
        .post(`/api/v1/checkout/${course.slug}`)
        .set(as(buyerSession))
        .expect(201);
      const attempt = await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: opened.body.paymentAttemptId } });
      await post(adminSession, `/dev/payments/${attempt.appTransId}/confirm`).expect(200);
      return opened.body.purchaseId as string;
    };

    const first = await buy();
    await refund(adminSession, first).expect(200);
    expect(await counter(course.id)).toBe(0);
    await request(app.getHttpServer()).get(`/api/v1/learn/${course.slug}`).set(as(buyerSession)).expect(403);

    const second = await buy();

    expect(second).not.toBe(first);
    expect(await prisma.enrollment.count({ where: { userId: buyer.id, courseId: course.id } })).toBe(1);
    expect(await enrollmentOf(buyer.id, course.id)).toMatchObject({
      status: 'ACTIVE',
      revokedAt: null,
      purchaseId: second,
    });
    expect(await counter(course.id)).toBe(1);
    await request(app.getHttpServer()).get(`/api/v1/learn/${course.slug}`).set(as(buyerSession)).expect(200);
    expect((await purchaseOf(first)).status).toBe('REFUNDED');
  });
});
