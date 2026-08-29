import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';

const LIMIT = 10;
const WINDOW_MS = 60_000;
const MAX_TRACKED_CLIENTS = 10_000;

type Attempt = { count: number; resetsAt: number };

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  // ponytail: this is per-process; use shared storage before horizontal scaling.
  private readonly attempts = new Map<string, Attempt>();

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const now = Date.now();
    const key = `${request.ip}:${request.path}`;
    const attempt = this.attempts.get(key);

    if (!attempt || attempt.resetsAt <= now) {
      if (this.attempts.size >= MAX_TRACKED_CLIENTS) this.attempts.clear();
      this.attempts.set(key, { count: 1, resetsAt: now + WINDOW_MS });
      return true;
    }

    if (attempt.count >= LIMIT) {
      response.setHeader(
        'Retry-After',
        Math.ceil((attempt.resetsAt - now) / 1_000),
      );
      throw new HttpException(
        'Too many authentication attempts',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    attempt.count += 1;
    return true;
  }
}
