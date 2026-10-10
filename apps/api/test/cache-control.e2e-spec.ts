import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import {
  as,
  bootApp,
  createUser,
  signIn,
  truncateAll,
  type Session,
} from './support.js';

/**
 * API_CONTRACT.md §2.3: anything that answers for one person must not be kept by
 * a cache that could hand it to another (REVIEW F-30).
 */
describe('Cache-Control on answers about a person (e2e)', () => {
  let app: NestExpressApplication;
  let learner: Session;
  let admin: Session;

  beforeAll(async () => {
    const booted = await bootApp();
    app = booted.app;
    await truncateAll(booted.prisma);
    learner = await signIn(app, (await createUser(booted.prisma, 'STUDENT')).email);
    admin = await signIn(app, (await createUser(booted.prisma, 'ADMIN')).email);
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    ['who is signed in', '/auth/me'],
    ['the signed-in devices', '/users/me/sessions'],
    ['my courses', '/enrollments/me'],
    ['my orders', '/purchases/me'],
  ])('is no-store for %s', async (_label, path) => {
    const response = await request(app.getHttpServer()).get(`/api/v1${path}`).set(as(learner));

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('is no-store for the admin area', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/admin/users').set(as(admin));

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
  });
});
