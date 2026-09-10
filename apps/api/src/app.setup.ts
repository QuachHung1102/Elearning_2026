import {
  HttpException,
  HttpStatus,
  ValidationPipe,
  type ValidationError,
} from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppExceptionFilter } from './common/error-filter.js';
import { ERROR_CODE } from './common/error-codes.js';
import { requestIdMiddleware } from './common/request-id.middleware.js';

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

export function configureApp(app: NestExpressApplication): void {
  app.setGlobalPrefix('/api/v1');
  app.use(requestIdMiddleware);
  app.use(cookieParser());
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
