import { HttpException, HttpStatus } from '@nestjs/common';
import { ERROR_CODE } from './error-codes.js';

/**
 * 429 with the seconds to wait. Whoever refuses a client (the route guard, the
 * callback, a login) throws this and does not touch the response:
 * `AppExceptionFilter` turns `retryAfterSeconds` into the `Retry-After` header.
 */
export class RateLimitedError extends HttpException {
  constructor(readonly retryAfterSeconds: number) {
    super(
      { code: ERROR_CODE.RATE_LIMITED, message: 'Too many requests' },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
