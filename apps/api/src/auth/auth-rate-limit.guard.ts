import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { clientIp } from '../common/client-ip.js';
import { RateLimitedError } from '../common/rate-limited.error.js';
import { RateLimiter } from '../common/rate-limiter.js';
import type { AuthenticatedRequest } from './session-auth.guard.js';
import { RATE_LIMIT, type RateLimitOptions } from './rate-limit.decorator.js';

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  // ponytail: per-process, like everything in `RateLimiter`; use shared storage
  // before horizontal scaling.
  private readonly limiter = new RateLimiter();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT,
      [context.getHandler(), context.getClass()],
    );
    if (!options) return true;

    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();
    const subject =
      options.key === 'user'
        ? (request.auth?.user.id ?? 'unauthenticated')
        : clientIp(request);
    const route = request.route?.path ?? request.path;
    const key = `${options.key}:${subject}:${request.method}:${route}`;

    const retryAfter = this.limiter.hit(
      key,
      options.limit,
      options.windowSeconds,
    );
    if (retryAfter === null) return true;
    throw new RateLimitedError(retryAfter);
  }
}
