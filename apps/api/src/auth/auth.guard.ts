import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AUTH_COOKIE_NAME, AuthService, AuthUser } from './auth.service.js';

export type AuthenticatedRequest = Request & {
  auth: { user: AuthUser; sessionId: string };
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.cookies?.[AUTH_COOKIE_NAME];

    if (typeof token !== 'string') throw new UnauthorizedException();

    const auth = await this.authService.authenticate(token);
    if (!auth) throw new UnauthorizedException();

    request.auth = auth;
    return true;
  }
}
