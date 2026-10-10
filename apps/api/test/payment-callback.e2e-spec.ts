import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { CheckoutService } from '../src/checkout/checkout.service.js';
import { DemoZaloPayClient } from '../src/checkout/demo-zalopay.client.js';
import { zalopayMac } from '../src/checkout/zalopay-signature.js';
import { config } from '../src/config.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { bootApp, createOrder, truncateAll, warmPool } from './support.js';

const PRICE = 499_000;

/**
 * The provider's own door (API_CONTRACT.md §5.8, ZaloPay docs "callback"): it
 * answers HTTP 200 with a `return_code` whatever happened, because a 4xx only
 * makes the provider retry for nothing, and it is reachable without a session
 * or a CSRF token, which the provider cannot have.
 */
describe('POST /payments/{provider}/callback (e2e)', () => {
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

  const post = (body: unknown, provider = 'zalopay') =>
    request(app.getHttpServer()).post(`/api/v1/payments/${provider}/callback`).send(body as object);

  /** What the provider would send for `attempt`, signed with key2. */
  const signed = (attempt: { appTransId: string }, over: { amountVnd?: number; zpTransId?: string } = {}) =>
    demo.signCallback({
      appTransId: attempt.appTransId,
      amountVnd: over.amountVnd ?? PRICE,
      zpTransId: over.zpTransId ?? 'zp-cb-1',
    });

  const accepted = { return_code: 1, return_message: 'success' };

  it('pays the order and answers success, with no session and no CSRF token', async () => {
    const { user, course, purchase, attempt } = await createOrder(prisma, {});

    const response = await post({ ...signed(attempt), type: 1 }).expect(200);

    expect(response.body).toEqual(accepted);
    expect((await prisma.purchase.findUniqueOrThrow({ where: { id: purchase.id } })).status).toBe('PAID');
    expect(await prisma.enrollment.count({ where: { userId: user.id, courseId: course.id, status: 'ACTIVE' } })).toBe(1);
    expect(await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).toMatchObject({
      status: 'SUCCEEDED',
      providerTransId: 'zp-cb-1',
    });
  });

  // The provider retries up to three times, and may deliver twice on its own.
  it('answers a repeated callback with success and changes nothing more', async () => {
    const { attempt } = await createOrder(prisma, {});
    const callback = signed(attempt);
    await post(callback).expect(200);
    const audits = await prisma.auditLog.count();

    const again = await post(callback).expect(200);

    expect(again.body).toEqual(accepted);
    expect(await prisma.enrollment.count()).toBe(1);
    expect(await prisma.auditLog.count()).toBe(audits);
  });

  it('acts once when the provider delivers the same callback several times at once', async () => {
    const { attempt } = await createOrder(prisma, {});
    const callback = signed(attempt);
    await warmPool(prisma);

    const responses = await Promise.all([1, 2, 3, 4].map(() => post(callback)));

    for (const response of responses) expect(response.body).toEqual(accepted);
    expect(await prisma.enrollment.count()).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: 'purchase.paid' } })).toBe(1);
  });

  it('refuses a forged signature with -1, and grants nothing', async () => {
    const { purchase, attempt } = await createOrder(prisma, {});
    const forged = { ...signed(attempt), mac: '0'.repeat(64) };

    const response = await post(forged).expect(200);

    expect(response.body).toEqual({ return_code: -1, return_message: 'mac not equal' });
    expect((await prisma.purchase.findUniqueOrThrow({ where: { id: purchase.id } })).status).toBe('PENDING');
    expect(await prisma.enrollment.count()).toBe(0);
  });

  it('refuses data changed after it was signed', async () => {
    const { attempt } = await createOrder(prisma, {});
    const callback = signed(attempt);
    const tampered = { ...callback, data: callback.data.replace(String(PRICE), '1000') };

    const response = await post(tampered).expect(200);

    expect(response.body.return_code).toBe(-1);
    expect(await prisma.enrollment.count()).toBe(0);
  });

  it('refuses a correctly signed callback for a different amount, and records why', async () => {
    const { purchase, attempt } = await createOrder(prisma, {});

    const response = await post(signed(attempt, { amountVnd: 1_000 })).expect(200);

    expect(response.body).toEqual({ return_code: -1, return_message: 'amount mismatch' });
    expect((await prisma.purchase.findUniqueOrThrow({ where: { id: purchase.id } })).status).toBe('PENDING');
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'payment.callback_rejected' } });
    expect(audit.metadata).toMatchObject({ rejectReason: 'amount_mismatch' });
  });

  it('refuses an order it never issued', async () => {
    const response = await post(signed({ appTransId: '260930_deadbeef' })).expect(200);

    expect(response.body).toEqual({ return_code: -1, return_message: 'unknown order' });
  });

  it.each([
    ['CANCELLED', 'purchase_cancelled'],
    ['REFUNDED', 'purchase_refunded'],
  ] as const)(
    'takes note of money paid for a %s order and tells the provider to stop retrying',
    async (closed, reason) => {
      const { attempt } = await createOrder(prisma, { purchase: closed, attempt: 'EXPIRED' });

      const response = await post(signed(attempt)).expect(200);

      expect(response.body).toEqual(accepted);
      expect(await prisma.enrollment.count()).toBe(0);
      const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'payment.callback_rejected' } });
      expect(audit.metadata).toMatchObject({ rejectReason: reason });
    },
  );

  it.each([
    ['nothing at all', undefined],
    ['no data', { mac: 'x'.repeat(64) }],
    ['no mac', { data: '{}' }],
    ['data that is not a string', { data: { app_trans_id: 'x' }, mac: 'x'.repeat(64) }],
    ['an array', []],
  ])('answers -1 for a body with %s, still with HTTP 200', async (_label, body) => {
    const response = await post(body).expect(200);

    expect(response.body).toMatchObject({ return_code: -1 });
  });

  it('answers -1 for a signed body that is not an order payload', async () => {
    const data = JSON.stringify({ hello: 'world' });
    const bad = { data, mac: zalopayMac(config.zalopayKey2, data) };

    const response = await post(bad).expect(200);

    expect(response.body).toEqual({ return_code: -1, return_message: 'invalid data' });
  });

  // Signed by the provider does not mean well-formed: each of these must be
  // refused before it reaches the order, not turned into a payment of NaN.
  it.each([
    ['a string amount', { amount: '499000' }],
    ['a negative amount', { amount: -1 }],
    ['a zero amount', { amount: 0 }],
    ['a fractional amount', { amount: 1.5 }],
    ['no provider transaction id', { zp_trans_id: undefined }],
    ['a blank app_trans_id', { app_trans_id: '' }],
  ])('answers -1 for a signed payload with %s', async (_label, over) => {
    const { attempt } = await createOrder(prisma, {});
    const data = JSON.stringify({ ...JSON.parse(signed(attempt).data), ...over });

    const response = await post({ data, mac: zalopayMac(config.zalopayKey2, data) }).expect(200);

    expect(response.body).toEqual({ return_code: -1, return_message: 'invalid data' });
    expect(await prisma.enrollment.count()).toBe(0);
  });

  it('ignores callbacks about anything but orders (type 2 is a token agreement)', async () => {
    const { attempt } = await createOrder(prisma, {});

    const response = await post({ ...signed(attempt), type: 2 }).expect(200);

    expect(response.body.return_code).toBe(-1);
    expect(await prisma.enrollment.count()).toBe(0);
  });

  // A database blip is ours, not the provider's: ask it to try again.
  it('asks the provider to retry when the confirmation itself fails', async () => {
    const { attempt } = await createOrder(prisma, {});
    vi.spyOn(app.get(CheckoutService), 'confirmPayment').mockRejectedValueOnce(new Error('connection lost'));

    const response = await post(signed(attempt)).expect(200);

    expect(response.body).toEqual({ return_code: 0, return_message: 'retry' });
    expect(await prisma.enrollment.count()).toBe(0);

    // And the retry, which the provider now sends, is honoured.
    expect((await post(signed(attempt)).expect(200)).body).toEqual(accepted);
    expect(await prisma.enrollment.count()).toBe(1);
  });

  it('exists only for the provider it is configured for', async () => {
    const { attempt } = await createOrder(prisma, {});

    await post(signed(attempt), 'momo').expect(404);
    expect(await prisma.enrollment.count()).toBe(0);
  });
});

/**
 * API_CONTRACT.md §8, REVIEW F-30: the door counts only what fails to
 * authenticate, per client, and refuses the excess with 429 — the one answer
 * here that is not HTTP 200. A valid callback is never counted or refused:
 * turning a real payment away would lose money.
 */
describe('POST /payments/{provider}/callback, bad signatures (e2e)', () => {
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

  afterAll(async () => {
    await app.close();
  });

  const post = (body: unknown, ip = '198.51.100.30') =>
    request(app.getHttpServer())
      .post('/api/v1/payments/zalopay/callback')
      .set('X-Real-IP', ip)
      .send(body as object);

  const forged = { data: '{}', mac: 'f'.repeat(64) };
  const forge = async (times: number, ip?: string) => {
    for (let forgery = 0; forgery < times; forgery += 1) {
      expect((await post(forged, ip)).status).toBe(200);
    }
  };
  const valid = (attempt: { appTransId: string }) =>
    demo.signCallback({ appTransId: attempt.appTransId, amountVnd: PRICE, zpTransId: 'zp-cb-limit' });

  it('answers the 21st bad signature from one client in a minute with 429 and Retry-After', async () => {
    await forge(20);

    const response = await post(forged).expect(429);

    expect(response.headers['retry-after']).toMatch(/^[1-9]\d*$/);
    expect(response.body).toMatchObject({ statusCode: 429, code: 'RATE_LIMITED' });
  });

  it('counts a body with no signature at all the same way', async () => {
    for (let unsigned = 0; unsigned < 20; unsigned += 1) {
      expect((await post({}, '198.51.100.31')).status).toBe(200);
    }

    await post({}, '198.51.100.31').expect(429);
  });

  it('leaves every other client alone', async () => {
    await forge(20, '198.51.100.32');
    await post(forged, '198.51.100.32').expect(429);

    expect((await post(forged, '198.51.100.33')).status).toBe(200);
  });

  it('never refuses a valid callback, even from a client that is being refused', async () => {
    await forge(20, '198.51.100.34');
    await post(forged, '198.51.100.34').expect(429);
    const { attempt } = await createOrder(prisma, {});

    const response = await post(valid(attempt), '198.51.100.34').expect(200);

    expect(response.body).toEqual({ return_code: 1, return_message: 'success' });
    expect(await prisma.enrollment.count()).toBe(1);
  });

  it('does not count valid callbacks, however often the provider repeats one', async () => {
    const { attempt } = await createOrder(prisma, {});

    for (let repeat = 0; repeat < 30; repeat += 1) {
      expect((await post(valid(attempt), '198.51.100.35')).status).toBe(200);
    }
    // Nothing was counted against this client: it still gets its 20 bad ones.
    await forge(20, '198.51.100.35');
  });
});
