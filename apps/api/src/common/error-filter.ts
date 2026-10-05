import { STATUS_CODES } from 'node:http';
import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '../generated/prisma/client.js';
import { ERROR_CODE, type ErrorCode } from './error-codes.js';
import { logEvent } from './logger.js';
import { isSlugConflict } from './prisma-errors.js';
import { RateLimitedError } from './rate-limited.error.js';
import type { RequestWithId } from './request-id.middleware.js';

type ExceptionBody = {
  code?: ErrorCode;
  message?: string | string[];
  error?: string;
  details?: object;
};

const DEFAULT_CODE: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: ERROR_CODE.VALIDATION_FAILED,
  [HttpStatus.UNAUTHORIZED]: ERROR_CODE.UNAUTHENTICATED,
  [HttpStatus.FORBIDDEN]: ERROR_CODE.CSRF_INVALID,
  [HttpStatus.NOT_FOUND]: ERROR_CODE.NOT_FOUND,
  [HttpStatus.CONFLICT]: ERROR_CODE.CONFLICT,
  [HttpStatus.PAYLOAD_TOO_LARGE]: ERROR_CODE.PAYLOAD_TOO_LARGE,
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: ERROR_CODE.UNSUPPORTED_MEDIA_TYPE,
  [HttpStatus.TOO_MANY_REQUESTS]: ERROR_CODE.RATE_LIMITED,
};

/**
 * Constraint races a service cannot pre-check (two writers, one slug) arrive
 * as Prisma errors. Any other Prisma code stays an unexpected 500.
 */
const PRISMA_STATUS: Record<string, HttpStatus> = {
  P2002: HttpStatus.CONFLICT,
  P2025: HttpStatus.NOT_FOUND,
};

type ErrorLogger = { error(message: string, stack?: string): void };

/** One JSON line on stderr, under the request's id (see `logEvent`). */
const structuredLogger: ErrorLogger = {
  error: (message, stack) => logEvent({ evt: 'http.error', message, stack }, 'error'),
};

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: ErrorLogger = structuredLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<RequestWithId>();
    const response = http.getResponse<Response>();
    // A stream that failed after the status line went out (a `<video>` that
    // aborts a range request on every seek) has nothing left to report to:
    // writing a JSON body now would throw ERR_HTTP_HEADERS_SENT.
    if (response.headersSent) {
      response.end();
      return;
    }
    const status = this.status(exception);
    if (exception instanceof RateLimitedError) {
      response.setHeader('Retry-After', exception.retryAfterSeconds);
    }
    const source =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const body: ExceptionBody =
      typeof source === 'object' && source !== null ? source : {};
    const internal = status >= 500;
    if (internal) {
      // The client only gets `requestId`; this line is where it leads to a
      // cause. `path`, not `url`: a signed media URL carries its signature in
      // the query string.
      this.logger.error(
        `${request.method} ${request.path} -> ${status} requestId=${request.requestId}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      statusCode: status,
      code:
        body.code ??
        // Two writers with one title: the loser is told in the words the web has.
        (isSlugConflict(exception) ? ERROR_CODE.SLUG_TAKEN : undefined) ??
        DEFAULT_CODE[status] ??
        (internal ? ERROR_CODE.INTERNAL : ERROR_CODE.VALIDATION_FAILED),
      message: internal
        ? 'Internal server error'
        : status === HttpStatus.NOT_FOUND
          ? 'Not Found'
          : exception instanceof Prisma.PrismaClientKnownRequestError
            ? isSlugConflict(exception)
              ? 'Slug is already taken'
              : 'Conflict' // its own text names the model and column
            : (body.message ??
              (typeof source === 'string' ? source : this.message(exception))),
      error: body.error ?? STATUS_CODES[status] ?? 'Error',
      ...(body.details === undefined ? {} : { details: body.details }),
      ...(internal ? { requestId: request.requestId } : {}),
    });
  }

  private status(exception: unknown): number {
    if (exception instanceof HttpException) return exception.getStatus();
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return PRISMA_STATUS[exception.code] ?? HttpStatus.INTERNAL_SERVER_ERROR;
    }
    const status = (exception as { status?: unknown })?.status;
    return typeof status === 'number'
      ? status
      : HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private message(exception: unknown): string {
    return exception instanceof Error ? exception.message : 'Request failed';
  }
}
