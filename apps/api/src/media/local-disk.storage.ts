import { Injectable } from '@nestjs/common';
import { rm } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { config } from '../config.js';
import {
  downloadMessage,
  sign,
  uploadMessage,
  type ObjectStorage,
} from './object-storage.js';

/**
 * Demo driver. The signed URLs are real; only the bytes live somewhere else.
 * The upload URL is a `PUT` against `/media/local/{key}` exactly like an R2
 * presigned `PUT`, so the admin uploader is written once for both drivers.
 */
@Injectable()
export class LocalDiskStorage implements ObjectStorage {
  private readonly root = resolve(process.cwd(), config.storageLocalDir);

  private url(key: string, exp: number, signature: string): string {
    const base = `${config.apiPublicUrl.replace(/\/$/, '')}/api/v1/media/local/${key}`;
    return `${base}?exp=${exp}&sig=${signature}`;
  }

  async signedUploadUrl(
    key: string,
    contentType: string,
    ttl: number,
  ): Promise<string> {
    const exp = Math.floor(Date.now() / 1000) + ttl;
    return this.url(key, exp, sign(uploadMessage(key, contentType, exp)));
  }

  async signedDownloadUrl(key: string, ttl: number): Promise<string> {
    const exp = Math.floor(Date.now() / 1000) + ttl;
    return this.url(key, exp, sign(downloadMessage(key, exp)));
  }

  publicUrl(key: string): string {
    return `${config.apiPublicUrl.replace(/\/$/, '')}/api/v1/media/local/${key}`;
  }

  async delete(key: string): Promise<void> {
    const absolute = resolve(this.root, key);
    if (!absolute.startsWith(this.root + sep)) return;
    await rm(absolute, { force: true });
  }

  absolutePath(key: string): string | null {
    const absolute = resolve(this.root, key);
    return absolute.startsWith(this.root + sep) ? absolute : null;
  }
}
