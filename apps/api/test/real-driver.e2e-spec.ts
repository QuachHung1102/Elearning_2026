import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { PrismaService } from '../src/prisma/prisma.service.js';

const KEY1 = 'real-key1-stub';
const KEY2 = 'real-key2-stub';
const CALLBACK_URL = 'https://shop.example.com/api/v1/payments/zalopay/callback';

/**
 * The whole application booted with `PAYMENT_DRIVER=zalopay`, on the real HTTP
 * client with `fetch` replaced by a fake provider (ROADMAP.md N4.4, A4.9 minus
 * the network). What a demo boot cannot show: the demo routes are gone, the
 * demo key is not accepted, and the provider is asked in its own dialect.
 *
 * The config is read once at import, so this file imports everything after it
 * has changed the environment, never before.
 */
describe('PAYMENT_DRIVER=zalopay (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let support: typeof import('./support.js');
  let signature: typeof import('../src/checkout/zalopay-signature.js');
  let providerCalls: { url: string; body: Record<string, unknown> }[];
  let queryAnswer: Record<string, unknown>;

  beforeAll(async () => {
    vi.resetModules();
    vi.stubEnv('PAYMENT_DRIVER', 'zalopay');
    vi.stubEnv('ZALOPAY_APP_ID', '2553');
    vi.stubEnv('ZALOPAY_KEY1', KEY1);
    vi.stubEnv('ZALOPAY_KEY2', KEY2);
    vi.stubEnv('ZALOPAY_CALLBACK_URL', CALLBACK_URL);
    vi.stubEnv('ZALOPAY_ENDPOINT', 'https://sb-openapi.zalopay.vn/v2');
    providerCalls = [];
    queryAnswer = { return_code: 3, return_message: 'processing' };
    // The client captures `fetch` when it is built, so this must come first.
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      providerCalls.push({ url, body });
      const answer = url.endsWith('/create')
        ? {
            return_code: 1,
            return_message: 'ok',
            zp_trans_token: 'token-real',
            order_url: 'https://gateway.example/pay/abc',
            qr_code: '00020101021226-real-qr',
          }
        : queryAnswer;
      return new Response(JSON.stringify(answer), { status: 200 });
    });

    support = await import('./support.js');
    signature = await import('../src/checkout/zalopay-signature.js');
    ({ app, prisma } = await support.bootApp());
  });

  beforeEach(async () => {
    providerCalls.length = 0;
    queryAnswer = { return_code: 3, return_message: 'processing' };
    await support.truncateAll(prisma);
  });

  afterAll(async () => {
    await app?.close();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  const callbackBody = (appTransId: string, key: string, amountVnd = 499_000) => {
    const data = JSON.stringify({
      app_id: 2553,
      app_trans_id: appTransId,
      app_time: Date.now(),
      amount: amountVnd,
      zp_trans_id: '250930000000042',
      embed_data: '{}',
      item: '[]',
    });
    return { data, mac: signature.zalopayMac(key, data), type: 1 };
  };

  it('serves the real client, and has no demo confirm route to pay an order with', async () => {
    const { ZALOPAY_CLIENT } = await import('../src/checkout/zalopay.client.js');
    const { ZaloPayHttpClient } = await import('../src/checkout/zalopay-http.client.js');
    expect(app.get(ZALOPAY_CLIENT)).toBeInstanceOf(ZaloPayHttpClient);

    const { attempt, purchase } = await support.createOrder(prisma, {});
    const adminUser = await support.createUser(prisma, 'ADMIN');
    const admin = await support.signIn(app, adminUser.email);

    await request(app.getHttpServer())
      .post(`/api/v1/dev/payments/${attempt.appTransId}/confirm`)
      .set(support.as(admin))
      .expect(404);

    // A 404 for an unknown order would look the same, so prove the order is untouched.
    expect((await prisma.purchase.findUniqueOrThrow({ where: { id: purchase.id } })).status).toBe('PENDING');
    expect((await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).status).toBe('PENDING');
  });

  it("opens a checkout through the provider: its QR, its dialect, our callback URL", async () => {
    const course = await support.createCourse(prisma);
    const learnerUser = await support.createUser(prisma, 'STUDENT');
    const learner = await support.signIn(app, learnerUser.email);

    const response = await request(app.getHttpServer())
      .post(`/api/v1/checkout/${course.slug}`)
      .set(support.as(learner))
      .expect(201);

    const attempt = await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: response.body.paymentAttemptId } });
    expect(response.body).toMatchObject({
      provider: 'ZALOPAY',
      qrCode: '00020101021226-real-qr',
      orderUrl: 'https://gateway.example/pay/abc',
      amountVnd: 499_000,
    });
    expect(attempt).toMatchObject({ provider: 'ZALOPAY', qrCode: '00020101021226-real-qr' });
    expect(providerCalls).toHaveLength(1);
    expect(providerCalls[0].url).toBe('https://sb-openapi.zalopay.vn/v2/create');
    expect(providerCalls[0].body).toMatchObject({
      app_id: 2553,
      app_user: learnerUser.id,
      app_trans_id: attempt.appTransId,
      amount: 499_000,
      callback_url: CALLBACK_URL,
      expire_duration_seconds: 900,
      item: '[]',
    });
    expect(providerCalls[0].body.mac).toMatch(/^[0-9a-f]{64}$/);
  });

  it('confirms a callback signed with the real key2, and refuses one signed with the demo key', async () => {
    const { user, course, attempt } = await support.createOrder(prisma, {});
    const post = (body: object) => request(app.getHttpServer()).post('/api/v1/payments/zalopay/callback').send(body);

    // The demo key is a known constant: it must open nothing here (P4-9).
    const withDemoKey = await post(callbackBody(attempt.appTransId, 'demo-zalopay-key2-not-a-secret')).expect(200);
    expect(withDemoKey.body).toEqual({ return_code: -1, return_message: 'mac not equal' });
    expect(await prisma.enrollment.count()).toBe(0);

    const genuine = await post(callbackBody(attempt.appTransId, KEY2)).expect(200);
    expect(genuine.body).toEqual({ return_code: 1, return_message: 'success' });
    expect(
      await prisma.enrollment.count({ where: { userId: user.id, courseId: course.id, status: 'ACTIVE' } }),
    ).toBe(1);
  });

  it('lets reconcile ask the real provider about a payment whose callback never came', async () => {
    const { ReconcileService } = await import('../src/checkout/reconcile.service.js');
    const { attempt, purchase } = await support.createOrder(prisma, { ageMinutes: 5 });
    queryAnswer = { return_code: 1, return_message: 'ok', zp_trans_id: 250930000000042, amount: 499000 };

    const summary = await app.get(ReconcileService).runOnce();

    expect(summary.confirmed).toBe(1);
    expect((await prisma.purchase.findUniqueOrThrow({ where: { id: purchase.id } })).status).toBe('PAID');
    expect(await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).toMatchObject({
      status: 'SUCCEEDED',
      providerTransId: '250930000000042',
    });
    expect(providerCalls).toHaveLength(1);
    expect(providerCalls[0].url).toBe('https://sb-openapi.zalopay.vn/v2/query');
    expect(providerCalls[0].body).toMatchObject({ app_id: 2553, app_trans_id: attempt.appTransId });
  });
});
