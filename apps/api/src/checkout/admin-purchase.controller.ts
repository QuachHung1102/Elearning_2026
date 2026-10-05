import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';
import { AuditActor } from '../audit/audit-actor.decorator.js';
import type { AuditActorContext } from '../audit/audit.service.js';
import { AdminGuard } from '../auth/admin.guard.js';
import { AuthRateLimitGuard } from '../auth/auth-rate-limit.guard.js';
import { AdminMutationRateLimit } from '../auth/rate-limit.decorator.js';
import type { AuthenticatedRequest } from '../auth/session-auth.guard.js';
import { trim } from '../catalog/course.dto.js';
import { PurchaseService } from './purchase.service.js';

export class RefundDto {
  @trim()
  @IsString()
  @Length(3, 500)
  reason: string;

  /** Waives the policy (7 days, 20% progress, free course), never the invariants. */
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

export class RefundRejectDto {
  @trim()
  @IsString()
  @Length(3, 500)
  reason: string;
}

const uuid = () => new ParseUUIDPipe({ version: '4' });

/** Refund bookkeeping (API_CONTRACT.md §5.8): ADMIN only, 404 to anyone else. */
@Controller('admin/purchases')
@UseGuards(AdminGuard, AuthRateLimitGuard)
export class AdminPurchaseController {
  constructor(private readonly purchases: PurchaseService) {}

  @Post(':id/refund')
  @HttpCode(HttpStatus.OK)
  @AdminMutationRateLimit()
  refund(
    @Req() request: AuthenticatedRequest,
    @Param('id', uuid()) id: string,
    @Body() input: RefundDto,
    @AuditActor() actor: AuditActorContext,
  ) {
    return this.purchases.refund(id.toLowerCase(), input, {
      actorId: request.auth.user.id,
      ipAddress: actor.ipAddress,
    });
  }

  @Post(':id/refund-reject')
  @HttpCode(HttpStatus.OK)
  @AdminMutationRateLimit()
  reject(
    @Req() request: AuthenticatedRequest,
    @Param('id', uuid()) id: string,
    @Body() input: RefundRejectDto,
    @AuditActor() actor: AuditActorContext,
  ) {
    return this.purchases.rejectRefund(id.toLowerCase(), input.reason, {
      actorId: request.auth.user.id,
      ipAddress: actor.ipAddress,
    });
  }
}
