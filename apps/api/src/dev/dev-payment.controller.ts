import { Controller, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuditActor } from '../audit/audit-actor.decorator.js';
import type { AuditActorContext } from '../audit/audit.service.js';
import { AuthRateLimitGuard } from '../auth/auth-rate-limit.guard.js';
import { RateLimit } from '../auth/rate-limit.decorator.js';
import {
  SessionAuthGuard,
  type AuthenticatedRequest,
} from '../auth/session-auth.guard.js';
import { CheckoutService } from '../checkout/checkout.service.js';
import { DemoZaloPayClient } from '../checkout/demo-zalopay.client.js';
import { ERROR_CODE, appError } from '../common/error-codes.js';
import { UserRole } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * The demo "the customer paid" button (DEMO_MODE.md §5). Registered only while
 * `PAYMENT_DRIVER=demo` (see `DevModule`), so with a real driver the route does
 * not exist at all. The buyer presses it on the checkout page; an admin may
 * press it for anyone's order.
 */
@Controller('dev/payments')
@UseGuards(SessionAuthGuard, AuthRateLimitGuard)
export class DevPaymentController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly demo: DemoZaloPayClient,
    private readonly checkout: CheckoutService,
  ) {}

  /**
   * Grants nothing itself: it marks the order paid on the provider's side, has
   * the provider sign the callback it would send, verifies that signature the
   * way the real callback route does, and hands the result to the same
   * `confirmPayment`. Pressing it twice is the duplicate callback a real
   * provider retries.
   */
  @Post(':appTransId/confirm')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ key: 'user', limit: 10, windowSeconds: 60 })
  async confirm(
    @Req() request: AuthenticatedRequest,
    @Param('appTransId') appTransId: string,
    @AuditActor() actor: AuditActorContext,
  ) {
    const attempt = await this.prisma.paymentAttempt.findUnique({
      where: { appTransId },
      select: { amountVnd: true, expiresAt: true, purchase: { select: { userId: true } } },
    });
    const { user } = request.auth;
    // Someone else's order answers like an unknown one, so ids reveal nothing.
    if (!attempt || (user.role !== UserRole.ADMIN && attempt.purchase.userId !== user.id)) {
      throw appError(HttpStatus.NOT_FOUND, ERROR_CODE.NOT_FOUND, 'Not Found');
    }

    // Amount and expiry come from the row, not from the provider's Map, so the
    // button still works after an API restart emptied it.
    const zpTransId = this.demo.settle(appTransId, attempt);
    const callback = this.demo.verifyCallback(
      this.demo.signCallback({
        appTransId,
        amountVnd: attempt.amountVnd,
        zpTransId,
      }),
    );
    const outcome = await this.checkout.confirmPayment(
      {
        appTransId: callback.app_trans_id,
        amountVnd: callback.amount,
        providerTransId: callback.zp_trans_id,
      },
      { ipAddress: actor.ipAddress },
    );
    if (outcome.status === 'REJECTED') {
      throw appError(
        HttpStatus.CONFLICT,
        ERROR_CODE.CONFLICT,
        `Payment rejected: ${outcome.reason}`,
      );
    }
    return { status: outcome.status };
  }
}
