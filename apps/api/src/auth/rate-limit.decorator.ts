import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT = 'rateLimit';

export type RateLimitOptions = {
  limit: number;
  windowSeconds: number;
  key: 'ip' | 'user';
};

export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT, options);
