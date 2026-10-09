import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DemoZaloPayClient } from '../src/checkout/demo-zalopay.client.js';
import { config } from '../src/config.js';
import { MAILER, type Mailer } from '../src/mail/mailer.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { as, bootApp, createCourse, createUser, signIn, truncateAll, type Session } from './support.js';

/**
 * The demo "the customer paid" button (DEMO_MODE.md §5, "Endpoint confirm dev"):
 * it does not grant anything itself, it feeds a correctly signed callback to
 * the same `confirmPayment` a real callback uses, and mails the receipt.
 */
describe('POST /dev/payments/{appTransId}/confirm (e2e)', () => {
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

  const confirm = (session: Session | null, appTransId: string) => {
    const call = request(app.getHttpServer()).post(`/api/v1/dev/payments/${appTransId}/confirm`);
    return session ? call.set(as(session)) : call;
  };

  async function admin() {
    const user = await createUser(prisma, 'ADMIN');
    return signIn(app, user.email);
  }

  /** A learner who has opened checkout, exactly as the web page does. */
  async function shopper() {
    const course = await createCourse(prisma);
    const user = await createUser(prisma, 'STUDENT');
    const session = await signIn(app, user.email);
    const opened = await request(app.getHttpServer())
      .post(`/api/v1/checkout/${course.slug}`)
      .set(as(session))
      .expect(201);
    const attempt = await prisma.paymentAttempt.findUniqueOrThrow({
      where: { id: opened.body.paymentAttemptId },
    });
    return { course, user, session, purchaseId: opened.body.purchaseId as string, attempt };
  }

  const mailDirectory = () => resolve(config.localMailDir);
  const inbox = async () => {
    try {
      return new Set(await readdir(mailDirectory()));
    } catch {
      return new Set<string>();
    }
  };
  /** The `.eml` files that appeared after `before`, as raw text. */
  const mailsSince = async (before: Set<string>) =>
    Promise.all(
      [...(await inbox())]
        .filter((name) => !before.has(name))
        .map((name) => readFile(resolve(mailDirectory(), name), 'utf8')),
    );

  it('pays the order through the real confirmation, unlocks the course and mails the receipt', async () => {
    const { course, user, session, purchaseId, attempt } = await shopper();
    const staff = await admin();
    await request(app.getHttpServer()).get(`/api/v1/learn/${course.slug}`).set(as(session)).expect(403);
    const before = await inbox();

    const response = await confirm(staff, attempt.appTransId).expect(200);

    expect(response.body).toEqual({ status: 'PAID' });
    expect(await prisma.purchase.findUniqueOrThrow({ where: { id: purchaseId } })).toMatchObject({ status: 'PAID' });
    expect(await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).toMatchObject({
      status: 'SUCCEEDED',
      providerTransId: expect.stringMatching(/^demo-/),
    });
    expect(
      await prisma.enrollment.findUniqueOrThrow({
        where: { userId_courseId: { userId: user.id, courseId: course.id } },
      }),
    ).toMatchObject({ status: 'ACTIVE', source: 'PURCHASE', purchaseId });
    await request(app.getHttpServer()).get(`/api/v1/learn/${course.slug}`).set(as(session)).expect(200);

    const [mail, ...rest] = await mailsSince(before);
    expect(rest).toEqual([]);
    expect(mail).toContain(`To: ${user.email}`);
    expect(mail).toContain('X-Elearning-Tag: purchase-receipt');
    expect(mail).toContain('Subject: Đơn hàng Khóa có thể mua đã thanh toán');
    expect(mail).toContain(`${config.webOrigin}/account/orders/${purchaseId}`);
  });

  it('answers a second press with success, one enrollment and one receipt', async () => {
    const { attempt } = await shopper();
    const staff = await admin();
    await confirm(staff, attempt.appTransId).expect(200);
    const before = await inbox();

    const again = await confirm(staff, attempt.appTransId).expect(200);

    expect(again.body).toEqual({ status: 'ALREADY_PROCESSED' });
    expect(await prisma.enrollment.count()).toBe(1);
    expect(await mailsSince(before)).toEqual([]);
  });

  // The provider's memory is the API process. After a restart its Map is empty,
  // yet the order in the database can still be paid: the amount and expiry come
  // from the attempt row, not from the Map.
  it('still works for an order the provider has no memory of', async () => {
    const { attempt } = await shopper();
    const staff = await admin();
    const orphan = await prisma.paymentAttempt.create({
      data: {
        purchaseId: attempt.purchaseId,
        appTransId: `260930_${randomUUID().slice(0, 8)}`,
        amountVnd: attempt.amountVnd,
        expiresAt: new Date(Date.now() + 600_000),
      },
    });

    const response = await confirm(staff, orphan.appTransId).expect(200);

    expect(response.body).toEqual({ status: 'PAID' });
  });

  it('refuses an expired QR the way the provider would, and changes nothing', async () => {
    const { purchaseId, attempt } = await shopper();
    const staff = await admin();
    await prisma.paymentAttempt.update({
      where: { id: attempt.id },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });

    const response = await confirm(staff, attempt.appTransId).expect(409);

    expect(response.body.code).toBe('PAYMENT_EXPIRED');
    expect((await prisma.purchase.findUniqueOrThrow({ where: { id: purchaseId } })).status).toBe('PENDING');
    expect(await prisma.enrollment.count()).toBe(0);
  });

  it('answers 409 with the reason when the confirmation is rejected', async () => {
    const { attempt } = await shopper();
    const staff = await admin();
    await prisma.paymentAttempt.update({ where: { id: attempt.id }, data: { status: 'FAILED' } });

    const response = await confirm(staff, attempt.appTransId).expect(409);

    expect(response.body.message).toContain('attempt_closed');
    expect(await prisma.enrollment.count()).toBe(0);
  });

  it('answers 404 for an unknown order', async () => {
    const staff = await admin();

    await confirm(staff, '260930_00000000').expect(404);
  });

  // The demo checkout page's "Thanh toán" button: the buyer pays their own order.
  it('lets the buyer confirm their own order', async () => {
    const { course, user, session, purchaseId, attempt } = await shopper();

    const response = await confirm(session, attempt.appTransId).expect(200);

    expect(response.body).toEqual({ status: 'PAID' });
    expect(
      await prisma.enrollment.findUniqueOrThrow({
        where: { userId_courseId: { userId: user.id, courseId: course.id } },
      }),
    ).toMatchObject({ status: 'ACTIVE', source: 'PURCHASE', purchaseId });
  });

  // Changed on purpose: the buyer may now confirm (above). Anyone else signed in
  // gets the unknown-order 404, so another learner's ids reveal nothing.
  it('is invisible to a signed-in user who neither bought the order nor is an admin', async () => {
    const { attempt } = await shopper();
    const otherStudent = await createUser(prisma, 'STUDENT');
    const instructor = await createUser(prisma, 'INSTRUCTOR');

    await confirm(await signIn(app, otherStudent.email), attempt.appTransId).expect(404);
    await confirm(await signIn(app, instructor.email), attempt.appTransId).expect(404);
    expect(await prisma.enrollment.count()).toBe(0);
    expect((await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).status).toBe('PENDING');
  });

  // Without a CSRF token the global guard already answers 404 under /dev (as it
  // always did); with one, the missing session is a plain 401.
  it('needs a session', async () => {
    const { attempt } = await shopper();
    const csrf = await request(app.getHttpServer()).get('/api/v1/auth/csrf').expect(200);

    await confirm(null, attempt.appTransId).expect(404);
    await confirm(null, attempt.appTransId)
      .set('Cookie', csrf.headers['set-cookie'])
      .set('X-CSRF-Token', csrf.body.csrfToken)
      .expect(401);
    expect(await prisma.enrollment.count()).toBe(0);
  });

  // The button is only as honest as the path it takes: a callback whose MAC does
  // not verify must stop it, exactly as it stops the real callback route.
  it('grants nothing when the callback it built does not verify', async () => {
    const { purchaseId, attempt } = await shopper();
    const staff = await admin();
    const demo = app.get(DemoZaloPayClient);
    const signed = demo.signCallback({ appTransId: attempt.appTransId, amountVnd: attempt.amountVnd, zpTransId: 'demo-x' });
    vi.spyOn(demo, 'signCallback').mockReturnValueOnce({ ...signed, mac: '0'.repeat(64) });

    const response = await confirm(staff, attempt.appTransId).expect(400);

    expect(response.body.code).toBe('SIGNATURE_INVALID');
    expect((await prisma.purchase.findUniqueOrThrow({ where: { id: purchaseId } })).status).toBe('PENDING');
    expect(await prisma.enrollment.count()).toBe(0);
  });

  // A mail server outage must not turn a collected payment into an error.
  it('keeps the payment when the receipt cannot be sent', async () => {
    const { purchaseId, attempt } = await shopper();
    const staff = await admin();
    vi.spyOn(app.get<Mailer>(MAILER), 'send').mockRejectedValueOnce(new Error('smtp down'));

    await confirm(staff, attempt.appTransId).expect(200);

    expect((await prisma.purchase.findUniqueOrThrow({ where: { id: purchaseId } })).status).toBe('PAID');
    expect(await prisma.enrollment.count()).toBe(1);
  });
});
