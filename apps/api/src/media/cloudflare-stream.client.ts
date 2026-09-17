import { Injectable } from '@nestjs/common';
import { createSign } from 'node:crypto';
import { config } from '../config.js';
import type {
  PlaybackToken,
  StreamClient,
  VideoStatus,
} from './stream.client.js';

const API = 'https://api.cloudflare.com/client/v4';

@Injectable()
export class CloudflareStreamClient implements StreamClient {
  async getStatus(uid: string): Promise<VideoStatus> {
    const response = await fetch(
      `${API}/accounts/${config.cloudflareAccountId}/stream/${uid}`,
      {
        headers: {
          authorization: `Bearer ${config.cloudflareStreamApiToken}`,
        },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) return { ready: false, durationSeconds: 0 };
    const body = (await response.json()) as {
      result?: { readyToStream?: boolean; duration?: number };
    };
    return {
      ready: body.result?.readyToStream === true,
      durationSeconds: Math.max(0, Math.round(body.result?.duration ?? 0)),
    };
  }

  /**
   * Signed playback token, RS256 over the Stream claim set. Cloudflare
   * verifies it against the signing key registered for this account.
   * Cloudflare tokens are not per-viewer, so `viewerId` is not part of them.
   */
  async signPlayback(
    uid: string,
    ttlSeconds: number,
    _viewerId: string,
  ): Promise<PlaybackToken> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const header = {
      alg: 'RS256',
      kid: config.cloudflareStreamSigningKeyId,
    };
    const payload = {
      sub: uid,
      kid: config.cloudflareStreamSigningKeyId,
      exp: Math.floor(expiresAt.getTime() / 1000),
      accessRules: [
        {
          type: 'any',
          action: 'allow',
        },
      ],
    };
    const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
    const signature = createSign('RSA-SHA256')
      .update(unsigned)
      .sign(
        Buffer.from(config.cloudflareStreamSigningKeyPem, 'base64').toString(
          'utf8',
        ),
      )
      .toString('base64url');
    return {
      playbackUrl: `https://videodelivery.net/${unsigned}.${signature}/manifest/video.m3u8`,
      kind: 'hls',
      expiresAt,
    };
  }
}

function base64url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}
