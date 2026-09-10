import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { dirname, extname } from 'node:path';
import type { Request, Response } from 'express';
import { SkipCsrf } from '../auth/csrf.guard.js';
import { ERROR_CODE, appError } from '../common/error-codes.js';
import { config } from '../config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { LocalDiskStorage } from './local-disk.storage.js';
import {
  COVER_CONTENT_TYPES,
  COVER_KEY_PATTERN,
  RESOURCE_CONTENT_TYPES,
  RESOURCE_KEY_PREFIX,
  downloadMessage,
  signatureMatches,
  uploadMessage,
} from './object-storage.js';

const SAFE_KEY = /^[A-Za-z0-9/_.-]+$/;
const PUBLIC_PREFIX = /^public\//;

const IMAGE_TYPE_BY_EXTENSION: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function invalidSignature(): never {
  // One code and one sentence for both a wrong signature and an expired one:
  // telling them apart tells the holder whether the secret was right.
  throw appError(
    HttpStatus.FORBIDDEN,
    ERROR_CODE.SIGNATURE_INVALID,
    'Invalid or expired signature',
  );
}

/**
 * Only registered when `STORAGE_DRIVER !== 'r2'` (see `media.module.ts`), so
 * in production the route does not exist rather than being guarded.
 *
 * This is the one place in demo mode that takes a *path* from the client.
 * Steps 1 and 2 are the trust boundary and run on every request, including the
 * unsigned `public/` reads.
 */
@Controller('media/local')
export class LocalFileController {
  constructor(
    private readonly storage: LocalDiskStorage,
    private readonly prisma: PrismaService,
  ) {}

  @Get('*key')
  async download(
    @Param('key') rawKey: string | string[],
    @Query('exp') exp: string | undefined,
    @Query('sig') sig: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    // Express 5 hands wildcard params back as an array of decoded segments.
    // Join before step 1, or the regex runs against "[object Object]".
    const key = this.join(rawKey);
    const absolute = this.resolve(key);

    if (!PUBLIC_PREFIX.test(key)) {
      const expiry = Number(exp);
      if (!Number.isInteger(expiry) || expiry <= Date.now() / 1000) {
        invalidSignature();
      }
      if (typeof sig !== 'string' || !signatureMatches(downloadMessage(key, expiry), sig)) {
        invalidSignature();
      }
    }

    const file = await stat(absolute).catch(() => null);
    if (!file?.isFile()) {
      throw appError(HttpStatus.NOT_FOUND, ERROR_CODE.NOT_FOUND, 'Not Found');
    }

    const headers = await this.responseHeaders(key);
    response.setHeader('Content-Type', headers.contentType);
    response.setHeader('Content-Disposition', headers.disposition);
    response.setHeader('Content-Length', String(file.size));
    response.setHeader('X-Content-Type-Options', 'nosniff');
    await pipeline(createReadStream(absolute), response);
  }

  @Put('*key')
  @HttpCode(HttpStatus.NO_CONTENT)
  @SkipCsrf()
  async upload(
    @Param('key') rawKey: string | string[],
    @Query('exp') exp: string | undefined,
    @Query('sig') sig: string | undefined,
    @Req() request: Request,
  ): Promise<void> {
    const key = this.join(rawKey);

    // Step 0. The write path has no `public/` exemption at all: without this,
    // a valid upload URL could be bent into an arbitrary unsigned-read object.
    // Only the two server-generated key shapes are writable.
    const isCover = COVER_KEY_PATTERN.test(key);
    if (!isCover && (PUBLIC_PREFIX.test(key) || !RESOURCE_KEY_PREFIX.test(key))) {
      invalidSignature();
    }

    const absolute = this.resolve(key);
    const expiry = Number(exp);
    if (!Number.isInteger(expiry) || expiry <= Date.now() / 1000) {
      invalidSignature();
    }

    const contentType = (request.get('content-type') ?? '')
      .split(';')[0]
      .trim()
      .toLowerCase();
    const allowed: readonly string[] = isCover
      ? COVER_CONTENT_TYPES
      : RESOURCE_CONTENT_TYPES;
    if (!allowed.includes(contentType)) {
      throw appError(
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
        ERROR_CODE.UNSUPPORTED_MEDIA_TYPE,
        'Content type is not allowed for this key',
      );
    }

    // The content type is inside the signed message, so uploading a different
    // type than the one the URL was issued for fails as a bad signature.
    if (
      typeof sig !== 'string' ||
      !signatureMatches(uploadMessage(key, contentType, expiry), sig)
    ) {
      invalidSignature();
    }

    const body = request.body as unknown;
    const bytes = Buffer.isBuffer(body) ? body : Buffer.alloc(0);
    const declared = Number(request.get('content-length'));
    if (
      !Number.isInteger(declared) ||
      declared <= 0 ||
      declared > config.maxUploadBytes ||
      bytes.length > config.maxUploadBytes
    ) {
      throw appError(
        HttpStatus.PAYLOAD_TOO_LARGE,
        ERROR_CODE.PAYLOAD_TOO_LARGE,
        'Upload exceeds the maximum size',
      );
    }

    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, bytes);
  }

  private join(rawKey: string | string[]): string {
    return Array.isArray(rawKey) ? rawKey.join('/') : rawKey;
  }

  /** Steps 1 and 2: a safe key shape, then a path that stays under the root. */
  private resolve(key: string): string {
    if (!SAFE_KEY.test(key) || key.includes('..')) invalidSignature();
    const absolute = this.storage.absolutePath(key);
    if (!absolute) invalidSignature();
    return absolute;
  }

  /**
   * This endpoint serves cover images and downloadable resources alike, so the
   * headers follow the key prefix. Hardcoding `attachment` would make every
   * cover image download instead of rendering in an `<img>`.
   */
  private async responseHeaders(
    key: string,
  ): Promise<{ contentType: string; disposition: string }> {
    if (PUBLIC_PREFIX.test(key)) {
      return {
        contentType:
          IMAGE_TYPE_BY_EXTENSION[extname(key).toLowerCase()] ??
          'application/octet-stream',
        disposition: 'inline',
      };
    }
    const resource = RESOURCE_KEY_PREFIX.test(key)
      ? await this.prisma.lessonResource.findFirst({
          where: { objectKey: key },
          select: { contentType: true, filename: true },
        })
      : null;
    return {
      contentType: resource?.contentType ?? 'application/octet-stream',
      disposition: `attachment; filename="${(resource?.filename ?? 'tai-lieu').replace(/["\\]/g, '')}"`,
    };
  }
}
