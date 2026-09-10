import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';
import { normalize } from '../catalog/search-text.js';

export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

export interface ObjectStorage {
  signedUploadUrl(
    key: string,
    contentType: string,
    ttl: number,
  ): Promise<string>;
  signedDownloadUrl(key: string, ttl: number): Promise<string>;
  /** Unsigned URL. Cover images live on public pages; signing them only breaks CDN caching. */
  publicUrl(key: string): string;
  delete(key: string): Promise<void>;
}

/** Embedded in `<img>` on public pages, so raster images only. */
export const COVER_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

/**
 * Replayed to students from a signed URL, so `text/html` or `image/svg+xml`
 * would be a script running on our own origin.
 */
export const RESOURCE_CONTENT_TYPES = [
  'application/pdf',
  'application/zip',
  'image/png',
  'image/jpeg',
  'text/plain',
] as const;

const COVER_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/** The only shape `PUT` accepts under the unsigned-read `public/` prefix. */
export const COVER_KEY_PATTERN = new RegExp(
  `^public/courses/${UUID}/cover/${UUID}\\.(jpg|png|webp)$`,
);

export const RESOURCE_KEY_PREFIX = /^lessons\/[^/]+\/resources\//;

export function coverKey(courseId: string, contentType: string): string {
  const extension = COVER_EXTENSION[contentType];
  if (!extension) throw new Error(`Unsupported cover type ${contentType}`);
  return `public/courses/${courseId}/cover/${randomUUID()}.${extension}`;
}

export function resourceKey(lessonId: string, filename: string): string {
  const dot = filename.lastIndexOf('.');
  const stem = dot > 0 ? filename.slice(0, dot) : filename;
  const extension = dot > 0 ? filename.slice(dot + 1) : '';
  const safeStem =
    normalize(stem)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'tai-lieu';
  const safeExtension = normalize(extension).replace(/[^a-z0-9]/g, '');
  return `lessons/${lessonId}/resources/${randomUUID()}-${safeStem}${safeExtension ? `.${safeExtension}` : ''}`;
}

/**
 * The signed message contains the HTTP method, and for uploads the content
 * type as well. Without the method both directions produce the same
 * signature, so any download URL a student holds is also a valid `PUT` over
 * the same object for the life of the token. R2 signs the method in SigV4,
 * so omitting it here would make the demo driver looser than production.
 */
export const downloadMessage = (key: string, exp: number) =>
  `local-file:GET:${key}:${exp}`;

export const uploadMessage = (key: string, contentType: string, exp: number) =>
  `local-file:PUT:${key}:${contentType}:${exp}`;

export function sign(message: string): string {
  return createHmac('sha256', config.jwtSecret).update(message).digest('base64url');
}

export function signatureMatches(message: string, signature: string): boolean {
  const expected = Buffer.from(sign(message));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
