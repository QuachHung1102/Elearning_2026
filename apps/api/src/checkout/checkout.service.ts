import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { ERROR_CODE, appError } from '../common/error-codes.js';
import { logEvent } from '../common/logger.js';
import { config } from '../config.js';
import { EnrollmentService } from '../enrollment/enrollment.service.js';
import { escapeHtml, MAILER, sendQuietly, type Mailer } from '../mail/mailer.js';
import type { Prisma } from '../generated/prisma/client.js';
import {
  CourseStatus,
  EnrollmentSource,
  EnrollmentStatus,
  PaymentAttemptStatus,
  PaymentProvider,
  PurchaseStatus,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { newAppTransId } from './app-trans-id.js';
import { toSession, type CheckoutSession } from './checkout-session.js';
import { ZALOPAY_CLIENT, type ZaloPayClient } from './zalopay.client.js';

type Tx = Prisma.TransactionClient;

const PROVIDER =
  config.paymentDriver === 'zalopay'
    ? PaymentProvider.ZALOPAY
    : PaymentProvider.DEMO;

const VND = new Intl.NumberFormat('vi-VN');

/** The three states in which an order still holds its (user, course) slot. */
const OPEN_PURCHASE = [
  PurchaseStatus.PENDING,
  PurchaseStatus.PAID,
  PurchaseStatus.REFUND_REQUESTED,
];

/** What the provider says was paid: a callback body and `queryOrder` both reduce to this. */
export type PaidPayment = {
  appTransId: string;
  amountVnd: number;
  /** `zp_trans_id`. */
  providerTransId: string;
};

export type ConfirmContext = {
  /**
   * Set by reconcile: an admin's id, or `null` for the periodic job. The change
   * is then also audited as `payment.reconciled`, as it is for a late payment.
   */
  reconciledBy?: { actorId: string | null };
  ipAddress?: string | null;
};

export type RejectReason =
  | 'unknown_app_trans_id'
  | 'amount_mismatch'
  | 'attempt_closed'
  | 'purchase_cancelled'
  | 'purchase_refunded';

type Receipt = {
  email: string;
  displayName: string;
  courseTitle: string;
  priceVnd: number;
};

export type ConfirmOutcome =
  /** First payment of the order: the course is unlocked, the receipt is due. */
  | {
      status: 'PAID';
      purchaseId: string;
      userId: string;
      courseId: string;
      /** Everything the receipt mail needs, read in the same transaction. */
      receipt: Receipt;
    }
  /** A repeat of a payment already recorded: nothing changed. */
  | { status: 'ALREADY_PROCESSED' }
  /** Another attempt of the same order was paid first; this money needs a refund. */
  | { status: 'DUPLICATE_PAID'; purchaseId: string }
  | { status: 'REJECTED'; reason: RejectReason };

const CLOSED_PURCHASE: Partial<Record<PurchaseStatus, RejectReason>> = {
  [PurchaseStatus.CANCELLED]: 'purchase_cancelled',
  [PurchaseStatus.REFUNDED]: 'purchase_refunded',
};

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly enrollments: EnrollmentService,
    private readonly audit: AuditService,
    @Inject(ZALOPAY_CLIENT) private readonly zalopay: ZaloPayClient,
    @Inject(MAILER) private readonly mailer: Mailer,
  ) {}

  /**
   * `POST /checkout/{courseSlug}`. Returns the live QR of the learner's open
   * order if there is one (`created: false`), else opens a new attempt.
   *
   * The order and the attempt are committed *before* the provider is called
   * (DEMO_MODE.md §5): the network must not run inside a transaction, and a
   * response lost on the way back leaves a PENDING row that reconcile can
   * look up by `appTransId`, instead of a paid order nobody knows about.
   */
  async createCheckout(
    user: { id: string; emailVerifiedAt: Date | null },
    courseSlug: string,
  ): Promise<{ session: CheckoutSession; created: boolean }> {
    const course = await this.prisma.course.findUnique({
      where: { slug: courseSlug },
      select: { id: true, title: true, status: true, priceVnd: true },
    });
    // A DRAFT is not for sale and, to a buyer, does not exist (P4-2).
    if (!course || course.status === CourseStatus.DRAFT) {
      throw appError(HttpStatus.NOT_FOUND, ERROR_CODE.NOT_FOUND, 'Not Found');
    }
    if (!user.emailVerifiedAt) {
      throw appError(
        HttpStatus.FORBIDDEN,
        ERROR_CODE.EMAIL_NOT_VERIFIED,
        'Verify your email before paying',
      );
    }
    if (course.status === CourseStatus.ARCHIVED || course.priceVnd <= 0) {
      throw appError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        ERROR_CODE.COURSE_NOT_PURCHASABLE,
        'This course is not for sale',
      );
    }

    const opened = await this.prisma.$transaction(async (tx) => {
      // One checkout per learner at a time. Without it a double click races two
      // inserts into the partial unique index and one of them becomes a 409.
      await tx.$queryRaw`
        SELECT 1 FROM users WHERE id = ${user.id}::uuid FOR NO KEY UPDATE`;

      const enrollment = await tx.enrollment.findUnique({
        where: { userId_courseId: { userId: user.id, courseId: course.id } },
        select: { status: true },
      });
      const now = new Date();
      const open = await tx.purchase.findFirst({
        where: {
          userId: user.id,
          courseId: course.id,
          status: { in: OPEN_PURCHASE },
        },
        include: {
          // A QR is reusable only once the provider has answered: an attempt
          // still without `qrCode` belongs to a request in flight.
          attempts: {
            where: {
              status: PaymentAttemptStatus.PENDING,
              expiresAt: { gt: now },
              qrCode: { not: null },
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });
      // A PAID order whose access was revoked by hand is still bought.
      if (
        enrollment?.status === EnrollmentStatus.ACTIVE ||
        (open && open.status !== PurchaseStatus.PENDING)
      ) {
        throw appError(
          HttpStatus.CONFLICT,
          ERROR_CODE.ALREADY_ENROLLED,
          'You already own this course',
        );
      }
      if (open?.attempts[0]) return { attempt: open.attempts[0], created: false };

      // The order and its QR are charged the same amount, so an unpaid order
      // follows the course price when a new QR is opened.
      const purchase = !open
        ? await tx.purchase.create({
            data: {
              userId: user.id,
              courseId: course.id,
              priceVnd: course.priceVnd,
            },
          })
        : open.priceVnd === course.priceVnd
          ? open
          : await tx.purchase.update({
              where: { id: open.id },
              data: { priceVnd: course.priceVnd },
            });
      const attempt = await tx.paymentAttempt.create({
        data: {
          purchaseId: purchase.id,
          provider: PROVIDER,
          appTransId: newAppTransId(now),
          amountVnd: course.priceVnd,
          expiresAt: new Date(
            now.getTime() + config.checkoutQrTtlMinutes * 60_000,
          ),
        },
      });
      return { attempt, created: true };
    });
    if (!opened.created) {
      return { session: toSession(opened.attempt), created: false };
    }

    const { attempt } = opened;
    const order = await this.zalopay.createOrder({
      appTransId: attempt.appTransId,
      appUser: user.id,
      amountVnd: attempt.amountVnd,
      description: `Thanh toán khóa học ${course.title}`.slice(0, 200),
      embedData: { courseId: course.id, purchaseId: attempt.purchaseId },
      expiresAt: attempt.expiresAt,
    });
    const stored = await this.prisma.paymentAttempt.update({
      where: { id: attempt.id },
      data: { qrCode: order.qrCode, orderUrl: order.orderUrl },
    });
    logEvent({
      evt: 'checkout.created',
      purchaseId: attempt.purchaseId,
      appTransId: attempt.appTransId,
      amountVnd: attempt.amountVnd,
    });
    return { session: toSession(stored), created: true };
  }

  /**
   * The one function behind the real callback, the reconcile job and the demo
   * confirm button. The caller has already verified the provider's signature;
   * everything else is checked here, in one transaction.
   *
   * Idempotency is the conditional `updateMany`, not a unique index: a repeat
   * carries the same `app_trans_id`, resolves to the same row, and finds it no
   * longer PENDING. Only the writer that flips it goes on to touch the order,
   * the enrollment and the counter.
   */
  async confirmPayment(
    paid: PaidPayment,
    context: ConfirmContext = {},
  ): Promise<ConfirmOutcome> {
    const outcome = await this.recordPayment(paid, context);
    logEvent({
      evt: 'payment.confirmed',
      status: outcome.status,
      appTransId: paid.appTransId,
      ...('purchaseId' in outcome ? { purchaseId: outcome.purchaseId } : {}),
      ...(outcome.status === 'REJECTED' ? { reason: outcome.reason } : {}),
    });
    // After the commit, and only for the first payment: the order is paid
    // whether or not the mail goes out, and a repeat must not mail twice.
    if (outcome.status === 'PAID') await this.sendReceipt(outcome);
    return outcome;
  }

  private async recordPayment(
    paid: PaidPayment,
    context: ConfirmContext,
  ): Promise<ConfirmOutcome> {
    const { appTransId } = paid;
    const ipAddress = context.ipAddress ?? null;

    return this.prisma.$transaction(async (tx) => {
      const attempt = await tx.paymentAttempt.findUnique({
        where: { appTransId },
        include: {
          purchase: {
            include: {
              user: { select: { email: true, displayName: true } },
              course: { select: { title: true } },
            },
          },
        },
      });
      const reject = async (reason: RejectReason, extra: object = {}) => {
        await this.audit.record(
          {
            actorId: null,
            ipAddress,
            action: 'payment.callback_rejected',
            entityType: 'PAYMENT_ATTEMPT',
            entityId: attempt?.id ?? null,
            metadata: { appTransId, rejectReason: reason, ...extra },
          },
          tx,
        );
        return { status: 'REJECTED', reason } as const;
      };

      if (!attempt) return reject('unknown_app_trans_id');
      if (attempt.amountVnd !== paid.amountVnd) {
        return reject('amount_mismatch', {
          expectedAmountVnd: attempt.amountVnd,
          paidAmountVnd: paid.amountVnd,
        });
      }

      const now = new Date();
      // EXPIRED is accepted on purpose (P4-4): the customer may have paid just
      // before the QR timed out, and money already collected must unlock the
      // course. No other closed state is.
      const { count } = await tx.paymentAttempt.updateMany({
        where: {
          appTransId,
          status: {
            in: [PaymentAttemptStatus.PENDING, PaymentAttemptStatus.EXPIRED],
          },
        },
        data: {
          status: PaymentAttemptStatus.SUCCEEDED,
          providerTransId: paid.providerTransId,
          paidAt: now,
        },
      });
      if (count === 0) {
        const { status } = await tx.paymentAttempt.findUniqueOrThrow({
          where: { appTransId },
          select: { status: true },
        });
        return status === PaymentAttemptStatus.SUCCEEDED
          ? { status: 'ALREADY_PROCESSED' }
          : reject('attempt_closed');
      }

      const late = attempt.status === PaymentAttemptStatus.EXPIRED;
      if (late || context.reconciledBy) {
        await this.audit.record(
          {
            actorId: context.reconciledBy?.actorId ?? null,
            ipAddress,
            action: 'payment.reconciled',
            entityType: 'PAYMENT_ATTEMPT',
            entityId: attempt.id,
            metadata: {
              appTransId,
              fromStatus: attempt.status,
              toStatus: PaymentAttemptStatus.SUCCEEDED,
              ...(late ? { late: true } : {}),
            },
          },
          tx,
        );
      }

      const { purchase } = attempt;
      const opened = await tx.purchase.updateMany({
        where: { id: purchase.id, status: PurchaseStatus.PENDING },
        data: { status: PurchaseStatus.PAID, paidAt: now },
      });
      if (opened.count === 1) {
        return this.unlock(tx, attempt, ipAddress);
      }

      const current = await tx.purchase.findUniqueOrThrow({
        where: { id: purchase.id },
        select: { status: true },
      });
      const closed = CLOSED_PURCHASE[current.status];
      // The attempt stays SUCCEEDED either way: the money did arrive.
      if (closed) return reject(closed);

      const first = await tx.paymentAttempt.findFirst({
        where: {
          purchaseId: purchase.id,
          status: PaymentAttemptStatus.SUCCEEDED,
          id: { not: attempt.id },
        },
        orderBy: { paidAt: 'asc' },
        select: { id: true },
      });
      await this.audit.record(
        {
          actorId: null,
          ipAddress,
          action: 'payment.duplicate_paid',
          entityType: 'PAYMENT_ATTEMPT',
          entityId: attempt.id,
          metadata: {
            appTransId,
            purchaseId: purchase.id,
            firstAttemptId: first?.id ?? null,
          },
        },
        tx,
      );
      return { status: 'DUPLICATE_PAID', purchaseId: purchase.id };
    });
  }

  /** The order just became PAID by this transaction: grant, audit, report. */
  private async unlock(
    tx: Tx,
    attempt: { id: string; appTransId: string; purchase: PurchaseRow },
    ipAddress: string | null,
  ): Promise<ConfirmOutcome> {
    const { purchase } = attempt;
    await this.enrollments.grant({
      userId: purchase.userId,
      courseId: purchase.courseId,
      source: EnrollmentSource.PURCHASE,
      actorId: null,
      purchaseId: purchase.id,
      ipAddress,
      tx,
    });
    await this.audit.record(
      {
        actorId: null,
        ipAddress,
        action: 'purchase.paid',
        entityType: 'PURCHASE',
        entityId: purchase.id,
        metadata: {
          courseId: purchase.courseId,
          priceVnd: purchase.priceVnd,
          appTransId: attempt.appTransId,
        },
      },
      tx,
    );
    return {
      status: 'PAID',
      purchaseId: purchase.id,
      userId: purchase.userId,
      courseId: purchase.courseId,
      receipt: {
        email: purchase.user.email,
        displayName: purchase.user.displayName,
        courseTitle: purchase.course.title,
        priceVnd: purchase.priceVnd,
      },
    };
  }

  /** "Đơn hàng {courseTitle} đã thanh toán" (API_CONTRACT.md §2.5b): a link to the order page, no token. */
  private sendReceipt(paid: { purchaseId: string; receipt: Receipt }): Promise<void> {
    const { receipt } = paid;
    const link = `${config.webOrigin}/account/orders/${paid.purchaseId}`;
    const amount = `${VND.format(receipt.priceVnd)} ₫`;
    return sendQuietly(this.mailer, {
      to: receipt.email,
      subject: `Đơn hàng ${receipt.courseTitle} đã thanh toán`,
      text: `Xin chào ${receipt.displayName}. Bạn đã thanh toán ${amount} cho khóa học "${receipt.courseTitle}". Xem đơn hàng tại ${link}.`,
      html: `<!doctype html><html lang="vi"><body><p>Xin chào ${escapeHtml(receipt.displayName)},</p><p>Bạn đã thanh toán ${escapeHtml(amount)} cho khóa học <strong>${escapeHtml(receipt.courseTitle)}</strong>. Khóa học đã sẵn sàng để học.</p><p><a href="${escapeHtml(link)}">Xem đơn hàng</a></p><p>E-learning</p></body></html>`,
      tag: 'purchase-receipt',
    });
  }
}

type PurchaseRow = {
  id: string;
  userId: string;
  courseId: string;
  priceVnd: number;
  user: { email: string; displayName: string };
  course: { title: string };
};
