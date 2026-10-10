import { createHmac, timingSafeEqual } from 'node:crypto';
import { HttpStatus } from '@nestjs/common';
import { appError, ERROR_CODE } from '../common/error-codes.js';
import type { ZaloPayCallbackData } from './zalopay.client.js';

/** HMAC-SHA256 over the exact `data` string, lowercase hex (ZaloPay callback `mac`). */
export function zalopayMac(key: string, data: string): string {
  return createHmac('sha256', key).update(data).digest('hex');
}

/** Constant-time: the comparison must not reveal how many leading characters matched. */
export function macMatches(key: string, data: string, mac: string): boolean {
  const expected = Buffer.from(zalopayMac(key, data));
  const given = Buffer.from(mac);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/**
 * The one check both clients make on a callback: the MAC over the exact `data`
 * string first, and only then the JSON inside it. Nothing about the payload is
 * trusted, or even parsed, before the signature holds.
 */
export function parseSignedCallback(
  key2: string,
  body: { data: string; mac: string },
): ZaloPayCallbackData {
  if (!macMatches(key2, body.data, body.mac)) {
    throw appError(
      HttpStatus.BAD_REQUEST,
      ERROR_CODE.SIGNATURE_INVALID,
      'mac not equal',
    );
  }
  try {
    return JSON.parse(body.data) as ZaloPayCallbackData;
  } catch {
    throw appError(
      HttpStatus.BAD_REQUEST,
      ERROR_CODE.VALIDATION_FAILED,
      'callback data is not JSON',
    );
  }
}
