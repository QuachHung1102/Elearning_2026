import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * What every log line written while a request is being handled should carry
 * without each caller passing it down. Started by `requestIdMiddleware`.
 */
export const requestContext = new AsyncLocalStorage<{ requestId: string }>();
