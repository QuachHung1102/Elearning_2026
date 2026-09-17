import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT = 'rateLimit';

export type RateLimitOptions = {
  limit: number;
  windowSeconds: number;
  key: 'ip' | 'user';
};

export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT, options);

/**
 * Every POST/PATCH/PUT/DELETE under /admin (API_CONTRACT.md §8): a safety net
 * against a runaway script, not an attack defence. Admin GETs stay unlimited.
 * Needs `AdminGuard` before `AuthRateLimitGuard` so the key is the admin's id.
 */
export const AdminMutationRateLimit = () =>
  RateLimit({ key: 'user', limit: 120, windowSeconds: 60 });
