import { isIP } from 'node:net';
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/session-auth.guard.js';
import { clientIp } from '../common/client-ip.js';
import type { AuditActorContext } from './audit.service.js';

/** Who is acting and from where, for the one audit row a mutation writes. */
export const AuditActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuditActorContext => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const ip = clientIp(request);
    return {
      actorId: request.auth?.user.id ?? null,
      ipAddress: isIP(ip) ? ip : null,
    };
  },
);
