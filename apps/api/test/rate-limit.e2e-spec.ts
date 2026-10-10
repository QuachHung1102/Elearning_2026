import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { config } from '../src/config.js';
import {
  as,
  bootApp,
  cookieJar,
  createCourse,
  createUser,
  signIn,
  truncateAll,
} from './support.js';

/**
 * API_CONTRACT.md §8 and ROADMAP.md §9 (A5.6, A5.9): past the limit a client gets
 * `429 RATE_LIMITED` with `Retry-After`. Every case here uses its own client IP
 * (`X-Real-IP` is trusted under TRUST_X_REAL_IP, which .env.test sets).
 */
describe('rate limits (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: Awaited<ReturnType<typeof bootApp>>['prisma'];

  beforeAll(async () => {
    ({ app, prisma } = await bootApp());
    await truncateAll(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  const refused = (response: request.Response) => {
    expect(response.status).toBe(429);
    expect(response.headers['retry-after']).toMatch(/^[1-9]\d*$/);
    expect(response.body).toMatchObject({ statusCode: 429, code: 'RATE_LIMITED' });
    // A refusal must not be kept and handed to the next client by a cache.
    expect(response.headers['cache-control'] ?? '').not.toContain('public');
  };

  // A5.6
  it('answers the eleventh login from one client in a minute with 429', async () => {
    const csrf = await request(app.getHttpServer()).get('/api/v1/auth/csrf').set('X-Real-IP', '198.51.100.1');
    const cookie = cookieJar(csrf.headers['set-cookie']).join('; ');
    const login = (ip: string, email = 'nobody@example.com') =>
      request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('X-Real-IP', ip)
        .set('Cookie', cookie)
        .set('X-CSRF-Token', csrf.body.csrfToken)
        .send({ email, password: 'wrong password' });

    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect((await login('198.51.100.1')).status).toBe(401);
    }
    refused(await login('198.51.100.1'));
    // Another client asking about another account: the limit is per client here (per account is login-hardening's).
    expect((await login('198.51.100.2', 'someone-else@example.com')).status).toBe(401);
  });

  // A5.9
  it('answers the sixth checkout of one learner in five minutes with 429', async () => {
    const course = await createCourse(prisma, { priceVnd: 499_000 });
    const user = await createUser(prisma, 'STUDENT');
    const session = await signIn(app, user.email);
    const checkout = () =>
      request(app.getHttpServer()).post(`/api/v1/checkout/${course.slug}`).set(as(session));

    expect((await checkout()).status).toBe(201);
    for (let repeat = 0; repeat < 4; repeat += 1) {
      expect((await checkout()).status).toBe(200);
    }
    refused(await checkout());
  });

  describe('the public catalog (REVIEW F-30)', () => {
    const read = (path: string, ip: string) =>
      request(app.getHttpServer()).get(`/api/v1${path}`).set('X-Real-IP', ip);

    it('lets one client read the list 120 times a minute, then refuses it', async () => {
      for (let read_ = 0; read_ < 120; read_ += 1) {
        expect((await read('/courses', '198.51.100.10')).status).toBe(200);
      }
      refused(await read('/courses', '198.51.100.10'));
      expect((await read('/courses', '198.51.100.11')).status).toBe(200);
    });

    it('does the same for one course page', async () => {
      const course = await createCourse(prisma);
      for (let read_ = 0; read_ < 120; read_ += 1) {
        expect((await read(`/courses/${course.slug}`, '198.51.100.20')).status).toBe(200);
      }
      refused(await read(`/courses/${course.slug}`, '198.51.100.20'));
      expect((await read(`/courses/${course.slug}`, '198.51.100.21')).status).toBe(200);
    });
  });

  // T4.17: the Next server fetches for every visitor from one address; it names
  // the visitor, and only its secret makes that name count. No X-Real-IP here,
  // so anything untrusted falls back to the socket (one shared bucket).
  describe('a visitor IP forwarded by the web server', () => {
    const forwarded = (ip: string, secret?: string) => {
      const call = request(app.getHttpServer()).get('/api/v1/courses').set('X-Visitor-Ip', ip);
      return secret === undefined ? call : call.set('X-Internal-Api-Secret', secret);
    };
    const listed = (response: request.Response) => expect(response.status).toBe(200);

    it('gives each visitor its own bucket when the secret matches', async () => {
      for (let read_ = 0; read_ < 120; read_ += 1) {
        listed(await forwarded('203.0.113.50', config.internalApiSecret));
      }
      refused(await forwarded('203.0.113.50', config.internalApiSecret));
      listed(await forwarded('203.0.113.51', config.internalApiSecret));
    });

    it('ignores the visitor IP without the secret or with a wrong one', async () => {
      for (let read_ = 0; read_ < 120; read_ += 1) {
        listed(await forwarded(`198.18.0.${read_}`));
      }
      refused(await forwarded('198.18.1.1'));
      refused(await forwarded('198.18.1.2', `${config.internalApiSecret}x`));
    });
  });
});
