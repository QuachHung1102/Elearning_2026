import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { UserRole } from '../generated/prisma/client.js';
import { AUTH_COOKIE_NAME } from './auth.constants.js';
import { AuthService } from './auth.service.js';
import type { AuthenticatedRequest } from './session-auth.guard.js';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = (request as Request).cookies?.[AUTH_COOKIE_NAME];
    const auth =
      typeof token === 'string'
        ? await this.authService.authenticate(token)
        : null;

    if (!auth || auth.user.role !== UserRole.ADMIN) {
      throw new NotFoundException();
    }

    request.auth = auth;
    return true;
  }
}
