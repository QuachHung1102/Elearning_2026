import type { NextFunction, Request, Response } from 'express';
import type { AuthenticatedRequest } from '../auth/session-auth.guard.js';
import { logEvent } from './logger.js';
import type { RequestWithId } from './request-id.middleware.js';

/**
 * One line per finished request: what was asked, what was answered, how long it
 * took and who asked. The path, never the URL: a signed media URL carries its
 * signature in the query string. Headers and bodies are not read at all.
 */
export function requestLog(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const started = performance.now();
  response.on('finish', () => {
    logEvent({
      evt: 'http',
      // Read now, not from the context: the listener may run outside it.
      requestId: (request as RequestWithId).requestId,
      method: request.method,
      path: request.path,
      status: response.statusCode,
      ms: Math.round(performance.now() - started),
      userId: (request as AuthenticatedRequest).auth?.user.id,
    });
  });
  next();
}
