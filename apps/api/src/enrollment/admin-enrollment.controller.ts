import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import type { Response } from 'express';
import { AuditActor } from '../audit/audit-actor.decorator.js';
import type { AuditActorContext } from '../audit/audit.service.js';
import { AdminGuard } from '../auth/admin.guard.js';
import { AuthRateLimitGuard } from '../auth/auth-rate-limit.guard.js';
import { AdminMutationRateLimit } from '../auth/rate-limit.decorator.js';
import { csv, PageQuery, trim } from '../catalog/course.dto.js';
import { paginated, resolvePage } from '../common/pagination.js';
import type { Prisma } from '../generated/prisma/client.js';
import {
  EnrollmentSource,
  EnrollmentStatus,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  ADMIN_ENROLLMENT_SELECT,
  EnrollmentService,
} from './enrollment.service.js';

export class AdminEnrollmentListQuery extends PageQuery {
  @IsOptional()
  @IsUUID('4')
  courseId?: string;

  @IsOptional()
  @IsUUID('4')
  userId?: string;

  @IsOptional()
  @csv()
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(EnrollmentStatus, { each: true })
  status?: EnrollmentStatus[];
}

export class GrantEnrollmentDto {
  @IsUUID('4')
  userId: string;

  @IsUUID('4')
  courseId: string;

  /** Audit metadata only; there is no column for it (API_CONTRACT.md §5.4). */
  @IsOptional()
  @trim()
  @IsString()
  @MaxLength(500)
  note?: string;
}

const uuid = () => new ParseUUIDPipe({ version: '4' });

@Controller('admin/enrollments')
@UseGuards(AdminGuard, AuthRateLimitGuard)
export class AdminEnrollmentController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly enrollments: EnrollmentService,
  ) {}

  @Get()
  async list(@Query() query: AdminEnrollmentListQuery) {
    const page = resolvePage(query);
    const where: Prisma.EnrollmentWhereInput = {
      courseId: query.courseId,
      userId: query.userId,
      status: query.status && { in: query.status },
    };
    const [items, total] = await Promise.all([
      this.prisma.enrollment.findMany({
        where,
        select: ADMIN_ENROLLMENT_SELECT,
        // Newest grant first, so a fresh grant lands at the top (UX_PLAN.md §5.4).
        orderBy: [{ grantedAt: 'desc' }, { id: 'asc' }],
        skip: page.skip,
        take: page.take,
      }),
      this.prisma.enrollment.count({ where }),
    ]);
    return paginated(items, total, page);
  }

  /** `201` when this call changed access, `200` when it was already ACTIVE. */
  @Post()
  @AdminMutationRateLimit()
  async grant(
    @Body() input: GrantEnrollmentDto,
    @AuditActor() actor: AuditActorContext,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { enrollment, changed } = await this.enrollments.grant({
      userId: input.userId,
      courseId: input.courseId,
      source: EnrollmentSource.MANUAL_GRANT,
      actorId: actor.actorId,
      ipAddress: actor.ipAddress,
      note: input.note || undefined,
    });
    response.status(changed ? HttpStatus.CREATED : HttpStatus.OK);
    return this.prisma.enrollment.findUniqueOrThrow({
      where: { id: enrollment.id },
      select: ADMIN_ENROLLMENT_SELECT,
    });
  }

  /** Soft: the row stays as REVOKED; revoking twice is a silent no-op. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AdminMutationRateLimit()
  async revoke(
    @Param('id', uuid()) id: string,
    @AuditActor() actor: AuditActorContext,
  ): Promise<void> {
    await this.enrollments.revoke({
      enrollmentId: id.toLowerCase(),
      actorId: actor.actorId,
      ipAddress: actor.ipAddress,
      reason: 'admin_revoke',
      trigger: 'admin',
    });
  }
}
