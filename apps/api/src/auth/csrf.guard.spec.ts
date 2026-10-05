import {
  HttpException,
  NotFoundException,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CsrfGuard } from './csrf.guard.js';

const contextFor = (method: string, path: string) =>
  ({
    getHandler: () => contextFor,
    getClass: () => CsrfGuard,
    switchToHttp: () => ({
      getRequest: () => ({ method, path, cookies: {}, get: () => undefined }),
    }),
  }) as unknown as ExecutionContext;

describe('CsrfGuard hidden surfaces (REVIEW F-26)', () => {
  const guard = new CsrfGuard(new Reflector());

  // Express routes are case-insensitive, so the hidden prefix must be too: a
  // 403 here would tell an anonymous caller that the route exists.
  it.each([
    '/api/v1/admin/courses',
    '/API/V1/ADMIN/courses',
    '/api/v1/Dev/mail',
  ])('answers 404 for %s without a token', (path) => {
    expect(() => guard.canActivate(contextFor('POST', path))).toThrow(
      NotFoundException,
    );
  });

  it('still answers 403 outside those prefixes', () => {
    try {
      guard.canActivate(contextFor('POST', '/api/v1/auth/login'));
      expect.fail('expected a CSRF error');
    } catch (error) {
      expect((error as HttpException).getStatus()).toBe(403);
    }
  });
});
