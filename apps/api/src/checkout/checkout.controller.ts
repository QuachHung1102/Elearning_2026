import {
  Controller,
  Header,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Matches } from 'class-validator';
import type { Response } from 'express';
import { AuthRateLimitGuard } from '../auth/auth-rate-limit.guard.js';
import { RateLimit } from '../auth/rate-limit.decorator.js';
import {
  SessionAuthGuard,
  type AuthenticatedRequest,
} from '../auth/session-auth.guard.js';
import { SLUG_PATTERN } from '../catalog/slug.js';
import { CheckoutService } from './checkout.service.js';

export class CheckoutParam {
  @Matches(SLUG_PATTERN)
  courseSlug: string;
}

/** Learner checkout (API_CONTRACT.md §5.8). Every route needs a session. */
@Controller('checkout')
@UseGuards(SessionAuthGuard, AuthRateLimitGuard)
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  /** `201` for a new QR, `200` when the QR that is still valid is handed back. */
  @Post(':courseSlug')
  @Header('Cache-Control', 'no-store')
  // Opening a QR is the expensive call on the provider's side.
  @RateLimit({ key: 'user', limit: 5, windowSeconds: 300 })
  async create(
    @Req() request: AuthenticatedRequest,
    @Param() params: CheckoutParam,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { session, created } = await this.checkout.createCheckout(
      request.auth.user,
      params.courseSlug,
    );
    response.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return session;
  }
}
