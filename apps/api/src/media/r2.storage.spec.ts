import { R2ObjectStorage, presign } from './r2.storage.js';

vi.mock('../config.js', async (original) => {
  const actual = await original<typeof import('../config.js')>();
  return {
    ...actual,
    config: {
      ...actual.config,
      r2Endpoint: 'https://account.r2.cloudflarestorage.com',
      r2Bucket: 'elearning',
      r2AccessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      r2SecretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    },
  };
});

describe('presign', () => {
  // AWS S3 docs, "Authenticating Requests: Using Query Parameters". The
  // example is virtual-host style, so the bucket is in the host, not the path.
  it('reproduces the published SigV4 presigned-URL example', () => {
    const url = new URL(
      presign({
        method: 'GET',
        endpoint: 'https://examplebucket.s3.amazonaws.com',
        path: 'test.txt',
        ttl: 86400,
        headers: {},
        region: 'us-east-1',
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        now: new Date('2013-05-24T00:00:00Z'),
      }),
    );
    expect(url.pathname).toBe('/test.txt');
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('host');
    expect(url.searchParams.get('X-Amz-Signature')).toBe(
      'aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404',
    );
  });
});

describe('R2ObjectStorage.signedUploadUrl', () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });
  afterAll(() => vi.useRealTimers());

  const storage = new R2ObjectStorage();
  const key = 'lessons/x/resources/a.pdf';

  it('signs the exact content length, path-style, region auto', async () => {
    const url = new URL(
      await storage.signedUploadUrl(key, 'application/pdf', 1024, 300),
    );
    expect(url.pathname).toBe(`/elearning/${key}`);
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe(
      'content-length;content-type;host',
    );
    expect(url.searchParams.get('X-Amz-Credential')).toBe(
      'AKIAIOSFODNN7EXAMPLE/20260101/auto/s3/aws4_request',
    );
  });

  it('produces a different signature for a different length', async () => {
    const signature = async (size: number) =>
      new URL(
        await storage.signedUploadUrl(key, 'application/pdf', size, 300),
      ).searchParams.get('X-Amz-Signature');
    expect(await signature(1024)).not.toBe(await signature(1025));
  });
});
