import { createHash, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import type { Request } from 'express';
import { config } from '../config.js';

const digest = (value: string) => createHash('sha256').update(value).digest();

/**
 * Who sent this request, for rate limits and the audit log.
 *
 * 1. The Next server fetches on its visitors' behalf (server rendering, the
 *    `/api/*` rewrite) and names the visitor in `X-Visitor-Ip`. Only trusted
 *    with `X-Internal-Api-Secret`, or anyone could pick their own bucket.
 * 2. `X-Real-IP`, when `TRUST_X_REAL_IP` says a reverse proxy in front of this
 *    service overwrites it; anywhere else the header is client-supplied.
 * 3. The socket.
 */
export function clientIp(
  request: Request,
  secret: string = config.internalApiSecret,
): string {
  const visitorIp = request.get('x-visitor-ip');
  const sent = request.get('x-internal-api-secret');
  if (
    visitorIp &&
    isIP(visitorIp) &&
    sent &&
    timingSafeEqual(digest(sent), digest(secret))
  ) {
    return visitorIp;
  }
  if (config.trustXRealIp) {
    const realIp = request.get('x-real-ip');
    if (realIp && isIP(realIp)) return realIp;
  }
  return request.ip ?? request.socket.remoteAddress ?? 'unknown';
}
