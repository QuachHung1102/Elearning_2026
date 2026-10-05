import { refundBlocker, type RefundInput } from './refund-policy.js';

const NOW = new Date('2026-09-30T10:00:00.000Z');
const DAY = 86_400_000;
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY);

const eligible = (over: Partial<RefundInput> = {}): RefundInput => ({
  purchase: {
    status: 'PAID',
    priceVnd: 499_000,
    paidAt: daysAgo(2),
    refundedAt: null,
  },
  enrollmentSource: 'PURCHASE',
  progress: { completedLessons: 1, totalLessons: 10 },
  now: NOW,
  allowed: ['PAID'],
  ...over,
});

const withPurchase = (over: Partial<RefundInput['purchase']>): RefundInput =>
  eligible({ purchase: { ...eligible().purchase, ...over } });

// API_CONTRACT.md §5.8, "Chính sách hoàn tiền": three data invariants that no
// one may override, then three policy rules that `force` may.
describe('refundBlocker', () => {
  it('lets a paid, recent, barely watched purchase through', () => {
    expect(refundBlocker(eligible())).toBeNull();
  });

  describe('invariants, which force does not lift', () => {
    it.each([
      ['PENDING', 'NOT_PAID'],
      ['CANCELLED', 'NOT_PAID'],
      ['REFUNDED', 'ALREADY_REFUNDED'],
      ['REFUND_REQUESTED', 'ALREADY_REQUESTED'],
    ] as const)('a %s purchase is blocked as %s', (status, reason) => {
      for (const force of [false, true]) {
        expect(refundBlocker({ ...withPurchase({ status }), force })?.reason).toBe(reason);
      }
    });

    it('accepts a REFUND_REQUESTED purchase when the caller is the admin who decides on it', () => {
      const input = { ...withPurchase({ status: 'REFUND_REQUESTED' }), allowed: ['PAID', 'REFUND_REQUESTED'] as const };
      expect(refundBlocker(input)).toBeNull();
    });

    it('treats a PAID purchase without a payment date as not paid', () => {
      expect(refundBlocker(withPurchase({ paidAt: null }))?.reason).toBe('NOT_PAID');
    });

    it('blocks a purchase that already carries a refund date', () => {
      expect(refundBlocker(withPurchase({ refundedAt: daysAgo(1) }))?.reason).toBe('ALREADY_REFUNDED');
    });

    it.each([['MANUAL_GRANT'], [null]] as const)(
      'blocks access that does not rest on this order (%s)',
      (enrollmentSource) => {
        for (const force of [false, true]) {
          expect(refundBlocker({ ...eligible({ enrollmentSource }), force })?.reason).toBe('NOT_PURCHASED');
        }
      },
    );
  });

  describe('policy, which force lifts', () => {
    it('blocks a free course', () => {
      expect(refundBlocker(withPurchase({ priceVnd: 0 }))?.reason).toBe('FREE_COURSE');
    });

    it('allows exactly seven days and blocks anything past them', () => {
      expect(refundBlocker(withPurchase({ paidAt: daysAgo(7) }))).toBeNull();
      const late = refundBlocker(withPurchase({ paidAt: new Date(daysAgo(7).getTime() - 1) }));
      expect(late).toMatchObject({ reason: 'OUTSIDE_WINDOW', daysSincePaid: 7 });
      expect(refundBlocker(withPurchase({ paidAt: daysAgo(31) }))).toMatchObject({
        reason: 'OUTSIDE_WINDOW',
        daysSincePaid: 31,
        paidAt: daysAgo(31),
      });
    });

    it('blocks from 20% of the lessons on, by the exact ratio and not the rounded percent', () => {
      expect(refundBlocker(eligible({ progress: { completedLessons: 1, totalLessons: 5 } }))).toMatchObject({
        reason: 'PROGRESS_TOO_HIGH',
        progressPercent: 20,
      });
      // 19.6% is displayed as 20% but is still under the line.
      expect(refundBlocker(eligible({ progress: { completedLessons: 49, totalLessons: 250 } }))).toBeNull();
      expect(refundBlocker(eligible({ progress: { completedLessons: 0, totalLessons: 0 } }))).toBeNull();
    });

    it.each([
      ['a free course', withPurchase({ priceVnd: 0 })],
      ['a purchase past the window', withPurchase({ paidAt: daysAgo(31) })],
      ['a learner who watched too much', eligible({ progress: { completedLessons: 9, totalLessons: 10 } })],
    ])('force lets through %s', (_label, input) => {
      expect(refundBlocker(input)).not.toBeNull();
      expect(refundBlocker({ ...input, force: true })).toBeNull();
    });
  });

  it('reports the invariant before the policy when both apply', () => {
    const input = { ...withPurchase({ paidAt: daysAgo(31) }), enrollmentSource: 'MANUAL_GRANT' as const };
    expect(refundBlocker(input)?.reason).toBe('NOT_PURCHASED');
  });
});
