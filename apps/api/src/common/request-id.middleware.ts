import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const VALID_REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;

export type RequestWithId = Request & { requestId: string };

export function requestIdMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const supplied = request.get('x-request-id');
  const requestId =
    supplied && VALID_REQUEST_ID.test(supplied) ? supplied : randomUUID();

  (request as RequestWithId).requestId = requestId;
  response.setHeader('X-Request-Id', requestId);
  next();
}
