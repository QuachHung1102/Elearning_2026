import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { CheckoutService } from '../src/checkout/checkout.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import {
  addAttempt,
  bootApp,
  createOrder,
  createUser,
  truncateAll,
  warmPool,
  type OrderState,
} from './support.js';

const PRICE = 499_000;

/**
 * `confirmPayment` is the one function the real callback, the reconcile job and
 * the demo confirm button all call (DATA_MODEL.md §PaymentAttempt), so its
 * idempotency and its rejections are tested here against the real database
 * rather than through any of the three doors.
 */
describe('confirmPayment (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let checkout: CheckoutService;

  beforeAll(async () => {
    ({ app, prisma } = await bootApp());
    checkout = app.get(CheckoutService);
  });

  beforeEach(async () => {
    await truncateAll(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  const order = (state: OrderState = {}) => createOrder(prisma, state);

  const pay = (
    appTransId: string,
    over: { amountVnd?: number; providerTransId?: string } = {},
  ) =>
    checkout.confirmPayment({
      appTransId,
      amountVnd: over.amountVnd ?? PRICE,
      providerTransId: over.providerTransId ?? `zp-${randomUUID()}`,
    });

  const actions = async () =>
    (await prisma.auditLog.findMany()).map((row) => row.action).sort();
  const enrollmentCount = async (courseId: string) =>
    (await prisma.course.findUniqueOrThrow({ where: { id: courseId } })).enrollmentCount;

  it('pays the order, unlocks the course as the system, and says what the receipt needs', async () => {
    const { user, course, purchase, attempt } = await order();

    const outcome = await pay(attempt.appTransId, { providerTransId: 'zp-1' });

    expect(outcome).toEqual({
      status: 'PAID',
      purchaseId: purchase.id,
      userId: user.id,
      courseId: course.id,
      receipt: {
        email: user.email,
        displayName: 'Người dùng',
        courseTitle: 'Khóa có thể mua',
        priceVnd: PRICE,
      },
    });
    const paidAttempt = await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(paidAttempt).toMatchObject({ status: 'SUCCEEDED', providerTransId: 'zp-1' });
    expect(paidAttempt.paidAt).not.toBeNull();
    const paidPurchase = await prisma.purchase.findUniqueOrThrow({ where: { id: purchase.id } });
    expect(paidPurchase.status).toBe('PAID');
    expect(paidPurchase.paidAt).toEqual(paidAttempt.paidAt);
    expect(
      await prisma.enrollment.findUniqueOrThrow({
        where: { userId_courseId: { userId: user.id, courseId: course.id } },
      }),
    ).toMatchObject({ status: 'ACTIVE', source: 'PURCHASE', purchaseId: purchase.id, grantedById: null });
    expect(await enrollmentCount(course.id)).toBe(1);
    expect(await actions()).toEqual(['enrollment.granted', 'purchase.paid']);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'purchase.paid' } });
    expect(audit).toMatchObject({ actorId: null, entityType: 'PURCHASE', entityId: purchase.id });
    expect(audit.metadata).toMatchObject({
      courseId: course.id,
      priceVnd: PRICE,
      appTransId: attempt.appTransId,
    });
  });

  it('answers a repeated callback with success and changes nothing', async () => {
    const { course, purchase, attempt } = await order();
    await pay(attempt.appTransId, { providerTransId: 'zp-1' });
    const before = {
      attempt: await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } }),
      purchase: await prisma.purchase.findUniqueOrThrow({ where: { id: purchase.id } }),
      audit: await prisma.auditLog.count(),
    };

    const again = await pay(attempt.appTransId, { providerTransId: 'zp-1' });

    expect(again).toEqual({ status: 'ALREADY_PROCESSED' });
    // `paidAt` is the moment of the first payment, not of the last retry.
    expect(await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).toEqual(before.attempt);
    expect(await prisma.purchase.findUniqueOrThrow({ where: { id: purchase.id } })).toEqual(before.purchase);
    expect(await prisma.auditLog.count()).toBe(before.audit);
    expect(await prisma.enrollment.count()).toBe(1);
    expect(await enrollmentCount(course.id)).toBe(1);
  });

  it('lets exactly one of several simultaneous callbacks through', async () => {
    const { course, attempt } = await order();
    await warmPool(prisma);

    const outcomes = await Promise.all(
      [1, 2, 3, 4].map(() => pay(attempt.appTransId, { providerTransId: 'zp-1' })),
    );

    expect(outcomes.map((outcome) => outcome.status).sort()).toEqual([
      'ALREADY_PROCESSED',
      'ALREADY_PROCESSED',
      'ALREADY_PROCESSED',
      'PAID',
    ]);
    expect(await prisma.enrollment.count()).toBe(1);
    expect(await enrollmentCount(course.id)).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: 'purchase.paid' } })).toBe(1);
  });

  it('rejects an amount that differs from the snapshot, leaves the order open, and records why', async () => {
    const { course, purchase, attempt } = await order();

    const outcome = await pay(attempt.appTransId, { amountVnd: 1_000 });

    expect(outcome).toEqual({ status: 'REJECTED', reason: 'amount_mismatch' });
    expect(
      (await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).status,
    ).toBe('PENDING');
    expect((await prisma.purchase.findUniqueOrThrow({ where: { id: purchase.id } })).status).toBe('PENDING');
    expect(await prisma.enrollment.count()).toBe(0);
    expect(await enrollmentCount(course.id)).toBe(0);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'payment.callback_rejected' } });
    expect(audit).toMatchObject({ actorId: null, entityType: 'PAYMENT_ATTEMPT', entityId: attempt.id });
    expect(audit.metadata).toMatchObject({
      appTransId: attempt.appTransId,
      rejectReason: 'amount_mismatch',
    });
  });

  it('rejects an app_trans_id it never issued and grants nothing', async () => {
    await order();

    const outcome = await pay('260930_deadbeef');

    expect(outcome).toEqual({ status: 'REJECTED', reason: 'unknown_app_trans_id' });
    expect(await prisma.enrollment.count()).toBe(0);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'payment.callback_rejected' } });
    expect(audit.entityId).toBeNull();
    expect(audit.metadata).toMatchObject({ appTransId: '260930_deadbeef', rejectReason: 'unknown_app_trans_id' });
  });

  it('flags a second paid attempt of the same order without granting or counting twice', async () => {
    const { course, purchase, attempt } = await order();
    const second = await addAttempt(prisma, purchase.id);
    await pay(attempt.appTransId);
    const paidAt = (await prisma.purchase.findUniqueOrThrow({ where: { id: purchase.id } })).paidAt;

    const outcome = await pay(second.appTransId);

    expect(outcome).toEqual({ status: 'DUPLICATE_PAID', purchaseId: purchase.id });
    // The money did arrive, so the attempt records it; the order does not move.
    expect(
      (await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: second.id } })).status,
    ).toBe('SUCCEEDED');
    expect((await prisma.purchase.findUniqueOrThrow({ where: { id: purchase.id } })).paidAt).toEqual(paidAt);
    expect(await enrollmentCount(course.id)).toBe(1);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'payment.duplicate_paid' } });
    expect(audit).toMatchObject({ entityType: 'PAYMENT_ATTEMPT', entityId: second.id });
    expect(audit.metadata).toMatchObject({
      appTransId: second.appTransId,
      purchaseId: purchase.id,
      firstAttemptId: attempt.id,
    });
  });

  // P4-4: money already collected must not be lost because the QR timed out
  // between the customer's payment and the callback.
  it('confirms a payment that arrives after the QR expired, and marks it late', async () => {
    const { user, course, purchase, attempt } = await order({ attempt: 'EXPIRED' });

    const outcome = await pay(attempt.appTransId);

    expect(outcome).toMatchObject({ status: 'PAID', purchaseId: purchase.id });
    expect(
      (await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).status,
    ).toBe('SUCCEEDED');
    expect(
      await prisma.enrollment.count({ where: { userId: user.id, courseId: course.id, status: 'ACTIVE' } }),
    ).toBe(1);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'payment.reconciled' } });
    expect(audit).toMatchObject({ entityType: 'PAYMENT_ATTEMPT', entityId: attempt.id });
    expect(audit.metadata).toMatchObject({
      appTransId: attempt.appTransId,
      fromStatus: 'EXPIRED',
      toStatus: 'SUCCEEDED',
      late: true,
    });
  });

  it.each([['CANCELLED'], ['REFUNDED']] as const)(
    'rejects a payment for a %s order but keeps the record that the money arrived',
    async (closed) => {
      const { course, purchase, attempt } = await order({ purchase: closed, attempt: 'EXPIRED' });

      const outcome = await pay(attempt.appTransId);

      expect(outcome).toEqual({ status: 'REJECTED', reason: `purchase_${closed.toLowerCase()}` });
      expect(
        (await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).status,
      ).toBe('SUCCEEDED');
      expect((await prisma.purchase.findUniqueOrThrow({ where: { id: purchase.id } })).status).toBe(closed);
      expect(await prisma.enrollment.count()).toBe(0);
      expect(await enrollmentCount(course.id)).toBe(0);
      const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'payment.callback_rejected' } });
      expect(audit).toMatchObject({ entityId: attempt.id });
      expect(audit.metadata).toMatchObject({ rejectReason: `purchase_${closed.toLowerCase()}` });
    },
  );

  // Only a SUCCEEDED attempt may answer "already processed". A closed attempt
  // that the provider now says was paid is a disagreement someone must see.
  it.each([['FAILED'], ['CANCELLED']] as const)(
    'rejects a payment for a %s attempt instead of calling it processed',
    async (closed) => {
      const { attempt } = await order({ attempt: closed });

      const outcome = await pay(attempt.appTransId);

      expect(outcome).toEqual({ status: 'REJECTED', reason: 'attempt_closed' });
      expect(
        (await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).status,
      ).toBe(closed);
      expect(await prisma.enrollment.count()).toBe(0);
      const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'payment.callback_rejected' } });
      expect(audit.metadata).toMatchObject({ rejectReason: 'attempt_closed' });
    },
  );

  // The order was sold while PUBLISHED; the owner may unpublish a minute later.
  it('still unlocks a course that was unpublished after the QR was shown', async () => {
    const { user, course, attempt } = await order({ course: 'DRAFT' });

    const outcome = await pay(attempt.appTransId);

    expect(outcome.status).toBe('PAID');
    expect(
      await prisma.enrollment.count({ where: { userId: user.id, courseId: course.id, status: 'ACTIVE' } }),
    ).toBe(1);
  });

  it('moves a manual grant onto the order instead of counting the learner twice', async () => {
    const { user, course, purchase, attempt } = await order();
    const admin = await createUser(prisma, 'ADMIN');
    await prisma.enrollment.create({
      data: { userId: user.id, courseId: course.id, source: 'MANUAL_GRANT', grantedById: admin.id },
    });
    await prisma.course.update({ where: { id: course.id }, data: { enrollmentCount: 1 } });

    await pay(attempt.appTransId);

    expect(
      await prisma.enrollment.findUniqueOrThrow({
        where: { userId_courseId: { userId: user.id, courseId: course.id } },
      }),
    ).toMatchObject({ source: 'PURCHASE', purchaseId: purchase.id, grantedById: admin.id });
    expect(await enrollmentCount(course.id)).toBe(1);
  });

  it('records a reconcile-driven confirmation with who ran it', async () => {
    const { attempt } = await order();

    await checkout.confirmPayment(
      { appTransId: attempt.appTransId, amountVnd: PRICE, providerTransId: 'zp-r' },
      { reconciledBy: { actorId: null } },
    );

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'payment.reconciled' } });
    expect(audit.actorId).toBeNull();
    expect(audit.metadata).toMatchObject({ fromStatus: 'PENDING', toStatus: 'SUCCEEDED' });
    expect(audit.metadata).not.toHaveProperty('late', true);
  });
});
