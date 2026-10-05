import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ArrayNotEmpty, IsArray, IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { AuditActor } from '../audit/audit-actor.decorator.js';
import type { AuditActorContext } from '../audit/audit.service.js';
import { AuthRateLimitGuard } from '../auth/auth-rate-limit.guard.js';
import { RateLimit } from '../auth/rate-limit.decorator.js';
import {
  SessionAuthGuard,
  type AuthenticatedRequest,
} from '../auth/session-auth.guard.js';
import { PageQuery, csv, trim } from '../catalog/course.dto.js';
import { PurchaseStatus } from '../generated/prisma/enums.js';
import { PurchaseService } from './purchase.service.js';

export class PurchaseListQuery extends PageQuery {
  @IsOptional()
  @csv()
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(PurchaseStatus, { each: true })
  status?: PurchaseStatus[];
}

export class RefundRequestDto {
  @trim()
  @IsString()
  @Length(10, 500)
  reason: string;
}

const uuid = () => new ParseUUIDPipe({ version: '4' });

/** The learner's orders (API_CONTRACT.md §5.8). Personal data: never cached. */
@Controller('purchases')
@UseGuards(SessionAuthGuard, AuthRateLimitGuard)
export class PurchaseController {
  constructor(private readonly purchases: PurchaseService) {}

  // Declared before `:id`, or "me" would be read as an id.
  @Get('me')
  @Header('Cache-Control', 'no-store')
  list(@Req() request: AuthenticatedRequest, @Query() query: PurchaseListQuery) {
    return this.purchases.list(request.auth.user.id, query);
  }

  /** The checkout page polls this every 3 s. */
  @Get(':id')
  @Header('Cache-Control', 'no-store')
  @RateLimit({ key: 'user', limit: 120, windowSeconds: 60 })
  get(
    @Req() request: AuthenticatedRequest,
    @Param('id', uuid()) id: string,
  ) {
    return this.purchases.get(request.auth.user.id, id.toLowerCase());
  }

  @Post(':id/refund-request')
  @HttpCode(HttpStatus.ACCEPTED)
  @Header('Cache-Control', 'no-store')
  @RateLimit({ key: 'user', limit: 5, windowSeconds: 300 })
  requestRefund(
    @Req() request: AuthenticatedRequest,
    @Param('id', uuid()) id: string,
    @Body() input: RefundRequestDto,
    @AuditActor() actor: AuditActorContext,
  ) {
    return this.purchases.requestRefund(
      request.auth.user.id,
      id.toLowerCase(),
      input.reason,
      actor.ipAddress,
    );
  }
}
