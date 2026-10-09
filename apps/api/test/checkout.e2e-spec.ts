import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { CheckoutService } from '../src/checkout/checkout.service.js';
import { DemoZaloPayClient } from '../src/checkout/demo-zalopay.client.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import {
  as,
  bootApp,
  createCourse,
  createUser,
  signIn,
  truncateAll,
  warmPool,
  type Session,
} from './support.js';

/** `POST /checkout/{courseSlug}` (API_CONTRACT.md §5.8, ROADMAP.md §8). */
describe('checkout (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await bootApp());
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

  async function learner(over: { verified?: boolean } = {}) {
    const user = await createUser(prisma, 'STUDENT');
    if (over.verified === false) {
      await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: null } });
    }
    return { user, session: await signIn(app, user.email) };
  }

  const checkout = (session: Session, slug: string) =>
    request(app.getHttpServer()).post(`/api/v1/checkout/${slug}`).set(as(session));

  const openPurchases = (userId: string) => prisma.purchase.findMany({ where: { userId } });

  it('creates the order and a QR that the provider holds, and says when it expires', async () => {
    const course = await createCourse(prisma);
    const { user, session } = await learner();

    const response = await checkout(session, course.slug).expect(201);

    const [purchase] = await openPurchases(user.id);
    const attempt = await prisma.paymentAttempt.findFirstOrThrow({ where: { purchaseId: purchase.id } });
    expect(purchase).toMatchObject({ courseId: course.id, status: 'PENDING', priceVnd: 499_000 });
    expect(attempt).toMatchObject({ provider: 'DEMO', status: 'PENDING', amountVnd: 499_000 });
    expect(attempt.appTransId).toMatch(/^\d{6}_[0-9a-f]{8}$/);
    expect(response.body).toEqual({
      purchaseId: purchase.id,
      paymentAttemptId: attempt.id,
      appTransId: attempt.appTransId,
      status: 'PENDING',
      amountVnd: 499_000,
      provider: 'DEMO',
      qrCode: attempt.qrCode,
      orderUrl: `http://localhost:3000/account/orders/${purchase.id}`,
      createdAt: attempt.createdAt.toISOString(),
      expiresAt: attempt.expiresAt.toISOString(),
    });
    expect(attempt.qrCode).toContain(`/dev/payments/${attempt.appTransId}/confirm`);
    const ttl = attempt.expiresAt.getTime() - Date.now();
    expect(ttl).toBeGreaterThan(14 * 60_000);
    expect(ttl).toBeLessThanOrEqual(15 * 60_000);
    // A personal, one-shot answer: never for a shared cache to keep.
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('hands the live QR back with 200 instead of opening a second order', async () => {
    const course = await createCourse(prisma);
    const { user, session } = await learner();
    const first = await checkout(session, course.slug).expect(201);

    const again = await checkout(session, course.slug).expect(200);

    expect(again.body).toEqual(first.body);
    expect(await openPurchases(user.id)).toHaveLength(1);
    expect(await prisma.paymentAttempt.count()).toBe(1);
  });

  it('opens a new QR on the same order once the old one has expired', async () => {
    const course = await createCourse(prisma);
    const { user, session } = await learner();
    const first = await checkout(session, course.slug).expect(201);
    await prisma.paymentAttempt.update({
      where: { id: first.body.paymentAttemptId },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });

    const second = await checkout(session, course.slug).expect(201);

    expect(second.body.purchaseId).toBe(first.body.purchaseId);
    expect(second.body.paymentAttemptId).not.toBe(first.body.paymentAttemptId);
    expect(second.body.qrCode).not.toBe(first.body.qrCode);
    expect(await openPurchases(user.id)).toHaveLength(1);
    expect(await prisma.paymentAttempt.count()).toBe(2);
  });

  // The order and its QR are charged the same amount; a price change between
  // two QR codes of an unpaid order moves both.
  it('re-prices an unpaid order when the course price changed before the new QR', async () => {
    const course = await createCourse(prisma);
    const { user, session } = await learner();
    const first = await checkout(session, course.slug).expect(201);
    await prisma.paymentAttempt.update({
      where: { id: first.body.paymentAttemptId },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    await prisma.course.update({ where: { id: course.id }, data: { priceVnd: 399_000 } });

    const second = await checkout(session, course.slug).expect(201);

    expect(second.body.amountVnd).toBe(399_000);
    expect(await openPurchases(user.id)).toEqual([expect.objectContaining({ priceVnd: 399_000 })]);
  });

  // Straight at the service, so the calls really overlap: through HTTP the auth
  // step staggers them and the race never happens. Without the per-learner lock
  // every caller but one dies on the partial unique index (a 409).
  it('opens one order for simultaneous clicks, and none of them fails', async () => {
    const course = await createCourse(prisma);
    const { user } = await learner();
    const service = app.get(CheckoutService);
    await warmPool(prisma);

    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () =>
        service.createCheckout({ id: user.id, emailVerifiedAt: new Date() }, course.slug),
      ),
    );

    expect(results.map((result) => result.status)).toEqual(Array(6).fill('fulfilled'));
    expect(await openPurchases(user.id)).toHaveLength(1);
    // ponytail: a call that starts while another is still asking the provider
    // for its QR opens one more attempt on the same order. Extra QRs are valid
    // and a double payment is flagged as `payment.duplicate_paid`; waiting for
    // the in-flight one would cost a poll loop.
    expect(await prisma.paymentAttempt.count()).toBeGreaterThanOrEqual(1);
  });

  it('needs a session', async () => {
    const course = await createCourse(prisma);
    const csrf = await request(app.getHttpServer()).get('/api/v1/auth/csrf').expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/checkout/${course.slug}`)
      .set('Cookie', csrf.headers['set-cookie'])
      .set('X-CSRF-Token', csrf.body.csrfToken)
      .expect(401);
    expect(await prisma.purchase.count()).toBe(0);
  });

  it('asks an unverified learner to verify the email first', async () => {
    const course = await createCourse(prisma);
    const { session } = await learner({ verified: false });

    const response = await checkout(session, course.slug).expect(403);

    expect(response.body.code).toBe('EMAIL_NOT_VERIFIED');
    expect(await prisma.purchase.count()).toBe(0);
  });

  it('answers 404 for an unknown or unpublished course, as for a course that does not exist', async () => {
    const draft = await createCourse(prisma, { status: 'DRAFT' });
    const { session } = await learner();

    await checkout(session, 'khong-ton-tai').expect(404);
    await checkout(session, draft.slug).expect(404);
    expect(await prisma.purchase.count()).toBe(0);
  });

  it.each([
    ['an archived course', { status: 'ARCHIVED' as const }],
    ['a free course', { priceVnd: 0 }],
  ])('answers 422 COURSE_NOT_PURCHASABLE for %s', async (_label, over) => {
    const course = await createCourse(prisma, over);
    const { session } = await learner();

    const response = await checkout(session, course.slug).expect(422);

    expect(response.body.code).toBe('COURSE_NOT_PURCHASABLE');
    expect(await prisma.purchase.count()).toBe(0);
  });

  it('answers 409 ALREADY_ENROLLED and opens nothing for a learner who already has access', async () => {
    const course = await createCourse(prisma);
    const admin = await createUser(prisma, 'ADMIN');
    const { user, session } = await learner();
    await prisma.enrollment.create({
      data: { userId: user.id, courseId: course.id, source: 'MANUAL_GRANT', grantedById: admin.id },
    });

    const response = await checkout(session, course.slug).expect(409);

    expect(response.body.code).toBe('ALREADY_ENROLLED');
    expect(await prisma.purchase.count()).toBe(0);
    expect(await prisma.paymentAttempt.count()).toBe(0);
  });

  // An admin can revoke access without refunding. The order is still PAID, the
  // partial unique index still holds it, and buying again would charge twice.
  it('answers 409 ALREADY_ENROLLED for a learner whose order is paid, even if access was revoked', async () => {
    const course = await createCourse(prisma);
    const { user, session } = await learner();
    await prisma.purchase.create({
      data: { userId: user.id, courseId: course.id, priceVnd: 499_000, status: 'PAID', paidAt: new Date() },
    });

    const response = await checkout(session, course.slug).expect(409);

    expect(response.body.code).toBe('ALREADY_ENROLLED');
    expect(await prisma.paymentAttempt.count()).toBe(0);
  });

  it('opens a fresh order for a learner whose earlier order was refunded', async () => {
    const course = await createCourse(prisma);
    const { user, session } = await learner();
    await prisma.purchase.create({
      data: { userId: user.id, courseId: course.id, priceVnd: 499_000, status: 'REFUNDED', refundedAt: new Date() },
    });

    await checkout(session, course.slug).expect(201);

    expect((await openPurchases(user.id)).map((row) => row.status).sort()).toEqual(['PENDING', 'REFUNDED']);
  });

  it('limits a learner to five requests in five minutes', async () => {
    const course = await createCourse(prisma);
    const { session } = await learner();
    await checkout(session, course.slug).expect(201);
    for (let call = 2; call <= 5; call += 1) {
      await checkout(session, course.slug).expect(200);
    }

    const response = await checkout(session, course.slug).expect(429);

    expect(response.body.code).toBe('RATE_LIMITED');
    expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
  });

  // DEMO_MODE.md §5: the order row exists before the provider is called, so a
  // lost response leaves something for reconcile to find.
  it('keeps the order when the provider call fails, and opens a new QR on the next try', async () => {
    const course = await createCourse(prisma);
    const { user, session } = await learner();
    vi.spyOn(app.get(DemoZaloPayClient), 'createOrder').mockRejectedValueOnce(new Error('network down'));

    await checkout(session, course.slug).expect(500);

    const [purchase] = await openPurchases(user.id);
    const orphan = await prisma.paymentAttempt.findFirstOrThrow({ where: { purchaseId: purchase.id } });
    expect(orphan).toMatchObject({ status: 'PENDING', qrCode: null });

    const retry = await checkout(session, course.slug).expect(201);

    expect(retry.body.paymentAttemptId).not.toBe(orphan.id);
    expect(retry.body.purchaseId).toBe(purchase.id);
    expect(await prisma.paymentAttempt.count()).toBe(2);
  });
});
