import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Response } from 'express';
import { clientIp } from '../common/client-ip.js';
import { ERROR_CODE, appError } from '../common/error-codes.js';
import type { AuthenticatedRequest } from './session-auth.guard.js';
import { RATE_LIMIT, type RateLimitOptions } from './rate-limit.decorator.js';

const MAX_TRACKED_CLIENTS = 10_000;

type Attempt = { count: number; resetsAt: number };

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  // ponytail: this is per-process; use shared storage before horizontal scaling.
  private readonly attempts = new Map<string, Attempt>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT,
      [context.getHandler(), context.getClass()],
    );
    if (!options) return true;

    const http = context.switchToHttp();
    const request = http.getRequest<AuthenticatedRequest>();
    const response = http.getResponse<Response>();
    const now = Date.now();
    const subject =
      options.key === 'user'
        ? (request.auth?.user.id ?? 'unauthenticated')
        : clientIp(request);
    const route = request.route?.path ?? request.path;
    const key = `${options.key}:${subject}:${request.method}:${route}`;
    const attempt = this.attempts.get(key);

    if (!attempt || attempt.resetsAt <= now) {
      if (this.attempts.size >= MAX_TRACKED_CLIENTS) this.attempts.clear();
      this.attempts.set(key, {
        count: 1,
        resetsAt: now + options.windowSeconds * 1_000,
      });
      return true;
    }

    if (attempt.count >= options.limit) {
      response.setHeader(
        'Retry-After',
        Math.ceil((attempt.resetsAt - now) / 1_000),
      );
      throw appError(429, ERROR_CODE.RATE_LIMITED, 'Too many requests');
    }

    attempt.count += 1;
    return true;
  }
}
