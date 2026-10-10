import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { AuditActor } from '../audit/audit-actor.decorator.js';
import type { AuditActorContext } from '../audit/audit.service.js';
import { AdminGuard } from '../auth/admin.guard.js';
import { AuthRateLimitGuard } from '../auth/auth-rate-limit.guard.js';
import { AdminMutationRateLimit } from '../auth/rate-limit.decorator.js';
import type { AuthenticatedRequest } from '../auth/session-auth.guard.js';
import { PageQuery, csv } from '../catalog/course.dto.js';
import { PurchaseStatus } from '../generated/prisma/enums.js';
import { PurchaseService } from './purchase.service.js';
import { ReconcileService } from './reconcile.service.js';

export class AdminPaymentListQuery extends PageQuery {
  @IsOptional()
  @csv()
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(PurchaseStatus, { each: true })
  status?: PurchaseStatus[];

  @IsOptional()
  @IsUUID('4')
  courseId?: string;

  /** Instants, not dates: an ISO 8601 string such as `2026-09-01T00:00:00.000Z`. */
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  /** Only `true` filters; `false` reads the same as leaving it out. */
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  duplicatePaid?: boolean;
}

const uuid = () => new ParseUUIDPipe({ version: '4' });

/** The admin's payment screens: ADMIN only, invisible (404) to anyone else. */
@Controller('admin/payments')
@UseGuards(AdminGuard, AuthRateLimitGuard)
export class AdminPaymentController {
  constructor(
    private readonly purchases: PurchaseService,
    private readonly reconcile: ReconcileService,
  ) {}

  @Get()
  list(@Query() query: AdminPaymentListQuery) {
    return this.purchases.listForAdmin(query);
  }

  /** Ask the provider about one attempt again and apply the answer. */
  @Post(':attemptId/reconcile')
  @HttpCode(HttpStatus.OK)
  @AdminMutationRateLimit()
  run(
    @Req() request: AuthenticatedRequest,
    @Param('attemptId', uuid()) attemptId: string,
    @AuditActor() actor: AuditActorContext,
  ) {
    return this.reconcile.reconcileAttempt(attemptId.toLowerCase(), {
      actorId: request.auth.user.id,
      ipAddress: actor.ipAddress,
    });
  }
}
