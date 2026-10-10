import { EnrollmentSource, PurchaseStatus } from '../generated/prisma/enums.js';

export const REFUND_WINDOW_DAYS = 7;
const DAY_MS = 86_400_000;

export type RefundBlockReason =
  | 'NOT_PAID'
  | 'ALREADY_REQUESTED'
  | 'ALREADY_REFUNDED'
  | 'NOT_PURCHASED'
  | 'FREE_COURSE'
  | 'OUTSIDE_WINDOW'
  | 'PROGRESS_TOO_HIGH';

export type RefundInput = {
  purchase: {
    status: PurchaseStatus;
    priceVnd: number;
    paidAt: Date | null;
    refundedAt: Date | null;
  };
  /** Source of the enrollment linked to this order; `null` when there is none. */
  enrollmentSource: EnrollmentSource | null;
  progress: { completedLessons: number; totalLessons: number };
  now: Date;
  /** The learner asks from PAID; the admin who decides may also act on REFUND_REQUESTED. */
  allowed: readonly PurchaseStatus[];
  /** Lifts the three policy rules only, never the invariants above them. */
  force?: boolean;
};

/** Everything the 409 `details` of API_CONTRACT.md §5.8 carries. */
export type RefundBlock = {
  reason: RefundBlockReason;
  paidAt: Date | null;
  daysSincePaid: number | null;
  progressPercent: number;
};

/**
 * Why a purchase may not be refunded, or `null` when it may. Free of I/O so
 * every branch is unit tested (API_CONTRACT.md §5.8, "Chính sách hoàn tiền").
 *
 * Invariants come first and no `force` lifts them: a refund of an order that
 * is not paid, is already refunded, or never unlocked the course is a data
 * error, not a policy call. The policy rules (free course, seven days, under
 * 20% of the lessons) are the owner's to waive.
 */
export function refundBlocker(input: RefundInput): RefundBlock | null {
  const { purchase, progress, now } = input;
  const daysSincePaid = purchase.paidAt
    ? Math.floor((now.getTime() - purchase.paidAt.getTime()) / DAY_MS)
    : null;
  const progressPercent = progress.totalLessons
    ? Math.round((100 * progress.completedLessons) / progress.totalLessons)
    : 0;
  const block = (reason: RefundBlockReason): RefundBlock => ({
    reason,
    paidAt: purchase.paidAt,
    daysSincePaid,
    progressPercent,
  });

  if (purchase.status === PurchaseStatus.REFUNDED || purchase.refundedAt) {
    return block('ALREADY_REFUNDED');
  }
  if (!input.allowed.includes(purchase.status)) {
    return block(
      purchase.status === PurchaseStatus.REFUND_REQUESTED
        ? 'ALREADY_REQUESTED'
        : 'NOT_PAID',
    );
  }
  if (!purchase.paidAt) return block('NOT_PAID');
  if (input.enrollmentSource !== EnrollmentSource.PURCHASE) {
    return block('NOT_PURCHASED');
  }
  if (input.force) return null;

  if (purchase.priceVnd <= 0) return block('FREE_COURSE');
  if (now.getTime() - purchase.paidAt.getTime() > REFUND_WINDOW_DAYS * DAY_MS) {
    return block('OUTSIDE_WINDOW');
  }
  // The exact ratio, not `percent`: 49 of 250 lessons shows as 20% but is 19.6%.
  if (
    progress.totalLessons > 0 &&
    progress.completedLessons * 5 >= progress.totalLessons
  ) {
    return block('PROGRESS_TOO_HIGH');
  }
  return null;
}
