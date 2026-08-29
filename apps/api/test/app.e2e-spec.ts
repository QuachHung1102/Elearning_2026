import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

describe('App (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `auth-${randomUUID()}@example.com`;
  const password = 'correct horse battery staple';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
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
    const registration = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
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

    const setCookie = registration.headers['set-cookie'];
    expect(setCookie).toBeInstanceOf(Array);
    expect(setCookie[0]).toContain('elearning_session=');
    expect(setCookie[0]).toContain('HttpOnly');
    expect(setCookie[0]).toContain('SameSite=Lax');
    const cookie = setCookie[0].split(';')[0];

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password, displayName: 'Duplicate' })
      .expect(409);

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', cookie)
      .expect(200)
      .expect(({ body }) => {
        expect(body.user.email).toBe(email);
      });

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', cookie)
      .expect(204);

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', cookie)
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'wrong password' })
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: `  ${email.toUpperCase()}  `, password })
      .expect(200)
      .expect(({ body, headers }) => {
        expect(body.user.email).toBe(email);
        expect(headers['set-cookie'][0]).toContain('elearning_session=');
      });
  });

  it('rejects invalid registration input', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'not-an-email',
        password: 'short',
        displayName: '',
        role: 'ADMIN',
      })
      .expect(400);
  });
});
