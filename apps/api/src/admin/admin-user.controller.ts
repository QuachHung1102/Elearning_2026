import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { AuditActor } from '../audit/audit-actor.decorator.js';
import { AuditService, type AuditActorContext } from '../audit/audit.service.js';
import { AdminGuard } from '../auth/admin.guard.js';
import { AuthRateLimitGuard } from '../auth/auth-rate-limit.guard.js';
import { AdminMutationRateLimit } from '../auth/rate-limit.decorator.js';
import { csv, PageQuery, trim } from '../catalog/course.dto.js';
import { ERROR_CODE, appError } from '../common/error-codes.js';
import { paginated, resolvePage } from '../common/pagination.js';
import { ADMIN_ENROLLMENT_SELECT } from '../enrollment/enrollment.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import {
  EnrollmentStatus,
  UserRole,
  UserStatus,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

const USER_SORTS = [
  'createdAt:desc',
  'createdAt:asc',
  'email:asc',
  'email:desc',
] as const;

export class AdminUserListQuery extends PageQuery {
  @IsOptional()
  @trim()
  @IsString()
  @MaxLength(100)
  q?: string;

  /** Exact, case-insensitive email match (the grant dialog's lookup). */
  @IsOptional()
  @trim()
  @IsString()
  @MaxLength(320)
  email?: string;

  @IsOptional()
  @csv()
  @IsArray()
  @IsEnum(UserStatus, { each: true })
  status?: UserStatus[];

  @IsOptional()
  @csv()
  @IsArray()
  @IsEnum(UserRole, { each: true })
  role?: UserRole[];

  @IsOptional()
  @IsIn(USER_SORTS)
  sort?: (typeof USER_SORTS)[number];
}

/** Status only: a reason field would be a 400 under `forbidNonWhitelisted`. */
export class UpdateUserStatusDto {
  @IsEnum(UserStatus)
  status: UserStatus;
}

const uuid = () => new ParseUUIDPipe({ version: '4' });

/**
 * The one projection for `/admin/users*` (API_CONTRACT.md §6.2): an explicit
 * select, so `passwordHash` can never ride along with a Prisma entity.
 */
function adminUserSelect(now: Date) {
  return {
    id: true,
    email: true,
    displayName: true,
    role: true,
    status: true,
    emailVerifiedAt: true,
    createdAt: true,
    _count: {
      select: {
        enrollments: { where: { status: EnrollmentStatus.ACTIVE } },
        sessions: { where: { revokedAt: null, expiresAt: { gt: now } } },
      },
    },
  } satisfies Prisma.UserSelect;
}

type AdminUserRecord = Prisma.UserGetPayload<{
  select: ReturnType<typeof adminUserSelect>;
}>;

function toAdminUserRow({ _count, ...user }: AdminUserRecord) {
  return {
    ...user,
    enrollmentCount: _count.enrollments,
    // Purchases arrive with checkout (phase 4); the key keeps the shape fixed.
    purchaseCount: 0,
    activeSessionCount: _count.sessions,
  };
}

function notFound(): never {
  throw appError(HttpStatus.NOT_FOUND, ERROR_CODE.NOT_FOUND, 'Not Found');
}

@Controller('admin/users')
@UseGuards(AdminGuard, AuthRateLimitGuard)
export class AdminUserController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async list(@Query() query: AdminUserListQuery) {
    const page = resolvePage(query);
    const where: Prisma.UserWhereInput = {};
    if (query.q) {
      where.OR = [
        { email: { contains: query.q, mode: 'insensitive' } },
        { displayName: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    if (query.email) {
      where.email = { equals: query.email, mode: 'insensitive' };
    }
    if (query.status?.length) where.status = { in: query.status };
    if (query.role?.length) where.role = { in: query.role };

    const [field, direction] = (query.sort ?? 'createdAt:desc').split(':') as [
      'createdAt' | 'email',
      'asc' | 'desc',
    ];
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: adminUserSelect(new Date()),
        // `id` breaks createdAt ties so a page boundary never repeats a row.
        orderBy: [{ [field]: direction }, { id: 'asc' }],
        skip: page.skip,
        take: page.take,
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginated(items.map(toAdminUserRow), total, page);
  }

  @Get(':id')
  async detail(@Param('id', uuid()) id: string) {
    const user = await this.findRow(id);
    const enrollments = await this.prisma.enrollment.findMany({
      where: { userId: id },
      select: ADMIN_ENROLLMENT_SELECT,
      orderBy: [{ grantedAt: 'desc' }, { id: 'asc' }],
    });
    return { user, enrollments, purchases: [] };
  }

  /**
   * One endpoint, two audit actions. Blocking revokes every open session in
   * the same transaction; `authenticate` and `login` already refuse a
   * non-ACTIVE user, so nothing else has to change for the block to bite.
   */
  @Patch(':id')
  @AdminMutationRateLimit()
  async updateStatus(
    @Param('id', uuid()) rawId: string,
    @Body() input: UpdateUserStatusDto,
    @AuditActor() actor: AuditActorContext,
  ) {
    // The pipe accepts any letter case and PostgreSQL matches a uuid in any
    // case, but session user ids are lower-case: without this an upper-cased
    // own id slips past the self-block check.
    const id = rawId.toLowerCase();
    if (id === actor.actorId && input.status === UserStatus.BLOCKED) {
      throw appError(
        HttpStatus.CONFLICT,
        ERROR_CODE.SELF_ACTION_FORBIDDEN,
        'An admin cannot block their own account',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // Conditional, so two racing requests cannot both write an audit row:
      // the second waits for the row lock and then matches nothing.
      const { count } = await tx.user.updateMany({
        where: { id, status: { not: input.status } },
        data: { status: input.status },
      });
      if (count === 0) {
        const exists = await tx.user.count({ where: { id } });
        if (!exists) notFound();
        return; // Already in that status: no write, no audit row.
      }

      const now = new Date();
      if (input.status === UserStatus.BLOCKED) {
        // Every unrevoked row is revoked, expired ones too (A3.11), but the
        // audit counts only the live ones, matching the `activeSessionCount`
        // tile the admin was looking at.
        const revokedSessions = await tx.session.count({
          where: { userId: id, revokedAt: null, expiresAt: { gt: now } },
        });
        await tx.session.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: now },
        });
        await this.audit.record(
          {
            ...actor,
            action: 'user.blocked',
            entityType: 'USER',
            entityId: id,
            metadata: { reason: null, revokedSessions },
          },
          tx,
        );
      } else {
        // A login that passed its status check just before the block
        // committed can still insert a session after it. A blocked user never
        // holds a usable session, so anything unrevoked now came from that race
        // and must not come back to life with the account.
        await tx.session.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: now },
        });
        await this.audit.record(
          {
            ...actor,
            action: 'user.unblocked',
            entityType: 'USER',
            entityId: id,
            metadata: {},
          },
          tx,
        );
      }
    });

    return { user: await this.findRow(id) };
  }

  private async findRow(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: adminUserSelect(new Date()),
    });
    if (!user) notFound();
    return toAdminUserRow(user);
  }
}
