import { Injectable } from '@nestjs/common';
import { createHash, createHmac } from 'node:crypto';
import { config } from '../config.js';
import type { ObjectStorage } from './object-storage.js';

const ALGORITHM = 'AWS4-HMAC-SHA256';
const SERVICE = 's3';

/**
 * Cloudflare R2 over the S3 API. SigV4 presigning is ~50 lines of HMAC, so it
 * is written here rather than pulling in the AWS SDK for two URL shapes.
 */
@Injectable()
export class R2ObjectStorage implements ObjectStorage {
  /**
   * `content-length` is signed, so R2 rejects a body of any other length;
   * without it the URL accepts any size. Browsers set Content-Length from the
   * `File` themselves, so the uploader only has to declare `file.size`.
   */
  async signedUploadUrl(
    key: string,
    contentType: string,
    sizeBytes: number,
    ttl: number,
  ): Promise<string> {
    return this.presign('PUT', key, ttl, {
      'content-length': String(sizeBytes),
      'content-type': contentType,
    });
  }

  async signedDownloadUrl(key: string, ttl: number): Promise<string> {
    return this.presign('GET', key, ttl, {});
  }

  publicUrl(key: string): string {
    return `${config.r2PublicBaseUrl.replace(/\/$/, '')}/${key}`;
  }

  async delete(key: string): Promise<void> {
    const url = await this.presign('DELETE', key, 60, {});
    const response = await fetch(url, { method: 'DELETE' });
    if (!response.ok && response.status !== 404) {
      throw new Error(`R2 delete failed with ${response.status}`);
    }
  }

  /** Path-style (`/{bucket}/{key}`), region `auto`, as R2 expects. */
  private presign(
    method: string,
    key: string,
    ttl: number,
    headers: Record<string, string>,
  ): string {
    return presign({
      method,
      endpoint: config.r2Endpoint,
      path: `${config.r2Bucket}/${key}`,
      ttl,
      headers,
      region: 'auto',
      accessKeyId: config.r2AccessKeyId,
      secretAccessKey: config.r2SecretAccessKey,
      now: new Date(),
    });
  }
}

/** SigV4 query-string presign. `headers` take lower-case names; `host` is always signed. */
export function presign(input: {
  method: string;
  endpoint: string;
  path: string;
  ttl: number;
  headers: Record<string, string>;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  now: Date;
}): string {
  const endpoint = new URL(input.endpoint);
  const amzDate = input.now.toISOString().replace(/[-:]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${input.region}/${SERVICE}/aws4_request`;
  const headers: Record<string, string> = {
    ...input.headers,
    host: endpoint.host,
  };
  const headerNames = Object.keys(headers).sort();
  const signedHeaders = headerNames.join(';');

  const query: Record<string, string> = {
    'X-Amz-Algorithm': ALGORITHM,
    'X-Amz-Credential': `${input.accessKeyId}/${scope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(input.ttl),
    'X-Amz-SignedHeaders': signedHeaders,
  };
  const canonicalQuery = Object.keys(query)
    .sort()
    .map((name) => `${encodeRfc3986(name)}=${encodeRfc3986(query[name])}`)
    .join('&');

  const canonicalUri = `/${input.path}`
    .split('/')
    .map(encodeRfc3986)
    .join('/');
  const canonicalHeaders = headerNames
    .map((name) => `${name}:${headers[name]}\n`)
    .join('');
  const canonicalRequest = [
    input.method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = [
    ALGORITHM,
    amzDate,
    scope,
    createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');

  let signingKey = hmac(`AWS4${input.secretAccessKey}`, dateStamp);
  for (const part of [input.region, SERVICE, 'aws4_request']) {
    signingKey = hmac(signingKey, part);
  }
  const signature = hmac(signingKey, stringToSign).toString('hex');

  return `${endpoint.origin}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

function hmac(key: string | Buffer, message: string): Buffer {
  return createHmac('sha256', key).update(message, 'utf8').digest();
}

/** S3 requires RFC 3986 encoding: `!'()*` are escaped, unlike encodeURIComponent. */
function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}
