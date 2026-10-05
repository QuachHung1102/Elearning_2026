import type { NestExpressApplication } from '@nestjs/platform-express';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { bootApp, createCourse, createUser, truncateAll } from './support.js';

/**
 * What the `add_payment` migration promises at the database layer
 * (DATA_MODEL.md §SQL viết tay, §PaymentAttempt): the three hand-written
 * statements plus the FK and unique rules Prisma generates. The application
 * checks the same things, but a rule only the application knows can be skipped
 * by the next writer.
 */
describe('add_payment constraints (e2e)', () => {
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

  async function buyerAndCourse() {
    const buyer = await createUser(prisma, 'STUDENT');
    const course = await createCourse(prisma);
    return { userId: buyer.id, courseId: course.id };
  }

  const purchase = (
    ids: { userId: string; courseId: string },
    over: { status?: 'PENDING' | 'PAID' | 'REFUND_REQUESTED' | 'REFUNDED' | 'CANCELLED'; priceVnd?: number } = {},
  ) =>
    prisma.purchase.create({
      data: { ...ids, priceVnd: over.priceVnd ?? 499_000, status: over.status },
    });

  it('refuses a negative purchase price and a zero payment amount', async () => {
    const ids = await buyerAndCourse();
    await expect(purchase(ids, { priceVnd: -1 })).rejects.toThrow(
      /purchases_price_vnd_check/,
    );

    const ok = await purchase(ids);
    await expect(
      prisma.paymentAttempt.create({
        data: {
          purchaseId: ok.id,
          appTransId: '260930_00000001',
          amountVnd: 0,
          expiresAt: new Date(Date.now() + 60_000),
        },
      }),
    ).rejects.toThrow(/payment_attempts_amount_vnd_check/);
  });

  it('allows one open purchase per user and course, and a new one once it is refunded or cancelled', async () => {
    const ids = await buyerAndCourse();
    const first = await purchase(ids);

    // Any of the three open states blocks a second row.
    await expect(purchase(ids)).rejects.toThrow();
    await prisma.purchase.update({ where: { id: first.id }, data: { status: 'PAID' } });
    await expect(purchase(ids)).rejects.toThrow();
    await prisma.purchase.update({ where: { id: first.id }, data: { status: 'REFUND_REQUESTED' } });
    await expect(purchase(ids)).rejects.toThrow();

    // REFUNDED and CANCELLED are closed: buying again inserts a new row.
    await prisma.purchase.update({ where: { id: first.id }, data: { status: 'REFUNDED' } });
    const second = await purchase(ids);
    await prisma.purchase.update({ where: { id: second.id }, data: { status: 'CANCELLED' } });
    await purchase(ids);
    expect(await prisma.purchase.count({ where: ids })).toBe(3);
  });

  it('keeps one attempt per appTransId and per provider transaction', async () => {
    const ids = await buyerAndCourse();
    const bought = await purchase(ids);
    const attempt = (appTransId: string, providerTransId?: string) =>
      prisma.paymentAttempt.create({
        data: {
          purchaseId: bought.id,
          appTransId,
          providerTransId,
          amountVnd: 499_000,
          expiresAt: new Date(Date.now() + 60_000),
        },
      });

    await attempt('260930_aaaaaaaa', 'zp-1');
    await expect(attempt('260930_aaaaaaaa')).rejects.toThrow();
    await expect(attempt('260930_bbbbbbbb', 'zp-1')).rejects.toThrow();
    await attempt('260930_cccccccc', 'zp-2');
  });

  it('links an enrollment to at most one purchase and never lets a linked purchase be deleted', async () => {
    const ids = await buyerAndCourse();
    const bought = await purchase(ids, { status: 'PAID' });
    await prisma.enrollment.create({
      data: { ...ids, source: 'PURCHASE', purchaseId: bought.id },
    });

    const other = await createUser(prisma, 'STUDENT');
    await expect(
      prisma.enrollment.create({
        data: {
          userId: other.id,
          courseId: ids.courseId,
          source: 'PURCHASE',
          purchaseId: bought.id,
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.purchase.delete({ where: { id: bought.id } }),
    ).rejects.toThrow();
  });
});
