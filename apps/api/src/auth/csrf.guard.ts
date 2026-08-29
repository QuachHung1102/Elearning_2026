import { randomBytes, timingSafeEqual } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from './auth.constants.js';

export function createCsrfToken(): string {
  return randomBytes(32).toString('base64url');
}

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const cookieToken = request.cookies?.[CSRF_COOKIE_NAME];
    const headerToken = request.get(CSRF_HEADER_NAME);

    if (
      typeof cookieToken !== 'string' ||
      typeof headerToken !== 'string' ||
      !this.tokensMatch(cookieToken, headerToken)
    ) {
      throw new ForbiddenException('Invalid CSRF token');
    }

    return true;
  }

  private tokensMatch(cookieToken: string, headerToken: string): boolean {
    const cookie = Buffer.from(cookieToken);
    const header = Buffer.from(headerToken);
    return cookie.length === header.length && timingSafeEqual(cookie, header);
  }
}
