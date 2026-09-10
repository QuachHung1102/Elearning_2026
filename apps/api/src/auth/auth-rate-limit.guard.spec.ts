import { ExecutionContext, HttpException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
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
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(429);
    }
    expect(setHeader).toHaveBeenCalledWith('Retry-After', expect.any(Number));
  });
});
