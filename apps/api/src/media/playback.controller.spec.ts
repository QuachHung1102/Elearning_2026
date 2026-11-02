import { PlaybackController } from './playback.controller.js';
import type { StreamClient } from './stream.client.js';
import { config } from '../config.js';

const LESSON_ID = '0b9f5c1e-4d7a-4c1e-9a55-1f2e3d4c5b6a';
const request = { auth: { user: { id: 'user-a', role: 'STUDENT' } } };

/** API_CONTRACT.md §6.1 steps 5–8 against a stub StreamClient. */
function setup(
  ready: boolean,
  videoAsset: object | null = { externalId: 'uid-1' },
) {
  const stream: StreamClient = {
    getStatus: vi.fn(async () => ({ ready, durationSeconds: 60 })),
    register: vi.fn(async () => ({ ready, durationSeconds: 60 })),
    signPlayback: vi.fn(async (uid: string) => ({
      playbackUrl: `https://stream.test/${uid}`,
      kind: 'hls' as const,
      expiresAt: new Date('2030-01-01T00:00:00Z'),
    })),
  };
  const enrollments = {
    lessonAccess: vi.fn(async () => ({
      lesson: { videoAsset },
      mode: 'ENROLLED',
    })),
  };
  const controller = new PlaybackController(enrollments as never, stream);
  return { controller, stream };
}

describe('PlaybackController', () => {
  it.each(['01', '02', '03', '04'])(
    'serves public book lesson %s independently of the configured streaming provider',
    async (number) => {
      const { controller, stream } = setup(false, {
        provider: 'DEMO',
        externalId: `books/lesson-${number}`,
      });
      const body = await controller.playbackToken(request as never, LESSON_ID);
      expect(body).toMatchObject({
        kind: 'mp4',
        playbackUrl: `${config.webOrigin.replace(/\/$/, '')}/videos/books/lesson-${number}.mp4`,
      });
      expect(stream.getStatus).not.toHaveBeenCalled();
      expect(stream.signPlayback).not.toHaveBeenCalled();
    },
  );

  it.each([
    { provider: 'CLOUDFLARE', externalId: 'books/lesson-01' },
    { provider: 'DEMO', externalId: 'books/lesson-05' },
    { provider: 'DEMO', externalId: '../books/lesson-01' },
  ])(
    'keeps other assets on the protected streaming path: %j',
    async (videoAsset) => {
      const { controller, stream } = setup(false, videoAsset);
      await expect(
        controller.playbackToken(request as never, LESSON_ID),
      ).rejects.toMatchObject({ status: 409 });
      expect(stream.getStatus).toHaveBeenCalledWith(videoAsset.externalId);
    },
  );

  it('answers 409 VIDEO_NOT_READY while the video is processing', async () => {
    const { controller, stream } = setup(false);
    await expect(
      controller.playbackToken(request as never, LESSON_ID),
    ).rejects.toMatchObject({
      status: 409,
      response: { code: 'VIDEO_NOT_READY' },
    });
    expect(stream.signPlayback).not.toHaveBeenCalled();
  });

  it('returns exactly playbackUrl, kind and expiresAt once ready', async () => {
    const { controller, stream } = setup(true);
    const body = await controller.playbackToken(request as never, LESSON_ID);
    expect(body).toEqual({
      playbackUrl: 'https://stream.test/uid-1',
      kind: 'hls',
      expiresAt: new Date('2030-01-01T00:00:00Z'),
    });
    expect(stream.signPlayback).toHaveBeenCalledWith(
      'uid-1',
      expect.any(Number),
      'user-a',
    );
  });

  it('answers 404 when no video is attached', async () => {
    const { controller, stream } = setup(true, null);
    await expect(
      controller.playbackToken(request as never, LESSON_ID),
    ).rejects.toMatchObject({ status: 404 });
    expect(stream.getStatus).not.toHaveBeenCalled();
  });
});
