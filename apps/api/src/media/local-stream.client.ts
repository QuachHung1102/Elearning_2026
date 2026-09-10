import { Injectable } from '@nestjs/common';
import { config } from '../config.js';
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

  async signPlayback(_uid: string, ttlSeconds: number): Promise<PlaybackToken> {
    return {
      playbackUrl: config.demoVideoUrl,
      kind: 'mp4',
      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
    };
  }
}
