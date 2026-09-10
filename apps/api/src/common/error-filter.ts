import { STATUS_CODES } from 'node:http';
import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import { ERROR_CODE, type ErrorCode } from './error-codes.js';
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
  [HttpStatus.PAYLOAD_TOO_LARGE]: ERROR_CODE.PAYLOAD_TOO_LARGE,
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: ERROR_CODE.UNSUPPORTED_MEDIA_TYPE,
  [HttpStatus.TOO_MANY_REQUESTS]: ERROR_CODE.RATE_LIMITED,
};

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<RequestWithId>();
    const response = http.getResponse<Response>();
    const status = this.status(exception);
    const source =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const body: ExceptionBody =
      typeof source === 'object' && source !== null ? source : {};
    const internal = status >= 500;

    response.status(status).json({
      statusCode: status,
      code:
        body.code ??
        DEFAULT_CODE[status] ??
        (internal ? ERROR_CODE.INTERNAL : ERROR_CODE.VALIDATION_FAILED),
      message: internal
        ? 'Internal server error'
        : status === HttpStatus.NOT_FOUND
          ? 'Not Found'
          : (body.message ??
            (typeof source === 'string' ? source : this.message(exception))),
      error: body.error ?? STATUS_CODES[status] ?? 'Error',
      ...(body.details === undefined ? {} : { details: body.details }),
      ...(internal ? { requestId: request.requestId } : {}),
    });
  }

  private status(exception: unknown): number {
    if (exception instanceof HttpException) return exception.getStatus();
    const status = (exception as { status?: unknown })?.status;
    return typeof status === 'number'
      ? status
      : HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private message(exception: unknown): string {
    return exception instanceof Error ? exception.message : 'Request failed';
  }
}
