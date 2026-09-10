import { Injectable } from '@nestjs/common';
import { createHash, createHmac } from 'node:crypto';
import { config } from '../config.js';
import type { ObjectStorage } from './object-storage.js';

const ALGORITHM = 'AWS4-HMAC-SHA256';
const REGION = 'auto';
const SERVICE = 's3';

/**
 * Cloudflare R2 over the S3 API. SigV4 presigning is ~50 lines of HMAC, so it
 * is written here rather than pulling in the AWS SDK for two URL shapes.
 */
@Injectable()
export class R2ObjectStorage implements ObjectStorage {
  async signedUploadUrl(
    key: string,
    contentType: string,
    ttl: number,
  ): Promise<string> {
    return this.presign('PUT', key, ttl, {
      'X-Amz-SignedHeaders': 'content-type;host',
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

  private presign(
    method: string,
    key: string,
    ttl: number,
    extra: Record<string, string>,
  ): string {
    const endpoint = new URL(config.r2Endpoint);
    const now = new Date();
    const amzDate = now.toISOString().replace(/[-:]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const scope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
    const contentType = extra['content-type'];
    const signedHeaders = contentType ? 'content-type;host' : 'host';

    const query: Record<string, string> = {
      'X-Amz-Algorithm': ALGORITHM,
      'X-Amz-Credential': `${config.r2AccessKeyId}/${scope}`,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': String(ttl),
      'X-Amz-SignedHeaders': signedHeaders,
    };
    const canonicalQuery = Object.keys(query)
      .sort()
      .map((name) => `${encodeRfc3986(name)}=${encodeRfc3986(query[name])}`)
      .join('&');

    const canonicalUri = `/${config.r2Bucket}/${key}`
      .split('/')
      .map(encodeRfc3986)
      .join('/');
    const canonicalHeaders = contentType
      ? `content-type:${contentType}\nhost:${endpoint.host}\n`
      : `host:${endpoint.host}\n`;
    const canonicalRequest = [
      method,
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

    let signingKey = hmac(`AWS4${config.r2SecretAccessKey}`, dateStamp);
    for (const part of [REGION, SERVICE, 'aws4_request']) {
      signingKey = hmac(signingKey, part);
    }
    const signature = hmac(signingKey, stringToSign).toString('hex');

    return `${endpoint.origin}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
  }
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
