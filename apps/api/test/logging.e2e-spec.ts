import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { CourseService } from '../src/catalog/course.service.js';
import { CheckoutService } from '../src/checkout/checkout.service.js';
import { DemoZaloPayClient } from '../src/checkout/demo-zalopay.client.js';
import {
  PASSWORD,
  as,
  bootApp,
  cookieJar,
  createCourse,
  createUser,
  signIn,
  truncateAll,
} from './support.js';

/**
 * ROADMAP.md §9, A5.7: what the API says about what it did leads back to the
 * request the client saw (`X-Request-Id`), names the payment it concerns, and
 * never carries a password, a token or a cookie.
 */
describe('logging (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: Awaited<ReturnType<typeof bootApp>>['prisma'];
  let demo: DemoZaloPayClient;
  const written: string[] = [];

  beforeAll(async () => {
    ({ app, prisma } = await bootApp({ logRequests: true }));
    demo = app.get(DemoZaloPayClient);
  });

  beforeEach(async () => {
    await truncateAll(prisma);
    written.length = 0;
    const keep = (chunk: unknown) => {
      written.push(String(chunk));
      return true;
    };
    vi.spyOn(process.stdout, 'write').mockImplementation(keep);
    vi.spyOn(process.stderr, 'write').mockImplementation(keep);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  /** Every JSON line written so far. */
  const lines = () =>
    written
      .join('')
      .split('\n')
      .filter((line) => line.startsWith('{'))
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  const event = (evt: string) => lines().find((line) => line.evt === evt);

  it('logs a login with its request id and none of its secrets', async () => {
    const user = await createUser(prisma, 'STUDENT');
    const csrf = await request(app.getHttpServer()).get('/api/v1/auth/csrf');
    const cookies = cookieJar(csrf.headers['set-cookie']);
    const csrfToken = csrf.body.csrfToken as string;

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login?next=/secret-place')
      .set('X-Real-IP', '198.51.100.60')
      .set('Cookie', cookies.join('; '))
      .set('X-CSRF-Token', csrfToken)
      .send({ email: user.email, password: PASSWORD })
      .expect(200);
    const sessionJwt = cookieJar(login.headers['set-cookie'])
      .find((cookie) => cookie.startsWith('elearning_session='))!
      .split('=')[1];
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', [...cookies, `elearning_session=${sessionJwt}`].join('; '))
      .expect(200);

    const loginLine = lines().find((line) => line.evt === 'http' && line.path === '/api/v1/auth/login');
    expect(loginLine).toMatchObject({
      level: 'info',
      requestId: login.headers['x-request-id'],
      method: 'POST',
      status: 200,
    });
    const meLine = lines().find((line) => line.evt === 'http' && line.path === '/api/v1/auth/me');
    expect(meLine).toMatchObject({ status: 200, userId: user.id });

    const everything = written.join('');
    const { passwordHash } = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, omit: { passwordHash: false } });
    for (const secret of [PASSWORD, sessionJwt, csrfToken, passwordHash, '/secret-place', user.email]) {
      expect(everything).not.toContain(secret);
    }
  });

  it('logs an internal error where its request id leads to the cause', async () => {
    vi.spyOn(app.get(CourseService), 'listCourses').mockRejectedValueOnce(new Error('the database is on fire'));

    const response = await request(app.getHttpServer()).get('/api/v1/courses').expect(500);

    expect(response.body.requestId).toBe(response.headers['x-request-id']);
    expect(event('http.error')).toMatchObject({
      level: 'error',
      requestId: response.body.requestId,
      message: expect.stringContaining('GET /api/v1/courses -> 500'),
      stack: expect.stringContaining('the database is on fire'),
    });
    expect(response.text).not.toContain('on fire');
  });

  it('names the purchase and the transaction of a checkout and of its payment', async () => {
    const course = await createCourse(prisma, { priceVnd: 499_000 });
    const learner = await createUser(prisma, 'STUDENT');
    const session = await signIn(app, learner.email);

    const checkout = await request(app.getHttpServer()).post(`/api/v1/checkout/${course.slug}`).set(as(session)).expect(201);
    const attempt = await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: checkout.body.paymentAttemptId } });
    expect(event('checkout.created')).toMatchObject({
      requestId: checkout.headers['x-request-id'],
      purchaseId: checkout.body.purchaseId,
      appTransId: attempt.appTransId,
    });

    const callback = await request(app.getHttpServer())
      .post('/api/v1/payments/zalopay/callback')
      .send(demo.signCallback({ appTransId: attempt.appTransId, amountVnd: 499_000, zpTransId: 'zp-log-1' }))
      .expect(200);
    expect(event('payment.confirmed')).toMatchObject({
      requestId: callback.headers['x-request-id'],
      status: 'PAID',
      purchaseId: checkout.body.purchaseId,
      appTransId: attempt.appTransId,
    });
    expect(written.join('')).not.toContain(demo.signCallback({ appTransId: attempt.appTransId, amountVnd: 499_000, zpTransId: 'zp-log-1' }).mac);
  });

  it('gives a failure deep inside a callback the id of the request that caused it', async () => {
    const course = await createCourse(prisma);
    const learner = await createUser(prisma, 'STUDENT');
    const session = await signIn(app, learner.email);
    const checkout = await request(app.getHttpServer()).post(`/api/v1/checkout/${course.slug}`).set(as(session)).expect(201);
    const attempt = await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: checkout.body.paymentAttemptId } });
    vi.spyOn(app.get(CheckoutService), 'confirmPayment').mockRejectedValueOnce(new Error('connection lost'));

    const callback = await request(app.getHttpServer())
      .post('/api/v1/payments/zalopay/callback')
      .send(demo.signCallback({ appTransId: attempt.appTransId, amountVnd: course.priceVnd, zpTransId: 'zp-log-2' }))
      .expect(200);

    expect(event('payment.callback_failed')).toMatchObject({
      level: 'error',
      requestId: callback.headers['x-request-id'],
      appTransId: attempt.appTransId,
    });
  });
});
