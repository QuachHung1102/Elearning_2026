import { BadGatewayException } from '@nestjs/common';
import { CloudflareStreamClient } from './cloudflare-stream.client.js';

describe('CloudflareStreamClient.getStatus', () => {
  afterEach(() => vi.unstubAllGlobals());

  const answer = (status: number, body: unknown = {}) =>
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(body), { status })),
    );
  const getStatus = () => new CloudflareStreamClient().getStatus('uid-1');

  it('encodes the uid so it stays one path segment (REVIEW F-10)', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ result: { readyToStream: true, duration: 12.4 } }),
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const status = await new CloudflareStreamClient().getStatus('a/../b?x=1');

    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url.endsWith('/stream/a%2F..%2Fb%3Fx%3D1')).toBe(true);
    expect(status).toEqual({ ready: true, durationSeconds: 12 });
  });

  it('reports a video still encoding as not ready, not errored', async () => {
    answer(200, {
      result: { readyToStream: false, duration: -1, status: { state: 'inprogress' } },
    });
    const status = await getStatus();
    expect(status).toEqual({ ready: false, durationSeconds: 0 });
    expect(status.errored).toBeFalsy();
  });

  it('reports state "error" as errored (REVIEW F-27)', async () => {
    answer(200, {
      result: {
        readyToStream: false,
        status: { state: 'error', errReasonCode: 'ERR_NON_VIDEO' },
      },
    });
    expect(await getStatus()).toEqual({
      ready: false,
      durationSeconds: 0,
      errored: true,
    });
  });

  it('reports a 404 (deleted video, wrong uid) as errored (REVIEW F-27)', async () => {
    answer(404, { success: false });
    expect(await getStatus()).toEqual({
      ready: false,
      durationSeconds: 0,
      errored: true,
    });
  });

  it.each([401, 403, 429, 500, 503])(
    'throws a provider error on %i instead of answering "not ready" (REVIEW F-27)',
    async (code) => {
      answer(code, { success: false });
      await expect(getStatus()).rejects.toBeInstanceOf(BadGatewayException);
    },
  );

  it('lets a network failure or timeout surface as an error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new DOMException('timed out', 'TimeoutError');
      }),
    );
    await expect(getStatus()).rejects.toThrow('timed out');
  });
});
