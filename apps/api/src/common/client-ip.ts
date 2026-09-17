import { isIP } from 'node:net';
import type { Request } from 'express';
import { config } from '../config.js';

/**
 * Railway's edge sets `X-Real-IP`; anywhere else the header is client-supplied
 * and trusting it would let anyone pick their own rate-limit bucket.
 */
export function clientIp(request: Request): string {
  if (config.railwayEnvironmentId) {
    const railwayIp = request.get('x-real-ip');
    if (railwayIp && isIP(railwayIp)) return railwayIp;
  }
  return request.ip ?? request.socket.remoteAddress ?? 'unknown';
}
