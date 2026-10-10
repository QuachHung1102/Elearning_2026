import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Phase 1 API (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  const email = `auth-${randomUUID()}@example.com`;
  const resetEmail = `reset-${randomUUID()}@example.com`;
  const password = 'correct horse battery staple';
  const newPassword = 'new correct horse battery staple';

  function setCookies(value: string | string[] | undefined): string[] {
    if (!value) throw new Error('Missing Set-Cookie header');
    return Array.isArray(value) ? value : [value];
  }

  function cookieFrom(headers: string[], name: string): string {
    const cookie = headers.find((value) => value.startsWith(`${name}=`));
    if (!cookie) throw new Error(`Missing ${name} cookie`);
    return cookie.split(';')[0];
  }

  function cookieValue(cookie: string): string {
    return cookie.slice(cookie.indexOf('=') + 1);
  }

  function csrfHeaders(
    csrf: { cookie: string; token: string },
    ...cookies: string[]
  ): Record<string, string> {
    return {
      Cookie: [...cookies, csrf.cookie].join('; '),
      'X-CSRF-Token': csrf.token,
    };
  }

  async function fetchCsrf() {
    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/csrf')
      .expect(200);
    const headers = setCookies(response.headers['set-cookie']);
    const cookie = cookieFrom(headers, 'elearning_csrf');
    expect(response.body.csrfToken).toBe(cookieValue(cookie));
    return { cookie, token: response.body.csrfToken as string };
  }

  async function captureMail<T>(
    tag: string,
    action: () => Promise<T>,
  ): Promise<{ result: T; token?: string }> {
    const lines: string[] = [];
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(((
      chunk: unknown,
    ) => {
      lines.push(String(chunk));
      return true;
    }) as typeof process.stdout.write);
    try {
      const result = await action();
      const message = lines
        .flatMap((line) => line.trim().split('\n'))
        .map((line) => {
          try {
            return JSON.parse(line) as { tag?: string; link?: string };
          } catch {
            return {};
          }
        })
        .find((entry) => entry.tag === tag);
      const token = message?.link
        ? (new URL(message.link).searchParams.get('token') ?? undefined)
        : undefined;
      return { result, token };
    } finally {
      spy.mockRestore();
    }
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
    `;
    if (tables.length === 0) return;
    const names = tables
      .map(({ tablename }) => `"${tablename.replaceAll('"', '""')}"`)
      .join(', ');
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`,
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves health and normalizes unknown routes', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect('X-Request-Id', /^[A-Za-z0-9-]{8,64}$/)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          status: 'ok',
          database: 'up',
          uptimeSeconds: expect.any(Number),
        });
      });

    await request(app.getHttpServer())
      .get('/api/v1/missing')
      .expect(404)
      .expect(({ body }) => {
        expect(body).toEqual({
          statusCode: 404,
          code: 'NOT_FOUND',
          message: 'Not Found',
          error: 'Not Found',
        });
      });
  });

  it('verifies email and manages profile, sessions, and password', async () => {
    const initialCsrf = await fetchCsrf();
    const registrationMail = await captureMail('verify-email', () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .set(csrfHeaders(initialCsrf))
        .send({
          email: email.toUpperCase(),
          password,
          displayName: 'Test Student',
        })
        .expect(201),
    );
    expect(registrationMail.token).toBeTruthy();

    const registrationCookies = setCookies(
      registrationMail.result.headers['set-cookie'],
    );
    const firstAuth = cookieFrom(registrationCookies, 'elearning_session');
    const firstCsrfCookie = cookieFrom(registrationCookies, 'elearning_csrf');
    const firstCsrf = {
      cookie: firstCsrfCookie,
      token: cookieValue(firstCsrfCookie),
    };

    await request(app.getHttpServer())
      .post('/api/v1/auth/verify-email/confirm')
      .set(csrfHeaders(firstCsrf))
      .send({ token: registrationMail.token })
      .expect(204);
    await request(app.getHttpServer())
      .post('/api/v1/auth/verify-email/confirm')
      .set(csrfHeaders(firstCsrf))
      .send({ token: registrationMail.token })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('TOKEN_INVALID'));

    await request(app.getHttpServer())
      .patch('/api/v1/users/me')
      .set(csrfHeaders(firstCsrf, firstAuth))
      .send({ displayName: 'Tên mới' })
      .expect(200)
      .expect(({ body }) => {
        expect(body.user.displayName).toBe('Tên mới');
        expect(body.user.emailVerifiedAt).not.toBeNull();
      });

    const secondCsrf = await fetchCsrf();
    const secondLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set(csrfHeaders(secondCsrf))
      .send({ email, password })
      .expect(200);
    const secondCookies = setCookies(secondLogin.headers['set-cookie']);
    const secondAuth = cookieFrom(secondCookies, 'elearning_session');
    const secondCsrfCookie = cookieFrom(secondCookies, 'elearning_csrf');
    const rotatedSecondCsrf = {
      cookie: secondCsrfCookie,
      token: cookieValue(secondCsrfCookie),
    };

    const sessions = await request(app.getHttpServer())
      .get('/api/v1/users/me/sessions')
      .set('Cookie', secondAuth)
      .expect(200);
    expect(sessions.body.items).toHaveLength(2);
    const other = sessions.body.items.find(
      (session: { isCurrent: boolean }) => !session.isCurrent,
    );
    await request(app.getHttpServer())
      .delete(`/api/v1/users/me/sessions/${other.id}`)
      .set(csrfHeaders(rotatedSecondCsrf, secondAuth))
      .expect(204);
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', firstAuth)
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/v1/users/me/password')
      .set(csrfHeaders(rotatedSecondCsrf, secondAuth))
      .send({ currentPassword: password, newPassword })
      .expect(204);
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', secondAuth)
      .expect(401);

    const loginCsrf = await fetchCsrf();
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set(csrfHeaders(loginCsrf))
      .send({ email, password })
      .expect(401);
    const newLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set(csrfHeaders(loginCsrf))
      .send({ email, password: newPassword })
      .expect(200);
    const studentAuth = cookieFrom(
      setCookies(newLogin.headers['set-cookie']),
      'elearning_session',
    );

    const hidden = await request(app.getHttpServer())
      .get('/api/v1/dev/mail')
      .set('Cookie', studentAuth)
      .expect(404);
    const missing = await request(app.getHttpServer())
      .get('/api/v1/dev/not-real')
      .expect(404);
    expect(hidden.body).toEqual(missing.body);
  });

  it('resets a password without revealing account existence', async () => {
    const csrf = await fetchCsrf();
    const registration = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set(csrfHeaders(csrf))
      .send({ email: resetEmail, password, displayName: 'Reset Student' })
      .expect(201);
    const oldAuth = cookieFrom(
      setCookies(registration.headers['set-cookie']),
      'elearning_session',
    );

    const resetCsrf = await fetchCsrf();
    const resetMail = await captureMail('reset-password', () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/password/forgot')
        .set(csrfHeaders(resetCsrf))
        .send({ email: resetEmail })
        .expect(202),
    );
    expect(resetMail.token).toBeTruthy();
    await request(app.getHttpServer())
      .post('/api/v1/auth/password/forgot')
      .set(csrfHeaders(resetCsrf))
      .send({ email: `missing-${resetEmail}` })
      .expect(202);

    await request(app.getHttpServer())
      .post('/api/v1/auth/password/reset')
      .set(csrfHeaders(resetCsrf))
      .send({ token: resetMail.token, password: newPassword })
      .expect(204);
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', oldAuth)
      .expect(401);
  });

  it('accepts contact messages and requires CSRF for mutations', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/contact')
      .send({ name: 'Người học', email, message: 'Tôi cần tư vấn khóa học.' })
      .expect(403)
      .expect(({ body }) => expect(body.code).toBe('CSRF_INVALID'));

    const csrf = await fetchCsrf();
    const mail = await captureMail('contact', () =>
      request(app.getHttpServer())
        .post('/api/v1/contact')
        .set(csrfHeaders(csrf))
        .send({
          name: 'Người học',
          email,
          message: 'Tôi cần tư vấn khóa học.',
          courseSlug: 'lap-trinh-web',
        })
        .expect(202),
    );
    expect(mail.token).toBeUndefined();
  });

  it('rate-limits each forwarded client IP independently', async () => {
    const csrf = await fetchCsrf();
    const invalidLogin = { email: 'invalid', password: 'short' };
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set(csrfHeaders(csrf))
        .set('X-Real-IP', '203.0.113.10')
        .send(invalidLogin)
        .expect(400);
    }
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set(csrfHeaders(csrf))
      .set('X-Real-IP', '203.0.113.10')
      .send(invalidLogin)
      .expect('Retry-After', /\d+/)
      .expect(429);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set(csrfHeaders(csrf))
      .set('X-Real-IP', '203.0.113.11')
      .send(invalidLogin)
      .expect(400);
  });
});
