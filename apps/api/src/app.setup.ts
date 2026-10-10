import {
  HttpException,
  HttpStatus,
  ValidationPipe,
  type ValidationError,
} from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { raw } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { AppExceptionFilter } from './common/error-filter.js';
import { ERROR_CODE } from './common/error-codes.js';
import { requestIdMiddleware } from './common/request-id.middleware.js';
import { requestLog } from './common/request-log.middleware.js';
import { securityHeaders } from './common/security-headers.middleware.js';
import { config } from './config.js';

function validationException(errors: ValidationError[]): HttpException {
  const message = errors.flatMap((error) =>
    error.constraints ? Object.values(error.constraints) : [],
  );
  const details = Object.fromEntries(
    errors.flatMap((error) => {
      const constraint = error.constraints
        ? Object.keys(error.constraints)[0]
        : undefined;
      return constraint ? [[error.property, constraint]] : [];
    }),
  );
  return new HttpException(
    {
      code: ERROR_CODE.VALIDATION_FAILED,
      message,
      error: 'Bad Request',
      details,
    },
    HttpStatus.BAD_REQUEST,
  );
}

/** Everything under /admin is per-admin data; none of it may be cached. */
export function noStoreForAdmin(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  // Case-insensitive like Express routing: `/API/V1/ADMIN/x` is the same route.
  if (/^\/api\/v1\/admin/i.test(request.path)) {
    response.setHeader('Cache-Control', 'no-store');
  }
  next();
}

export function configureApp(
  app: NestExpressApplication,
  {
    localFiles = config.servesLocalFiles,
    hsts = config.isProduction,
    logRequests = config.logRequests,
  }: { localFiles?: boolean; hsts?: boolean; logRequests?: boolean } = {},
): void {
  app.disable('x-powered-by');
  app.setGlobalPrefix('/api/v1');
  app.use(requestIdMiddleware);
  if (logRequests) app.use(requestLog);
  app.use(securityHeaders({ hsts }));
  app.use(noStoreForAdmin);
  app.use(cookieParser());
  // Raw body only for the demo upload route, and with the size limit applied
  // by the parser itself — without it the whole body is already in memory
  // before the handler can reject it. Mounted only when that route exists:
  // otherwise an anonymous request would still be buffered, then answered 404.
  if (localFiles) {
    app.use(
      '/api/v1/media/local',
      raw({ type: '*/*', limit: config.maxUploadBytes }),
    );
  }
  app.useBodyParser('json', { limit: '256kb' });
  app.useGlobalFilters(new AppExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      stopAtFirstError: true,
      validationError: { target: false, value: false },
      exceptionFactory: validationException,
    }),
  );
}
