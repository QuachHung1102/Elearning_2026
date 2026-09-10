export const STREAM_CLIENT = Symbol('STREAM_CLIENT');

export type PlaybackToken = {
  playbackUrl: string;
  kind: 'hls' | 'mp4';
  expiresAt: Date;
};

export type VideoStatus = { ready: boolean; durationSeconds: number };

export interface StreamClient {
  getStatus(uid: string): Promise<VideoStatus>;
  signPlayback(uid: string, ttlSeconds: number): Promise<PlaybackToken>;
}
