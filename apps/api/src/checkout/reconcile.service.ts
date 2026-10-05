import {
  HttpStatus,
  Inject,
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { ERROR_CODE, appError } from '../common/error-codes.js';
import { logEvent } from '../common/logger.js';
import { config } from '../config.js';
import {
  PaymentAttemptStatus,
  PurchaseStatus,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CheckoutService, type ConfirmOutcome } from './checkout.service.js';
import { ZALOPAY_CLIENT, type ZaloPayClient } from './zalopay.client.js';

/** Attempts asked about per run; the rest wait for the next one. */
const BATCH = 50;
/** How long an order may sit unpaid, its last QR dead, before it is cancelled. */
const ABANDONED_AFTER_DAYS = 7;
const DAY_MS = 86_400_000;

export type ReconcileSummary = {
  confirmed: number;
  failed: number;
  expired: number;
  cancelled: number;
};

type Actor = { actorId: string | null; ipAddress?: string | null };
type Applied =
  | ConfirmOutcome
  | { status: 'FAILED'; changed: boolean }
  | { status: 'PROCESSING' };

/**
 * The one periodic job (DEMO_MODE.md §5): find payments whose callback was lost,
 * close QR codes that lapsed, cancel orders nobody came back to pay. One
 * `setInterval`, no scheduler dependency, no queue.
 */
@Injectable()
export class ReconcileService implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly checkout: CheckoutService,
    private readonly audit: AuditService,
    @Inject(ZALOPAY_CLIENT) private readonly client: ZaloPayClient,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      this.runOnce().catch((error) =>
        logEvent(
          { evt: 'reconcile.run_failed', error: String(error) },
          'error',
        ),
      );
    }, config.reconcileIntervalSeconds * 1_000);
    // A tick is never the reason the process stays up.
    this.timer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  /**
   * Ask, then close, then cancel — in that order. Closing first would mark an
   * attempt EXPIRED while the provider has just paid it, and the payment would
   * arrive as a "late" one instead of being confirmed on time.
   *
   * Every instance runs this. With one that is nothing to think about; with
   * several it costs extra provider calls but stays correct, because
   * `confirmPayment` is idempotent and the other two steps are conditional
   * writes. ponytail: add an advisory lock when a second instance appears.
   */
  async runOnce(now = new Date()): Promise<ReconcileSummary> {
    const summary: ReconcileSummary = {
      confirmed: 0,
      failed: 0,
      expired: 0,
      cancelled: 0,
    };
    // A run that outlives its interval must not start a second copy of itself.
    if (this.running) return summary;
    this.running = true;
    try {
      await this.askProvider(now, summary);
      summary.expired = await this.expireLapsed(now);
      summary.cancelled = await this.cancelAbandoned(now);
    } finally {
      this.running = false;
    }
    return summary;
  }

  /**
   * The admin's "ask the provider again" button for one attempt
   * (`POST /admin/payments/{attemptId}/reconcile`): the same question and the
   * same `confirmPayment` as the job, audited under the admin's id.
   */
  async reconcileAttempt(
    attemptId: string,
    actor: { actorId: string; ipAddress: string | null },
  ): Promise<{ status: PaymentAttemptStatus; changed: boolean }> {
    const attempt = await this.prisma.paymentAttempt.findUnique({
      where: { id: attemptId },
      select: { id: true, appTransId: true, status: true, expiresAt: true },
    });
    if (!attempt) {
      throw appError(HttpStatus.NOT_FOUND, ERROR_CODE.NOT_FOUND, 'Not Found');
    }
    if (attempt.status === PaymentAttemptStatus.SUCCEEDED) {
      return { status: attempt.status, changed: false };
    }

    const applied = await this.apply(attempt, actor);
    switch (applied.status) {
      case 'PAID':
      case 'DUPLICATE_PAID':
        return { status: PaymentAttemptStatus.SUCCEEDED, changed: true };
      case 'ALREADY_PROCESSED':
        return { status: PaymentAttemptStatus.SUCCEEDED, changed: false };
      case 'FAILED':
        return { status: PaymentAttemptStatus.FAILED, changed: applied.changed };
      case 'REJECTED':
        throw appError(
          HttpStatus.CONFLICT,
          ERROR_CODE.CONFLICT,
          `Payment rejected: ${applied.reason}`,
        );
      case 'PROCESSING':
        // Nothing was paid and the QR is dead: there is nothing left to wait for.
        if (
          attempt.status === PaymentAttemptStatus.EXPIRED ||
          attempt.expiresAt <= new Date()
        ) {
          throw appError(
            HttpStatus.CONFLICT,
            ERROR_CODE.PAYMENT_EXPIRED,
            'The QR code has expired',
          );
        }
        return { status: attempt.status, changed: false };
    }
  }

  /** Step 1: PENDING attempts older than RECONCILE_MIN_AGE, oldest first. */
  private async askProvider(
    now: Date,
    summary: ReconcileSummary,
  ): Promise<void> {
    const attempts = await this.prisma.paymentAttempt.findMany({
      where: {
        status: PaymentAttemptStatus.PENDING,
        // Younger ones are left to the callback that may still be in flight.
        createdAt: {
          lte: new Date(now.getTime() - config.reconcileMinAgeSeconds * 1_000),
        },
      },
      orderBy: { createdAt: 'asc' },
      take: BATCH,
      select: { id: true, appTransId: true },
    });
    for (const attempt of attempts) {
      try {
        const applied = await this.apply(attempt, { actorId: null });
        if (applied.status === 'PAID') summary.confirmed += 1;
        if (applied.status === 'FAILED' && applied.changed) summary.failed += 1;
      } catch (error) {
        // One attempt the provider cannot answer for must not starve the rest.
        logEvent(
          {
            evt: 'reconcile.attempt_failed',
            appTransId: attempt.appTransId,
            error: String(error),
          },
          'error',
        );
      }
    }
  }

  private async apply(
    attempt: { id: string; appTransId: string },
    actor: Actor,
  ): Promise<Applied> {
    const answer = await this.client.queryOrder(attempt.appTransId);
    if (answer.returnCode === 3) return { status: 'PROCESSING' };
    if (answer.returnCode === 2) {
      return {
        status: 'FAILED',
        changed: await this.fail(attempt, answer.returnMessage, actor),
      };
    }
    if (answer.zpTransId === undefined || answer.amountVnd === undefined) {
      throw new Error('The provider reported a payment without an id or amount');
    }
    return this.checkout.confirmPayment(
      {
        appTransId: attempt.appTransId,
        amountVnd: answer.amountVnd,
        providerTransId: answer.zpTransId,
      },
      { reconciledBy: { actorId: actor.actorId }, ipAddress: actor.ipAddress },
    );
  }

  /** PENDING → FAILED, once. The order stays open: the learner can try again. */
  private fail(
    attempt: { id: string; appTransId: string },
    reason: string,
    actor: Actor,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.paymentAttempt.updateMany({
        where: { id: attempt.id, status: PaymentAttemptStatus.PENDING },
        data: {
          status: PaymentAttemptStatus.FAILED,
          failureReason: reason.slice(0, 200),
        },
      });
      if (count === 0) return false;
      await this.audit.record(
        {
          actorId: actor.actorId,
          ipAddress: actor.ipAddress ?? null,
          action: 'payment.reconciled',
          entityType: 'PAYMENT_ATTEMPT',
          entityId: attempt.id,
          metadata: {
            appTransId: attempt.appTransId,
            fromStatus: PaymentAttemptStatus.PENDING,
            toStatus: PaymentAttemptStatus.FAILED,
          },
        },
        tx,
      );
      return true;
    });
  }

  /** Step 2: still PENDING past `expiresAt` → EXPIRED, one conditional write. */
  private expireLapsed(now: Date): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const lapsed = await tx.paymentAttempt.updateManyAndReturn({
        where: {
          status: PaymentAttemptStatus.PENDING,
          expiresAt: { lt: now },
        },
        data: { status: PaymentAttemptStatus.EXPIRED },
        select: { id: true, appTransId: true },
      });
      for (const attempt of lapsed) {
        await this.audit.record(
          {
            actorId: null,
            ipAddress: null,
            action: 'payment.reconciled',
            entityType: 'PAYMENT_ATTEMPT',
            entityId: attempt.id,
            metadata: {
              appTransId: attempt.appTransId,
              fromStatus: PaymentAttemptStatus.PENDING,
              toStatus: PaymentAttemptStatus.EXPIRED,
            },
          },
          tx,
        );
      }
      return lapsed.length;
    });
  }

  /**
   * Step 3: a PENDING order whose every QR is dead and lapsed more than seven
   * days ago is CANCELLED, which frees the learner's slot in the partial unique
   * index (DATA_MODEL.md §PurchaseStatus).
   */
  private async cancelAbandoned(now: Date): Promise<number> {
    const cutoff = new Date(now.getTime() - ABANDONED_AFTER_DAYS * DAY_MS);
    const noLiveQr = {
      some: {},
      none: {
        OR: [
          {
            status: {
              in: [PaymentAttemptStatus.PENDING, PaymentAttemptStatus.SUCCEEDED],
            },
          },
          { expiresAt: { gte: cutoff } },
        ],
      },
    };
    const candidates = await this.prisma.purchase.findMany({
      where: { status: PurchaseStatus.PENDING, attempts: noLiveQr },
      take: BATCH,
      select: { id: true, userId: true },
    });

    let cancelled = 0;
    for (const { id, userId } of candidates) {
      cancelled += await this.prisma.$transaction(async (tx) => {
        // The learner's checkout takes this lock too: a QR opened while we
        // decide either lands first (and we see it) or waits for us.
        await tx.$queryRaw`
          SELECT 1 FROM users WHERE id = ${userId}::uuid FOR NO KEY UPDATE`;
        const stillAbandoned = await tx.purchase.count({
          where: { id, status: PurchaseStatus.PENDING, attempts: noLiveQr },
        });
        if (stillAbandoned === 0) return 0;
        const last = await tx.paymentAttempt.findFirstOrThrow({
          where: { purchaseId: id },
          orderBy: { createdAt: 'desc' },
          select: { id: true, expiresAt: true },
        });
        await tx.purchase.update({
          where: { id },
          data: { status: PurchaseStatus.CANCELLED },
        });
        await this.audit.record(
          {
            actorId: null,
            ipAddress: null,
            action: 'purchase.cancelled',
            entityType: 'PURCHASE',
            entityId: id,
            metadata: {
              lastAttemptId: last.id,
              expiredAt: last.expiresAt.toISOString(),
            },
          },
          tx,
        );
        return 1;
      });
    }
    return cancelled;
  }
}
