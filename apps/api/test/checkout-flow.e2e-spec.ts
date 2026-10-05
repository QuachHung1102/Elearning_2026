import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DemoZaloPayClient } from '../src/checkout/demo-zalopay.client.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import {
  as,
  bootApp,
  createCourse,
  createUser,
  seedDemoData,
  signIn,
  truncateAll,
  type Session,
} from './support.js';

/**
 * ROADMAP.md §8, "Demo script" and "Acceptance": Phase 4 the way a person walks
 * it, over HTTP, with nothing faked but the provider. Each `A4.x`/`N4.x` that
 * needs more than one endpoint to show lives here; the rest are pinned by the
 * spec of the piece they test (`checkout`, `confirm-payment`, `payment-callback`,
 * `purchases`, `refunds`, `reconcile`, `admin-payments`, `real-driver`).
 *
 * The first test is the demo script on the real seed, accounts and course
 * included, so a seed that stops supporting the demo fails here. The others
 * bend rules the seed should not carry (a price change, a second QR) and run on
 * throwaway fixtures, so nothing they do depends on the order of the tests.
 */
const C2 = 'typescript-cho-nguoi-da-biet-javascript'; // 499.000 ₫
const BUYER = { email: 'student3@elearning.local', password: 'Demo!Student123' };
const OWNER = { email: 'admin@elearning.local', password: 'Demo!Admin123' };

describe('checkout, end to end (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let demo: DemoZaloPayClient;
  let admin: Session;

  beforeAll(async () => {
    ({ app, prisma } = await bootApp());
    demo = app.get(DemoZaloPayClient);
    // Emptied first: the demo script's "revenue 499000" holds only if nothing
    // else was ever sold.
    await truncateAll(prisma);
    seedDemoData();
    admin = await signIn(app, OWNER.email, OWNER.password);
  }, 180_000);

  afterAll(async () => {
    await app.close();
  });

  const call = (method: 'get' | 'post' | 'put', session: Session | null, path: string, body?: object) => {
    const pending = request(app.getHttpServer())[method](`/api/v1${path}`);
    if (session) pending.set(as(session));
    return body ? pending.send(body) : pending;
  };

  const attemptOf = (id: string) => prisma.paymentAttempt.findUniqueOrThrow({ where: { id } });

  const courseRow = async (courseId: string) => {
    const report = await call('get', admin, '/admin/reports/courses').expect(200);
    return report.body.items.find((row: { courseId: string }) => row.courseId === courseId);
  };

  async function throwawayScene(priceVnd = 690_000) {
    const course = await createCourse(prisma, { priceVnd });
    const learnerUser = await createUser(prisma, 'STUDENT');
    return { course, learnerUser, learner: await signIn(app, learnerUser.email) };
  }

  it('walks the demo script on the seed: QR, one QR per order, admin confirm, access, revenue, refund', async () => {
    const course = await prisma.course.findUniqueOrThrow({ where: { slug: C2 } });
    const buyer = await prisma.user.findUniqueOrThrow({ where: { email: BUYER.email } });
    const learner = await signIn(app, BUYER.email, BUYER.password);
    const article = await prisma.lesson.findFirstOrThrow({
      where: { type: 'ARTICLE', section: { courseId: course.id } },
    });
    expect(course.priceVnd).toBe(499_000);
    const before = await courseRow(course.id);
    expect((await call('get', admin, '/admin/reports/overview').expect(200)).body).toMatchObject({
      revenueVnd: 0,
      paidPurchases: 0,
    });

    // 3. the QR
    const first = await call('post', learner, `/checkout/${C2}`).expect(201);
    expect(first.body).toMatchObject({ status: 'PENDING', amountVnd: 499_000, provider: 'DEMO' });
    expect(first.body.qrCode).toEqual(expect.any(String));
    expect(first.body.expiresAt).toEqual(expect.any(String));
    // Nothing is unlocked by opening a checkout.
    await call('get', learner, `/learn/${C2}`).expect(403);

    // 4. asking again hands back the same QR (A4.2)
    const second = await call('post', learner, `/checkout/${C2}`).expect(200);
    expect(second.body.paymentAttemptId).toBe(first.body.paymentAttemptId);
    expect(second.body.qrCode).toBe(first.body.qrCode);
    expect(await prisma.paymentAttempt.count({ where: { purchaseId: first.body.purchaseId } })).toBe(1);

    // What the page polls: the stored order, still open.
    const polling = await call('get', learner, `/purchases/${first.body.purchaseId}`).expect(200);
    expect(polling.body).toMatchObject({ status: 'PENDING', courseSlug: C2 });
    expect(polling.body.attempts).toHaveLength(1);

    // 5. the admin presses "Xác nhận thanh toán" (A4.3, A4.4)
    const attempt = await attemptOf(first.body.paymentAttemptId);
    const confirmed = await call('post', admin, `/dev/payments/${attempt.appTransId}/confirm`).expect(200);
    expect(confirmed.body).toEqual({ status: 'PAID' });
    expect(await prisma.purchase.findUniqueOrThrow({ where: { id: first.body.purchaseId } })).toMatchObject({
      status: 'PAID',
      priceVnd: 499_000,
    });
    expect(
      await prisma.enrollment.findUniqueOrThrow({
        where: { userId_courseId: { userId: buyer.id, courseId: course.id } },
      }),
    ).toMatchObject({ source: 'PURCHASE', purchaseId: first.body.purchaseId, status: 'ACTIVE' });

    // 6. the page's next poll sees it; 8. the course opens and the order is listed (A4.6)
    const paid = await call('get', learner, `/purchases/${first.body.purchaseId}`).expect(200);
    expect(paid.body).toMatchObject({ status: 'PAID' });
    expect(paid.body.attempts[0].status).toBe('SUCCEEDED');
    await call('get', learner, `/learn/${C2}`).expect(200);
    const mine = await call('get', learner, '/purchases/me').expect(200);
    expect(mine.body.items).toHaveLength(1);
    expect(mine.body.items[0]).toMatchObject({ status: 'PAID', priceVnd: 499_000, courseSlug: C2 });

    // 9. the money is in the admin's numbers (A4.11)
    const overview = await call('get', admin, '/admin/reports/overview').expect(200);
    expect(overview.body).toMatchObject({ revenueVnd: 499_000, paidPurchases: 1, pendingPaymentAttempts: 0 });
    expect(await courseRow(course.id)).toMatchObject({
      revenueVnd: 499_000,
      activeStudents: before.activeStudents + 1,
    });

    // 10. pressing it again is the provider's duplicate callback (A4.5)
    const again = await call('post', admin, `/dev/payments/${attempt.appTransId}/confirm`).expect(200);
    expect(again.body).toEqual({ status: 'ALREADY_PROCESSED' });
    expect(await prisma.enrollment.count({ where: { userId: buyer.id, courseId: course.id } })).toBe(1);

    // The learner learns a little, then asks the owner for the money back.
    await call('put', learner, `/lessons/${article.id}/progress`, {
      lastPositionSeconds: 0,
      completed: true,
    }).expect(200);
    const progressRows = await prisma.lessonProgress.count({ where: { userId: buyer.id } });
    expect(progressRows).toBe(1);

    // 11. the refund (A4.12): access ends, progress stays, the figures follow
    const refunded = await call('post', admin, `/admin/purchases/${first.body.purchaseId}/refund`, {
      reason: 'Học viên đổi ý trong thời hạn hoàn tiền',
    }).expect(200);
    expect(refunded.body.status).toBe('REFUNDED');
    expect(await prisma.lessonProgress.count({ where: { userId: buyer.id } })).toBe(progressRows);
    await call('get', learner, `/learn/${C2}`).expect(403);
    const after = await call('get', admin, '/admin/reports/overview').expect(200);
    expect(after.body).toMatchObject({ revenueVnd: 0, paidPurchases: 0 });
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'purchase.refunded' } });
    expect(audit.metadata).toMatchObject({ reason: 'Học viên đổi ý trong thời hạn hoàn tiền', amountVnd: 499_000 });

    // The door reopens: a refunded order does not block a new one.
    const reopened = await call('post', learner, `/checkout/${C2}`).expect(201);
    expect(reopened.body.purchaseId).not.toBe(first.body.purchaseId);
  });

  // A4.7: the price on the QR is the price charged, whatever the course costs later.
  it('books the price the QR was opened at, not the price at the time of payment', async () => {
    const { course, learner } = await throwawayScene(499_000);
    const opened = await call('post', learner, `/checkout/${course.slug}`).expect(201);
    await prisma.course.update({ where: { id: course.id }, data: { priceVnd: 999_000 } });
    const attempt = await attemptOf(opened.body.paymentAttemptId);

    await call('post', admin, `/dev/payments/${attempt.appTransId}/confirm`).expect(200);

    expect((await prisma.purchase.findUniqueOrThrow({ where: { id: opened.body.purchaseId } })).priceVnd).toBe(499_000);
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'purchase.paid', entityId: opened.body.purchaseId },
    });
    expect(audit.metadata).toMatchObject({ priceVnd: 499_000 });
    expect(await courseRow(course.id)).toMatchObject({ revenueVnd: 499_000 });
  });

  // N4.10: an old QR paid at the provider just before it lapsed, and a new QR paid too.
  it('flags the second payment of one order, and unlocks the course only once', async () => {
    const { course, learnerUser, learner } = await throwawayScene();
    const first = await call('post', learner, `/checkout/${course.slug}`).expect(201);
    // The first QR lapses on our side (reconcile would have closed it) …
    await prisma.paymentAttempt.update({
      where: { id: first.body.paymentAttemptId },
      data: { status: 'EXPIRED', expiresAt: new Date(Date.now() - 1_000) },
    });
    // … so the learner opens another.
    const second = await call('post', learner, `/checkout/${course.slug}`).expect(201);
    expect(second.body.purchaseId).toBe(first.body.purchaseId);
    expect(second.body.paymentAttemptId).not.toBe(first.body.paymentAttemptId);
    const [old, current] = await Promise.all([attemptOf(first.body.paymentAttemptId), attemptOf(second.body.paymentAttemptId)]);

    // The new QR is paid, then the provider reports the old one paid as well.
    const callback = (attempt: { appTransId: string }, zpTransId: string) =>
      request(app.getHttpServer())
        .post('/api/v1/payments/zalopay/callback')
        .send(demo.signCallback({ appTransId: attempt.appTransId, amountVnd: 690_000, zpTransId }));
    expect((await callback(current, 'zp-new')).body).toMatchObject({ return_code: 1 });
    expect((await callback(old, 'zp-old')).body).toMatchObject({ return_code: 1 });

    // Someone else paid once, normally: not a duplicate, so not on the list below.
    const bystander = await createUser(prisma, 'STUDENT');
    const bystanderOrder = await call('post', await signIn(app, bystander.email), `/checkout/${course.slug}`).expect(201);
    const bystanderAttempt = await attemptOf(bystanderOrder.body.paymentAttemptId);
    await call('post', admin, `/dev/payments/${bystanderAttempt.appTransId}/confirm`).expect(200);

    expect(await prisma.enrollment.count({ where: { userId: learnerUser.id, courseId: course.id } })).toBe(1);
    // The order was unlocked once: one grant, one "paid" entry, and the counter moved for two learners only.
    expect(await prisma.auditLog.count({ where: { action: 'purchase.paid', entityId: first.body.purchaseId } })).toBe(1);
    expect((await prisma.course.findUniqueOrThrow({ where: { id: course.id } })).enrollmentCount).toBe(2);
    const duplicate = await prisma.auditLog.findFirstOrThrow({ where: { action: 'payment.duplicate_paid' } });
    expect(duplicate.metadata).toMatchObject({
      appTransId: old.appTransId,
      purchaseId: first.body.purchaseId,
      firstAttemptId: current.id,
    });
    const listed = await call('get', admin, '/admin/payments?duplicatePaid=true').expect(200);
    expect(listed.body.items.map((row: { id: string }) => row.id)).toEqual([first.body.purchaseId]);
    expect(listed.body.items[0].attempts.filter((row: { status: string }) => row.status === 'SUCCEEDED')).toHaveLength(2);
  });
});
