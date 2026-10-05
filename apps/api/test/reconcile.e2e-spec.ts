import type { NestExpressApplication } from '@nestjs/platform-express';
import { DemoZaloPayClient } from '../src/checkout/demo-zalopay.client.js';
import { ReconcileService } from '../src/checkout/reconcile.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { bootApp, createOrder, truncateAll, untilBlockedOnLock, warmPool } from './support.js';

const PRICE = 499_000;
const DAY_MINUTES = 24 * 60;

/**
 * The periodic job (DEMO_MODE.md §5, "Một tác vụ định kỳ"): ask the provider
 * about attempts whose callback may have been lost, then close what has lapsed
 * — in that order — then cancel orders nobody came back to pay.
 */
describe('reconcile (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let reconcile: ReconcileService;
  let demo: DemoZaloPayClient;

  beforeAll(async () => {
    ({ app, prisma } = await bootApp());
    reconcile = app.get(ReconcileService);
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

  const audits = (action: string) => prisma.auditLog.findMany({ where: { action } });
  const attemptOf = (id: string) => prisma.paymentAttempt.findUniqueOrThrow({ where: { id } });
  const purchaseOf = (id: string) => prisma.purchase.findUniqueOrThrow({ where: { id } });

  // The scenario PROJECT_PLAN.md makes mandatory: the provider took the money
  // and the callback never arrived. Only the provider's own memory knows.
  it('confirms a payment whose callback was lost', async () => {
    const { user, course, purchase, attempt } = await createOrder(prisma, { ageMinutes: 5 });
    demo.settle(attempt.appTransId, { amountVnd: PRICE, expiresAt: attempt.expiresAt });

    const summary = await reconcile.runOnce();

    expect(summary).toEqual({ confirmed: 1, failed: 0, expired: 0, cancelled: 0 });
    expect(await purchaseOf(purchase.id)).toMatchObject({ status: 'PAID' });
    expect(await attemptOf(attempt.id)).toMatchObject({
      status: 'SUCCEEDED',
      providerTransId: expect.stringMatching(/^demo-/),
    });
    expect(
      await prisma.enrollment.count({ where: { userId: user.id, courseId: course.id, status: 'ACTIVE' } }),
    ).toBe(1);
    const [reconciled] = await audits('payment.reconciled');
    expect(reconciled).toMatchObject({ actorId: null, entityId: attempt.id });
    expect(reconciled.metadata).toMatchObject({ fromStatus: 'PENDING', toStatus: 'SUCCEEDED' });
    expect(await audits('purchase.paid')).toHaveLength(1);
  });

  it('leaves an attempt younger than RECONCILE_MIN_AGE to the callback that may still arrive', async () => {
    const { purchase } = await createOrder(prisma, { ageMinutes: 0 });
    const query = vi.spyOn(demo, 'queryOrder');

    await reconcile.runOnce();

    expect(query).not.toHaveBeenCalled();
    expect((await purchaseOf(purchase.id)).status).toBe('PENDING');
  });

  it('changes nothing while the provider still calls the order processing', async () => {
    const { purchase, attempt } = await createOrder(prisma, { ageMinutes: 5 });

    const summary = await reconcile.runOnce();

    expect(summary).toEqual({ confirmed: 0, failed: 0, expired: 0, cancelled: 0 });
    expect((await attemptOf(attempt.id)).status).toBe('PENDING');
    expect((await purchaseOf(purchase.id)).status).toBe('PENDING');
    expect(await prisma.auditLog.count()).toBe(0);
  });

  it('closes an attempt the provider reports as failed, without touching the order', async () => {
    const { purchase, attempt } = await createOrder(prisma, { ageMinutes: 5 });
    vi.spyOn(demo, 'queryOrder').mockResolvedValueOnce({ returnCode: 2, returnMessage: 'user cancelled' });

    const summary = await reconcile.runOnce();

    expect(summary.failed).toBe(1);
    expect(await attemptOf(attempt.id)).toMatchObject({ status: 'FAILED', failureReason: 'user cancelled' });
    expect((await purchaseOf(purchase.id)).status).toBe('PENDING');
    expect(await prisma.enrollment.count()).toBe(0);
    const [row] = await audits('payment.reconciled');
    expect(row.metadata).toMatchObject({ fromStatus: 'PENDING', toStatus: 'FAILED' });
  });

  // Asked first, closed second. Reverse them and an attempt the provider has
  // just paid is marked EXPIRED before anyone hears about the payment.
  it('asks the provider before it expires a lapsed attempt, and expires it only if unpaid', async () => {
    const paid = await createOrder(prisma, { ageMinutes: 20, expiresInMinutes: -5 });
    const unpaid = await createOrder(prisma, { ageMinutes: 20, expiresInMinutes: -5 });
    vi.spyOn(demo, 'queryOrder').mockImplementation(async (appTransId) =>
      appTransId === paid.attempt.appTransId
        ? { returnCode: 1, returnMessage: 'ok', zpTransId: 'zp-late', amountVnd: PRICE }
        : { returnCode: 3, returnMessage: 'processing' },
    );

    const summary = await reconcile.runOnce();

    expect(summary).toEqual({ confirmed: 1, failed: 0, expired: 1, cancelled: 0 });
    expect(await attemptOf(paid.attempt.id)).toMatchObject({ status: 'SUCCEEDED', providerTransId: 'zp-late' });
    expect((await purchaseOf(paid.purchase.id)).status).toBe('PAID');
    expect((await attemptOf(unpaid.attempt.id)).status).toBe('EXPIRED');
    const expired = (await audits('payment.reconciled')).find((row) => row.entityId === unpaid.attempt.id);
    expect(expired).toMatchObject({ actorId: null });
    expect(expired?.metadata).toMatchObject({ fromStatus: 'PENDING', toStatus: 'EXPIRED' });
  });

  it('does not expire an attempt that is still live', async () => {
    const { attempt } = await createOrder(prisma, { ageMinutes: 5, expiresInMinutes: 10 });

    const summary = await reconcile.runOnce();

    expect(summary.expired).toBe(0);
    expect((await attemptOf(attempt.id)).status).toBe('PENDING');
  });

  it('does not grant access for an amount the provider reports differently from the snapshot', async () => {
    const { purchase, attempt } = await createOrder(prisma, { ageMinutes: 5 });
    demo.settle(attempt.appTransId, { amountVnd: 1_000, expiresAt: attempt.expiresAt });

    const summary = await reconcile.runOnce();

    expect(summary.confirmed).toBe(0);
    expect((await purchaseOf(purchase.id)).status).toBe('PENDING');
    expect(await prisma.enrollment.count()).toBe(0);
    const [row] = await audits('payment.callback_rejected');
    expect(row.metadata).toMatchObject({ rejectReason: 'amount_mismatch' });
  });

  it('carries on past an attempt the provider cannot answer for', async () => {
    const broken = await createOrder(prisma, { ageMinutes: 6 });
    const healthy = await createOrder(prisma, { ageMinutes: 5 });
    demo.settle(healthy.attempt.appTransId, { amountVnd: PRICE, expiresAt: healthy.attempt.expiresAt });
    const real = demo.queryOrder.bind(demo);
    vi.spyOn(demo, 'queryOrder').mockImplementation(async (appTransId) => {
      if (appTransId === broken.attempt.appTransId) throw new Error('timeout');
      return real(appTransId);
    });

    const summary = await reconcile.runOnce();

    expect(summary.confirmed).toBe(1);
    expect((await purchaseOf(healthy.purchase.id)).status).toBe('PAID');
    expect((await attemptOf(broken.attempt.id)).status).toBe('PENDING');
  });

  describe('orders nobody came back to pay', () => {
    it('cancels an order whose last QR lapsed more than seven days ago, and frees the slot for a new one', async () => {
      const { user, course, purchase, attempt } = await createOrder(prisma, {
        attempt: 'EXPIRED',
        ageMinutes: 8 * DAY_MINUTES + 15,
        expiresInMinutes: -8 * DAY_MINUTES,
      });

      const summary = await reconcile.runOnce();

      expect(summary.cancelled).toBe(1);
      expect((await purchaseOf(purchase.id)).status).toBe('CANCELLED');
      const [row] = await audits('purchase.cancelled');
      expect(row).toMatchObject({ actorId: null, entityType: 'PURCHASE', entityId: purchase.id });
      expect(row.metadata).toMatchObject({
        lastAttemptId: attempt.id,
        expiredAt: attempt.expiresAt.toISOString(),
      });
      // The partial unique index no longer holds the learner's slot.
      await expect(
        prisma.purchase.create({ data: { userId: user.id, courseId: course.id, priceVnd: PRICE } }),
      ).resolves.toMatchObject({ status: 'PENDING' });
    });

    it.each([
      ['a QR that lapsed two days ago', { attempt: 'EXPIRED' as const, ageMinutes: 2 * DAY_MINUTES + 15, expiresInMinutes: -2 * DAY_MINUTES }],
      ['a QR that is still live', { ageMinutes: 5 }],
    ])('keeps an order with %s', async (_label, over) => {
      const { purchase } = await createOrder(prisma, over);

      const summary = await reconcile.runOnce();

      expect(summary.cancelled).toBe(0);
      expect((await purchaseOf(purchase.id)).status).toBe('PENDING');
    });

    // The learner's checkout holds their row lock while it opens a QR. Here that
    // transaction is held open by hand while the job runs into it; when it lets
    // go the job must look again and find the new QR instead of cancelling on
    // what it read before.
    it('does not cancel an order whose learner opened a new QR while the job was deciding', async () => {
      const { user, purchase } = await createOrder(prisma, {
        attempt: 'EXPIRED',
        ageMinutes: 8 * DAY_MINUTES + 15,
        expiresInMinutes: -8 * DAY_MINUTES,
      });
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const checkout = prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT 1 FROM users WHERE id = ${user.id}::uuid FOR NO KEY UPDATE`;
        await gate;
        await tx.paymentAttempt.create({
          data: {
            purchaseId: purchase.id,
            appTransId: '260930_22222222',
            amountVnd: PRICE,
            expiresAt: new Date(Date.now() + 600_000),
          },
        });
      });

      const run = reconcile.runOnce();
      await untilBlockedOnLock(prisma); // the job now waits on the lock
      release();
      await checkout;
      const summary = await run;

      expect(summary.cancelled).toBe(0);
      expect((await purchaseOf(purchase.id)).status).toBe('PENDING');
    });

    it('keeps an order that has a newer QR even if an older one lapsed long ago', async () => {
      const { purchase } = await createOrder(prisma, {
        attempt: 'EXPIRED',
        ageMinutes: 9 * DAY_MINUTES,
        expiresInMinutes: -9 * DAY_MINUTES,
      });
      await prisma.paymentAttempt.create({
        data: {
          purchaseId: purchase.id,
          appTransId: '260930_11111111',
          amountVnd: PRICE,
          expiresAt: new Date(Date.now() + 600_000),
          createdAt: new Date(Date.now() - 300_000),
        },
      });

      const summary = await reconcile.runOnce();

      expect(summary.cancelled).toBe(0);
      expect((await purchaseOf(purchase.id)).status).toBe('PENDING');
    });
  });

  it('asks the provider once when two runs overlap', async () => {
    const { attempt } = await createOrder(prisma, { ageMinutes: 5 });
    demo.settle(attempt.appTransId, { amountVnd: PRICE, expiresAt: attempt.expiresAt });
    const query = vi.spyOn(demo, 'queryOrder');
    await warmPool(prisma);

    await Promise.all([reconcile.runOnce(), reconcile.runOnce()]);

    expect(query).toHaveBeenCalledTimes(1);
    expect(await prisma.enrollment.count()).toBe(1);
  });
});
