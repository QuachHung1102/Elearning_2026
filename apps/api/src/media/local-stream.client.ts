import { Injectable } from '@nestjs/common';
import { config } from '../config.js';
import { playbackMessage, sign } from './object-storage.js';
import type {
  PlaybackToken,
  StreamClient,
  VideoStatus,
} from './stream.client.js';

/**
 * Demo driver. Every `demo/...` external id maps to the same sample file, so
 * 58 seeded VideoAsset rows need exactly one file on disk.
 */
@Injectable()
export class LocalStreamClient implements StreamClient {
  async getStatus(_uid: string): Promise<VideoStatus> {
    return {
      ready: true,
      durationSeconds: config.demoVideoDurationSeconds,
    };
  }

  /** Nothing to lock: every demo URL is already signed and viewer-bound. */
  register(uid: string): Promise<VideoStatus> {
    return this.getStatus(uid);
  }

  /**
   * A real expiring URL on the shared media route rather than a bare static
   * file, so the playback authorisation path is exercised locally
   * (PLAN_SUPPLEMENT.md §6 risk 3). The key carries the external id and the
   * signature carries the viewer: the URL opens one video, for one user.
   */
  async signPlayback(
    uid: string,
    ttlSeconds: number,
    viewerId: string,
  ): Promise<PlaybackToken> {
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const key = `videos/${Buffer.from(uid, 'utf8').toString('base64url')}.mp4`;
    const sig = sign(playbackMessage(key, exp, viewerId));
    return {
      playbackUrl: `${config.apiPublicUrl.replace(/\/$/, '')}/api/v1/media/local/${key}?exp=${exp}&sig=${sig}`,
      kind: 'mp4',
      expiresAt: new Date(exp * 1000),
    };
  }
}
