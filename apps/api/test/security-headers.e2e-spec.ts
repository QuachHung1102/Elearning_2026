import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { bootApp } from './support.js';

/**
 * ROADMAP.md §9, A5.1: every response carries the headers, whatever produced
 * it: a route, the exception filter, a guard, Nest's own 404.
 */
const EXPECTED = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
};

describe('security headers (e2e)', () => {
  let app: NestExpressApplication;
  let hstsApp: NestExpressApplication;

  beforeAll(async () => {
    ({ app } = await bootApp());
    ({ app: hstsApp } = await bootApp({ hsts: true }));
  });

  afterAll(async () => {
    await app.close();
    await hstsApp.close();
  });

  it.each([
    ['a route that answers', 'get', '/api/v1/health', 200],
    ['a public list', 'get', '/api/v1/courses', 200],
    ['Nest answering a path nobody registered', 'get', '/api/v1/nope', 404],
    ['a guard refusing a guest', 'get', '/api/v1/auth/me', 401],
    ['the CSRF guard refusing a write', 'post', '/api/v1/auth/login', 403],
    ['the admin area hiding itself from a guest', 'get', '/api/v1/admin/courses', 404],
    ['the file host refusing an unsigned request', 'get', '/api/v1/media/local/covers/x.png', 403],
  ] as const)('is on %s', async (_label, method, path, status) => {
    const response = await request(app.getHttpServer())[method](path);

    expect(response.status).toBe(status);
    expect(response.headers).toMatchObject(EXPECTED);
    // Nobody needs to be told which framework answers.
    expect(response.headers).not.toHaveProperty('x-powered-by');
  });

  it('does not pin the browser to HTTPS outside production', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health');

    expect(response.headers).not.toHaveProperty('strict-transport-security');
  });

  it('pins it when the app is configured for production', async () => {
    const response = await request(hstsApp.getHttpServer()).get('/api/v1/health');

    expect(response.headers['strict-transport-security']).toBe('max-age=31536000');
  });
});
