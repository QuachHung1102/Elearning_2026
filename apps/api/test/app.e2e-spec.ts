import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

describe('App (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  const email = `auth-${randomUUID()}@example.com`;
  const password = 'correct horse battery staple';

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

  async function fetchCsrf() {
    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/csrf')
      .expect(200);
    const headers = setCookies(response.headers['set-cookie']);
    const cookie = cookieFrom(headers, 'elearning_csrf');

    expect(response.body.csrfToken).toBe(cookieValue(cookie));
    expect(headers[0]).toContain('SameSite=Lax');
    return { cookie, token: response.body.csrfToken as string };
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('serves the API root', () => {
    return request(app.getHttpServer())
      .get('/api/v1')
      .expect(200)
      .expect('Hello World!');
  });

  it('registers, authenticates, revokes, and logs a user back in', async () => {
    const initialCsrf = await fetchCsrf();
    const registration = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Cookie', initialCsrf.cookie)
      .set('X-CSRF-Token', initialCsrf.token)
      .send({
        email: email.toUpperCase(),
        password,
        displayName: 'Test Student',
      })
      .expect(201);

    expect(registration.body).toEqual({
      user: expect.objectContaining({
        email,
        displayName: 'Test Student',
        role: 'STUDENT',
      }),
    });
    expect(registration.body.user).not.toHaveProperty('passwordHash');

    const setCookie = setCookies(registration.headers['set-cookie']);
    const authCookie = cookieFrom(setCookie, 'elearning_session');
    const csrfCookie = cookieFrom(setCookie, 'elearning_csrf');
    const csrfToken = cookieValue(csrfCookie);
    const authSetCookie = setCookie.find((value) =>
      value.startsWith('elearning_session='),
    );
    expect(authSetCookie).toContain('HttpOnly');
    expect(authSetCookie).toContain('SameSite=Lax');

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Cookie', csrfCookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ email, password, displayName: 'Duplicate' })
      .expect(409);

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', authCookie)
      .expect(200)
      .expect(({ body }) => {
        expect(body.user.email).toBe(email);
      });

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', [authCookie, csrfCookie])
      .set('X-CSRF-Token', csrfToken)
      .expect(204);

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', authCookie)
      .expect(401);

    const loginCsrf = await fetchCsrf();
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', loginCsrf.cookie)
      .set('X-CSRF-Token', loginCsrf.token)
      .send({ email, password: 'wrong password' })
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', loginCsrf.cookie)
      .set('X-CSRF-Token', loginCsrf.token)
      .send({ email: `  ${email.toUpperCase()}  `, password })
      .expect(200)
      .expect(({ body, headers }) => {
        expect(body.user.email).toBe(email);
        expect(headers['set-cookie'][0]).toContain('elearning_session=');
      });
  });

  it('requires CSRF and rejects invalid registration input', async () => {
    const invalidInput = {
      email: 'not-an-email',
      password: 'short',
      displayName: '',
      role: 'ADMIN',
    };

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(invalidInput)
      .expect(403);

    const csrf = await fetchCsrf();
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Cookie', csrf.cookie)
      .set('X-CSRF-Token', csrf.token)
      .send(invalidInput)
      .expect(400);
  });

  it('rate-limits each forwarded client IP independently', async () => {
    const csrf = await fetchCsrf();
    const invalidLogin = { email: 'invalid', password: 'short' };

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('Cookie', csrf.cookie)
        .set('X-CSRF-Token', csrf.token)
        .set('X-Forwarded-For', '203.0.113.10')
        .send(invalidLogin)
        .expect(400);
    }

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', csrf.cookie)
      .set('X-CSRF-Token', csrf.token)
      .set('X-Forwarded-For', '203.0.113.10')
      .send(invalidLogin)
      .expect('Retry-After', /\d+/)
      .expect(429);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', csrf.cookie)
      .set('X-CSRF-Token', csrf.token)
      .set('X-Forwarded-For', '203.0.113.11')
      .send(invalidLogin)
      .expect(400);
  });
});
