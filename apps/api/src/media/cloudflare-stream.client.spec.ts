import { CloudflareStreamClient } from './cloudflare-stream.client.js';

describe('CloudflareStreamClient.getStatus', () => {
  afterEach(() => vi.unstubAllGlobals());

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
});
