import {
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Param,
  Post,
} from '@nestjs/common';
import { AuditActor } from '../audit/audit-actor.decorator.js';
import type { AuditActorContext } from '../audit/audit.service.js';
import { SkipCsrf } from '../auth/csrf.guard.js';
import { ERROR_CODE, appError } from '../common/error-codes.js';
import { logEvent } from '../common/logger.js';
import { RateLimitedError } from '../common/rate-limited.error.js';
import { RateLimiter } from '../common/rate-limiter.js';
import { CheckoutService, type ConfirmOutcome } from './checkout.service.js';
import { ZALOPAY_CLIENT, type ZaloPayClient } from './zalopay.client.js';

/** The answer the provider reads (API_CONTRACT.md §5.8). Always sent with HTTP 200. */
type Reply = { return_code: 1 | 0 | -1; return_message: string };
const reply = (return_code: Reply['return_code'], return_message: string): Reply => ({
  return_code,
  return_message,
});

/** `{ data, mac }` with both a non-empty string, or `null`; `type` is read apart. */
function readEnvelope(body: unknown): { data: string; mac: string; type: unknown } | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;
  const { data, mac, type } = body as Record<string, unknown>;
  return typeof data === 'string' && data && typeof mac === 'string' && mac
    ? { data, mac, type }
    : null;
}

/** API_CONTRACT.md §8: how many callbacks without a valid signature one client may send. */
const UNAUTHENTICATED = { limit: 20, windowSeconds: 60 } as const;

/**
 * The provider's callback. Nothing here is trusted until the signature holds,
 * and every path answers HTTP 200 with a `return_code`: a 4xx only makes the
 * provider retry for nothing. `0` is reserved for our own failures, so a
 * database blip is retried and a bad request is not.
 *
 * The one exception is a client that keeps sending callbacks without a valid
 * signature (none, or the wrong one): past the limit it gets 429. Only those
 * are counted. A callback whose signature holds is never counted or refused,
 * because turning a real payment away would lose money.
 */
@Controller('payments')
export class PaymentCallbackController {
  // ponytail: per-process, like the route guard's counters; see `RateLimiter`.
  private readonly unauthenticated = new RateLimiter();

  constructor(
    @Inject(ZALOPAY_CLIENT) private readonly client: ZaloPayClient,
    private readonly checkout: CheckoutService,
  ) {}

  @Post(':provider/callback')
  @SkipCsrf()
  @HttpCode(HttpStatus.OK)
  async callback(
    @Param('provider') provider: string,
    @Body() body: unknown,
    @AuditActor() actor: AuditActorContext,
  ): Promise<Reply> {
    if (provider !== 'zalopay') {
      throw appError(HttpStatus.NOT_FOUND, ERROR_CODE.NOT_FOUND, 'Not Found');
    }
    const envelope = readEnvelope(body);
    if (!envelope) {
      return this.unsigned(actor, reply(-1, 'invalid body'));
    }
    // Only orders (type 1); a token agreement (2) is not something we sell.
    if (envelope.type !== undefined && envelope.type !== 1) {
      return reply(-1, 'unsupported type');
    }

    let paid;
    try {
      paid = this.client.verifyCallback(envelope);
    } catch (error) {
      if (error instanceof HttpException) {
        const code = (error.getResponse() as { code?: string }).code;
        return code === ERROR_CODE.SIGNATURE_INVALID
          ? this.unsigned(actor, reply(-1, 'mac not equal'))
          : reply(-1, 'invalid data');
      }
      throw error;
    }
    const { app_trans_id: appTransId, amount, zp_trans_id: zpTransId } = paid;
    if (
      typeof appTransId !== 'string' ||
      !appTransId ||
      !Number.isInteger(amount) ||
      amount <= 0 ||
      (typeof zpTransId !== 'string' && typeof zpTransId !== 'number')
    ) {
      return reply(-1, 'invalid data');
    }

    try {
      const outcome = await this.checkout.confirmPayment(
        { appTransId, amountVnd: amount, providerTransId: String(zpTransId) },
        { ipAddress: actor.ipAddress },
      );
      return answerFor(outcome);
    } catch (error) {
      logEvent(
        { evt: 'payment.callback_failed', appTransId, error: String(error) },
        'error',
      );
      return reply(0, 'retry');
    }
  }

  /** A callback with no valid signature: the usual answer, until this client has sent too many. */
  private unsigned(actor: AuditActorContext, answer: Reply): Reply {
    const retryAfter = this.unauthenticated.hit(
      actor.ipAddress ?? 'unknown',
      UNAUTHENTICATED.limit,
      UNAUTHENTICATED.windowSeconds,
    );
    if (retryAfter === null) return answer;
    throw new RateLimitedError(retryAfter);
  }
}

function answerFor(outcome: ConfirmOutcome): Reply {
  if (outcome.status !== 'REJECTED') return reply(1, 'success');
  switch (outcome.reason) {
    case 'amount_mismatch':
      return reply(-1, 'amount mismatch');
    case 'unknown_app_trans_id':
      return reply(-1, 'unknown order');
    default:
      // The order or the attempt was already closed on our side. The money is
      // recorded and flagged for a person (`payment.callback_rejected`);
      // retrying would only repeat it.
      return reply(1, 'success');
  }
}
