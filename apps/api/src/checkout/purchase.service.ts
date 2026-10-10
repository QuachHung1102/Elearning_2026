import { HttpStatus, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { EnrollmentService } from '../enrollment/enrollment.service.js';
import { ERROR_CODE, appError } from '../common/error-codes.js';
import { paginated, resolvePage } from '../common/pagination.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PaymentAttemptStatus, PurchaseStatus } from '../generated/prisma/enums.js';
import { ProgressService } from '../learning/progress.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toSession } from './checkout-session.js';
import { refundBlocker, type RefundBlock } from './refund-policy.js';

/** `PurchaseRow` (API_CONTRACT.md §4). */
export const ROW_SELECT = {
  id: true,
  courseId: true,
  priceVnd: true,
  status: true,
  createdAt: true,
  paidAt: true,
  refundedAt: true,
  course: { select: { title: true, slug: true } },
} satisfies Prisma.PurchaseSelect;

type RowRecord = Prisma.PurchaseGetPayload<{ select: typeof ROW_SELECT }>;

export function toRow({ course, ...row }: RowRecord) {
  return { ...row, courseSlug: course.slug, courseTitle: course.title };
}

function notFound(): never {
  throw appError(HttpStatus.NOT_FOUND, ERROR_CODE.NOT_FOUND, 'Not Found');
}

/** The 409 of API_CONTRACT.md §5.8, with what the caller needs to understand it. */
export function notRefundable(block: RefundBlock) {
  return appError(
    HttpStatus.CONFLICT,
    ERROR_CODE.PURCHASE_NOT_REFUNDABLE,
    'Purchase is outside the refund policy',
    {
      reason: block.reason,
      paidAt: block.paidAt?.toISOString() ?? null,
      daysSincePaid: block.daysSincePaid,
      progressPercent: block.progressPercent,
    },
  );
}

/**
 * The learner's own orders. Every read is scoped to `userId` in the query
 * itself, so someone else's order is a 404 and not a 403 that confirms it exists.
 */
@Injectable()
export class PurchaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly progress: ProgressService,
    private readonly audit: AuditService,
    private readonly enrollments: EnrollmentService,
  ) {}

  async list(
    userId: string,
    query: { page?: string; pageSize?: string; status?: PurchaseStatus[] },
  ) {
    const page = resolvePage(query);
    const where: Prisma.PurchaseWhereInput = {
      userId,
      ...(query.status && { status: { in: query.status } }),
    };
    const [items, total] = await Promise.all([
      this.prisma.purchase.findMany({
        where,
        select: ROW_SELECT,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: page.skip,
        take: page.take,
      }),
      this.prisma.purchase.count({ where }),
    ]);
    return paginated(items.map(toRow), total, page);
  }

  /**
   * `GET /admin/payments`: every order with its learner and every QR it has
   * had, newest first. `duplicatePaid` is not a column: it is "more than one
   * SUCCEEDED attempt", found by a query (API_CONTRACT.md §5.8).
   */
  async listForAdmin(query: {
    page?: string;
    pageSize?: string;
    status?: PurchaseStatus[];
    courseId?: string;
    from?: string;
    to?: string;
    duplicatePaid?: boolean;
  }) {
    const page = resolvePage(query);
    const duplicates = query.duplicatePaid
      ? await this.prisma.paymentAttempt.groupBy({
          by: ['purchaseId'],
          where: { status: PaymentAttemptStatus.SUCCEEDED },
          having: { purchaseId: { _count: { gt: 1 } } },
        })
      : null;
    const where: Prisma.PurchaseWhereInput = {
      ...(query.status && { status: { in: query.status } }),
      ...(query.courseId && { courseId: query.courseId }),
      ...((query.from || query.to) && {
        createdAt: {
          ...(query.from && { gte: new Date(query.from) }),
          ...(query.to && { lte: new Date(query.to) }),
        },
      }),
      ...(duplicates && { id: { in: duplicates.map((row) => row.purchaseId) } }),
    };
    const [items, total] = await Promise.all([
      this.prisma.purchase.findMany({
        where,
        select: {
          ...ROW_SELECT,
          user: { select: { id: true, email: true, displayName: true } },
          attempts: {
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              appTransId: true,
              providerTransId: true,
              provider: true,
              status: true,
              amountVnd: true,
              expiresAt: true,
              paidAt: true,
              createdAt: true,
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: page.skip,
        take: page.take,
      }),
      this.prisma.purchase.count({ where }),
    ]);
    return paginated(
      items.map(({ user, attempts, ...row }) => ({
        ...toRow(row),
        user,
        attempts,
      })),
      total,
      page,
    );
  }

  /**
   * Stored state, not recomputed: between a QR's expiry and the next reconcile
   * run this still says PENDING, and the client compares `expiresAt` with its
   * own clock (API_CONTRACT.md §5.8). An attempt that never got a QR is not
   * history the learner can act on, so it is left out.
   */
  async get(userId: string, id: string) {
    const purchase = await this.prisma.purchase.findFirst({
      where: { id, userId },
      select: {
        ...ROW_SELECT,
        attempts: {
          where: { qrCode: { not: null } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!purchase) notFound();
    const { attempts, ...row } = purchase;
    return { ...toRow(row), attempts: attempts.map(toSession) };
  }

  /**
   * PAID → REFUND_REQUESTED. The learner keeps access: it ends only when an
   * admin marks the order REFUNDED. No `force`; that is the admin's.
   */
  async requestRefund(
    userId: string,
    id: string,
    reason: string,
    ipAddress: string | null,
  ) {
    const purchase = await this.prisma.purchase.findFirst({
      where: { id, userId },
      include: { enrollment: { select: { source: true } } },
    });
    if (!purchase) notFound();
    const facts = {
      enrollmentSource: purchase.enrollment?.source ?? null,
      progress: (await this.progress.courseSummary(userId, purchase.courseId))
        .progress,
      now: new Date(),
      allowed: [PurchaseStatus.PAID],
    };
    const block = refundBlocker({ ...facts, purchase });
    if (block) throw notRefundable(block);

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.purchase.updateMany({
        where: { id, status: PurchaseStatus.PAID },
        data: { status: PurchaseStatus.REFUND_REQUESTED },
      });
      if (count === 0) {
        // Lost a race (a second click, or an admin's decision): say why, from
        // the row as it is now.
        const current = await tx.purchase.findUniqueOrThrow({ where: { id } });
        const why = refundBlocker({ ...facts, purchase: current });
        throw notRefundable(
          why ?? { reason: 'NOT_PAID', paidAt: null, daysSincePaid: null, progressPercent: 0 },
        );
      }
      await this.audit.record(
        {
          actorId: userId,
          ipAddress,
          action: 'purchase.refund_requested',
          entityType: 'PURCHASE',
          entityId: id,
          metadata: { reason },
        },
        tx,
      );
    });
    return toRow(
      await this.prisma.purchase.findUniqueOrThrow({
        where: { id },
        select: ROW_SELECT,
      }),
    );
  }

  /**
   * PAID or REFUND_REQUESTED → REFUNDED, and the access ends in the same
   * transaction (DATA_MODEL.md §Enrollment): there is never a refunded order
   * that still teaches. The money moved outside the system; this only records
   * it. `force` waives the policy, never the data invariants.
   */
  async refund(
    id: string,
    input: { reason: string; force?: boolean },
    actor: { actorId: string; ipAddress: string | null },
  ) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id },
      include: { enrollment: { select: { id: true, source: true } } },
    });
    if (!purchase) notFound();
    const facts = {
      enrollmentSource: purchase.enrollment?.source ?? null,
      progress: (
        await this.progress.courseSummary(purchase.userId, purchase.courseId)
      ).progress,
      now: new Date(),
      allowed: [PurchaseStatus.PAID, PurchaseStatus.REFUND_REQUESTED],
      force: input.force,
    };
    const block = refundBlocker({ ...facts, purchase });
    if (block) throw notRefundable(block);

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.purchase.updateMany({
        where: {
          id,
          status: { in: [PurchaseStatus.PAID, PurchaseStatus.REFUND_REQUESTED] },
        },
        data: { status: PurchaseStatus.REFUNDED, refundedAt: facts.now },
      });
      if (count === 0) {
        // Another admin got there first: report the row as it is now.
        const current = await tx.purchase.findUniqueOrThrow({ where: { id } });
        throw notRefundable(
          refundBlocker({ ...facts, purchase: current }) ?? {
            reason: 'ALREADY_REFUNDED',
            paidAt: current.paidAt,
            daysSincePaid: null,
            progressPercent: 0,
          },
        );
      }
      const entry = { ipAddress: actor.ipAddress, entityType: 'PURCHASE' } as const;
      if (purchase.status === PurchaseStatus.REFUND_REQUESTED) {
        await this.audit.record(
          {
            ...entry,
            actorId: actor.actorId,
            action: 'purchase.refund_approved',
            entityId: id,
            metadata: { reason: input.reason },
          },
          tx,
        );
      }
      await this.audit.record(
        {
          ...entry,
          actorId: actor.actorId,
          action: 'purchase.refunded',
          entityId: id,
          metadata: {
            amountVnd: purchase.priceVnd,
            reason: input.reason,
            ...(input.force ? { forced: true } : {}),
          },
        },
        tx,
      );
      // A refund-driven `enrollment.revoked` has no admin as actor: the admin is
      // on `purchase.refunded` above (DATA_MODEL.md §AuditLog).
      if (purchase.enrollment) {
        await this.enrollments.revoke({
          enrollmentId: purchase.enrollment.id,
          actorId: null,
          ipAddress: actor.ipAddress,
          reason: 'refund',
          trigger: 'refund',
          tx,
        });
      }
    });
    return this.row(id);
  }

  /** REFUND_REQUESTED → PAID: the request is turned down and the access stays. */
  async rejectRefund(
    id: string,
    reason: string,
    actor: { actorId: string; ipAddress: string | null },
  ) {
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.purchase.updateMany({
        where: { id, status: PurchaseStatus.REFUND_REQUESTED },
        data: { status: PurchaseStatus.PAID },
      });
      if (count === 0) {
        const exists = await tx.purchase.findUnique({ where: { id }, select: { id: true } });
        if (!exists) notFound();
        throw appError(
          HttpStatus.CONFLICT,
          ERROR_CODE.CONFLICT,
          'The purchase has no refund request to reject',
        );
      }
      await this.audit.record(
        {
          actorId: actor.actorId,
          ipAddress: actor.ipAddress,
          action: 'purchase.refund_rejected',
          entityType: 'PURCHASE',
          entityId: id,
          metadata: { reason },
        },
        tx,
      );
    });
    return this.row(id);
  }

  private async row(id: string) {
    return toRow(
      await this.prisma.purchase.findUniqueOrThrow({
        where: { id },
        select: ROW_SELECT,
      }),
    );
  }
}
