import { ExecutionContext, HttpException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { RateLimitedError } from '../common/rate-limited.error.js';
import { AuthRateLimitGuard } from './auth-rate-limit.guard.js';

describe('AuthRateLimitGuard', () => {
  it('blocks the eleventh authentication attempt for one client', () => {
    const setHeader = vi.fn();
    const context = {
      getHandler: () => AuthRateLimitGuard,
      getClass: () => AuthRateLimitGuard,
      switchToHttp: () => ({
        getRequest: () => ({ ip: '127.0.0.1', path: '/auth/login' }),
        getResponse: () => ({ setHeader }),
      }),
    } as unknown as ExecutionContext;
    const guard = new AuthRateLimitGuard({
      getAllAndOverride: () => ({
        key: 'ip',
        limit: 10,
        windowSeconds: 60,
      }),
    } as unknown as Reflector);

    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect(guard.canActivate(context)).toBe(true);
    }

    try {
      guard.canActivate(context);
      expect.fail('expected rate limit error');
    } catch (error) {
      expect(error).toBeInstanceOf(RateLimitedError);
      expect((error as HttpException).getStatus()).toBe(429);
      // The filter turns this into the Retry-After header.
      expect((error as RateLimitedError).retryAfterSeconds).toBeGreaterThan(0);
    }
    expect(setHeader).not.toHaveBeenCalled();
  });

  // REVIEW F-11: the table used to `clear()` when full, so anyone who could
  // mint 10,000 client keys (a /64 of IPv6 addresses) reset every counter.
  it('keeps the counter of a limited client when one-off keys fill the table', () => {
    const contextFor = (ip: string) =>
      ({
        getHandler: () => AuthRateLimitGuard,
        getClass: () => AuthRateLimitGuard,
        switchToHttp: () => ({
          getRequest: () => ({ ip, path: '/auth/login', method: 'POST' }),
          getResponse: () => ({ setHeader: vi.fn() }),
        }),
      }) as unknown as ExecutionContext;
    const guard = new AuthRateLimitGuard({
      getAllAndOverride: () => ({ key: 'ip', limit: 3, windowSeconds: 60 }),
    } as unknown as Reflector);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      guard.canActivate(contextFor('victim'));
    }
    expect(() => guard.canActivate(contextFor('victim'))).toThrow(HttpException);

    for (let flood = 0; flood < 10_050; flood += 1) {
      guard.canActivate(contextFor(`flood-${flood}`));
    }

    expect(() => guard.canActivate(contextFor('victim'))).toThrow(HttpException);
  });
});
