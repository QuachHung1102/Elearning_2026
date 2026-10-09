export const STREAM_CLIENT = Symbol('STREAM_CLIENT');

export type PlaybackToken = {
  playbackUrl: string;
  kind: 'hls' | 'mp4';
  expiresAt: Date;
};

/**
 * `errored`: the provider says the video failed to encode or does not exist —
 * final, it will never turn ready. Anything the provider could not answer
 * (auth, outage, timeout) is thrown instead, never reported as "not ready".
 */
export type VideoStatus = {
  ready: boolean;
  durationSeconds: number;
  errored?: boolean;
};

export interface StreamClient {
  getStatus(uid: string): Promise<VideoStatus>;
  /**
   * Called once, when the video is registered: make it playable only through
   * `signPlayback`, then report its status. Throws when that cannot be done,
   * so a video that would play unsigned is never stored.
   */
  register(uid: string): Promise<VideoStatus>;
  /** `viewerId` binds the demo URL to one user; see each implementation. */
  signPlayback(
    uid: string,
    ttlSeconds: number,
    viewerId: string,
  ): Promise<PlaybackToken>;
}
