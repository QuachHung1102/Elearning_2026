import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsISO8601,
  IsOptional,
  IsUUID,
  Matches,
} from 'class-validator';
import { AdminGuard } from '../auth/admin.guard.js';
import { csv, PageQuery } from '../catalog/course.dto.js';
import { paginated, resolvePage } from '../common/pagination.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  type AuditAction,
  type AuditEntityType,
} from './actions.js';

/**
 * A calendar date (UTC midnight) or a date-time with `Z` or an offset
 * (API_CONTRACT.md §2.9). Strict ISO 8601 alone also passes week dates,
 * ordinal dates and `T10`, which `new Date` cannot read (a 500 from Prisma),
 * and offset-less times, which it reads in the server's own time zone.
 */
const INSTANT =
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?$/;
const INSTANT_MESSAGE =
  '$property must be a date (YYYY-MM-DD) or a date-time with Z or an offset';

/**
 * Filters only from the closed vocabulary: anything else is a 400, not an
 * empty page. Exact filters take a comma list (API_CONTRACT.md §2.8).
 */
export class AuditLogListQuery extends PageQuery {
  @IsOptional()
  @csv()
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  actorId?: string[];

  @IsOptional()
  @csv()
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(AUDIT_ENTITY_TYPES, { each: true })
  entityType?: AuditEntityType[];

  @IsOptional()
  @csv()
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(AUDIT_ACTIONS, { each: true })
  action?: AuditAction[];

  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(INSTANT, { message: INSTANT_MESSAGE })
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(INSTANT, { message: INSTANT_MESSAGE })
  to?: string;
}

/**
 * Read only, newest first (API_CONTRACT.md §5.7). `from`/`to` are inclusive
 * instants; a range with `from` after `to` matches nothing rather than
 * failing, so a mistyped date pair shows an empty page instead of an outage.
 */
@Controller('admin/audit-logs')
@UseGuards(AdminGuard)
export class AdminAuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query() query: AuditLogListQuery) {
    const page = resolvePage(query);
    const where: Prisma.AuditLogWhereInput = {
      actorId: query.actorId && { in: query.actorId },
      entityType: query.entityType && { in: query.entityType },
      action: query.action && { in: query.action },
    };
    if (query.from || query.to) {
      where.createdAt = {
        gte: query.from ? new Date(query.from) : undefined,
        lte: query.to ? new Date(query.to) : undefined,
      };
    }

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        select: {
          id: true,
          actorId: true,
          action: true,
          entityType: true,
          entityId: true,
          metadata: true,
          ipAddress: true,
          createdAt: true,
          actor: { select: { email: true } },
        },
        // `id` breaks same-millisecond ties so a page boundary never repeats a row.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: page.skip,
        take: page.take,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const items = rows.map(({ actor, ...row }) => ({
      ...row,
      // `null` for the system, and for an actor since deleted (SetNull).
      actorEmail: actor?.email ?? null,
    }));
    return paginated(items, total, page);
  }
}
