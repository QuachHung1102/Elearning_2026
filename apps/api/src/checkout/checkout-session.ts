import type { PaymentAttempt } from '../generated/prisma/client.js';
import type {
  PaymentAttemptStatus,
  PaymentProvider,
} from '../generated/prisma/enums.js';

/** `CheckoutSession` (API_CONTRACT.md §4): one QR of one order. */
export type CheckoutSession = {
  purchaseId: string;
  paymentAttemptId: string;
  /** The order code at the provider; the demo checkout page's pay button needs it. */
  appTransId: string;
  status: PaymentAttemptStatus;
  amountVnd: number;
  provider: PaymentProvider;
  qrCode: string;
  orderUrl: string;
  createdAt: Date;
  expiresAt: Date;
};

export function toSession(attempt: PaymentAttempt): CheckoutSession {
  if (attempt.qrCode === null || attempt.orderUrl === null) {
    throw new Error(`Attempt ${attempt.id} has no QR yet`);
  }
  return {
    purchaseId: attempt.purchaseId,
    paymentAttemptId: attempt.id,
    appTransId: attempt.appTransId,
    status: attempt.status,
    amountVnd: attempt.amountVnd,
    provider: attempt.provider,
    qrCode: attempt.qrCode,
    orderUrl: attempt.orderUrl,
    createdAt: attempt.createdAt,
    expiresAt: attempt.expiresAt,
  };
}
