import { randomBytes, timingSafeEqual } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ERROR_CODE, appError } from '../common/error-codes.js';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from './auth.constants.js';

const SKIP_CSRF = 'skipCsrf';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
/**
 * Prefixes whose whole surface answers 404 to anyone who is not an admin.
 * Case-insensitive because Express routing is: `/API/V1/ADMIN/x` reaches the
 * same handlers.
 */
const HIDDEN_PREFIX = /^\/api\/v1\/(admin|dev)\//i;

export const SkipCsrf = () => SetMetadata(SKIP_CSRF, true);

export function createCsrfToken(): string {
  return randomBytes(32).toString('base64url');
}

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (
      SAFE_METHODS.has(request.method) ||
      this.reflector.getAllAndOverride<boolean>(SKIP_CSRF, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }

    const cookieToken = request.cookies?.[CSRF_COOKIE_NAME];
    const headerToken = request.get(CSRF_HEADER_NAME);

    if (
      typeof cookieToken !== 'string' ||
      typeof headerToken !== 'string' ||
      !this.tokensMatch(cookieToken, headerToken)
    ) {
      // Global guards run before route guards, so on `/admin/*` this would be
      // the first answer an anonymous caller sees — and a 403 here tells them
      // the route exists, which is exactly what `AdminGuard`'s blanket 404 is
      // there to prevent (API_CONTRACT.md §3.3, ROADMAP.md N2.4).
      if (HIDDEN_PREFIX.test(request.path)) throw new NotFoundException();
      throw appError(403, ERROR_CODE.CSRF_INVALID, 'Invalid CSRF token');
    }

    return true;
  }

  private tokensMatch(cookieToken: string, headerToken: string): boolean {
    const cookie = Buffer.from(cookieToken);
    const header = Buffer.from(headerToken);
    return cookie.length === header.length && timingSafeEqual(cookie, header);
  }
}
