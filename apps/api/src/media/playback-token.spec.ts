import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PassThrough } from 'node:stream';
import type { Request, Response } from 'express';
import type { AuthService } from '../auth/auth.service.js';
import { config } from '../config.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { LocalDiskStorage } from './local-disk.storage.js';
import {
  LocalFileController,
  parseByteRange,
} from './local-file.controller.js';
import { LocalStreamClient } from './local-stream.client.js';

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

/** The session cookie value is the user id itself in this fake. */
const auth = {
  authenticate: async (token: string) =>
    [USER_A, USER_B].includes(token) ? { user: { id: token } } : null,
} as unknown as AuthService;

const controller = new LocalFileController(
  new LocalDiskStorage(),
  {} as PrismaService,
  auth,
);
const stream = new LocalStreamClient();

function parts(url: string) {
  const parsed = new URL(url);
  return {
    key: parsed.pathname.replace('/api/v1/media/local/', ''),
    exp: parsed.searchParams.get('exp')!,
    sig: parsed.searchParams.get('sig')!,
  };
}

function viewer(userId: string | null, range?: string): Request {
  return {
    cookies: userId ? { elearning_session: userId } : {},
    headers: range ? { range } : {},
  } as unknown as Request;
}

/** Records status and headers; the handler streams the file into it. */
function fakeResponse() {
  const sink = new PassThrough();
  sink.resume();
  const headers: Record<string, string> = {};
  const result = Object.assign(sink, {
    headers,
    statusCode: 200,
    setHeader(name: string, value: string) {
      headers[name] = value;
    },
    status(code: number) {
      result.statusCode = code;
      return result;
    },
  });
  return result as unknown as Response & {
    headers: Record<string, string>;
    statusCode: number;
  };
}

const INVALID = { status: 403, response: { code: 'SIGNATURE_INVALID' } };

describe('Demo playback URL', () => {
  it('plays for the viewer it was issued to', async () => {
    const token = await stream.signPlayback('demo/c1-s1-l1', 60, USER_A);
    expect(token.kind).toBe('mp4');
    const { key, exp, sig } = parts(token.playbackUrl);
    const response = fakeResponse();
    await controller.download(key, exp, sig, response, viewer(USER_A));
    const size = (await stat(resolve(process.cwd(), config.demoVideoFile)))
      .size;
    expect(response.statusCode).toBe(200);
    expect(response.headers['Content-Type']).toBe('video/mp4');
    expect(response.headers['Content-Disposition']).toBe('inline');
    expect(response.headers['Accept-Ranges']).toBe('bytes');
    expect(response.headers['Cache-Control']).toBe('private, no-store');
    expect(response.headers['Content-Length']).toBe(String(size));
  });

  it('rejects an expired URL even with a correct signature', async () => {
    const token = await stream.signPlayback('demo/c1-s1-l1', -10, USER_A);
    const { key, exp, sig } = parts(token.playbackUrl);
    await expect(
      controller.download(key, exp, sig, fakeResponse(), viewer(USER_A)),
    ).rejects.toMatchObject({
      status: 403,
      response: { code: 'SIGNATURE_INVALID' },
    });
  });

  it("rejects user A's URL in user B's session, and with no session", async () => {
    const token = await stream.signPlayback('demo/c1-s1-l1', 60, USER_A);
    const { key, exp, sig } = parts(token.playbackUrl);
    await expect(
      controller.download(key, exp, sig, fakeResponse(), viewer(USER_B)),
    ).rejects.toMatchObject(INVALID);
    await expect(
      controller.download(key, exp, sig, fakeResponse(), viewer(null)),
    ).rejects.toMatchObject(INVALID);
  });

  it("rejects lesson X's signature on lesson Y's key", async () => {
    const x = parts(
      (await stream.signPlayback('demo/c1-s1-l1', 60, USER_A)).playbackUrl,
    );
    const y = parts(
      (await stream.signPlayback('demo/c1-s1-l2', 60, USER_A)).playbackUrl,
    );
    expect(y.key).not.toBe(x.key);
    await expect(
      controller.download(y.key, x.exp, x.sig, fakeResponse(), viewer(USER_A)),
    ).rejects.toMatchObject(INVALID);
  });

  it('rejects a signature with one byte flipped', async () => {
    const { key, exp, sig } = parts(
      (await stream.signPlayback('demo/c1-s1-l1', 60, USER_A)).playbackUrl,
    );
    const flipped = `${sig[0] === 'A' ? 'B' : 'A'}${sig.slice(1)}`;
    await expect(
      controller.download(key, exp, flipped, fakeResponse(), viewer(USER_A)),
    ).rejects.toMatchObject(INVALID);
  });

  it('answers a Range request with 206 and the requested bytes', async () => {
    const { key, exp, sig } = parts(
      (await stream.signPlayback('demo/c1-s1-l1', 60, USER_A)).playbackUrl,
    );
    const size = (await stat(resolve(process.cwd(), config.demoVideoFile)))
      .size;
    const response = fakeResponse();
    await controller.download(
      key,
      exp,
      sig,
      response,
      viewer(USER_A, 'bytes=0-99'),
    );
    expect(response.statusCode).toBe(206);
    expect(response.headers['Content-Range']).toBe(`bytes 0-99/${size}`);
    expect(response.headers['Content-Length']).toBe('100');
  });
});

describe('parseByteRange', () => {
  it.each([
    [undefined, null],
    ['bytes=0-9', { start: 0, end: 9 }],
    ['bytes=90-', { start: 90, end: 99 }],
    ['bytes=-10', { start: 90, end: 99 }],
    ['bytes=-500', { start: 0, end: 99 }],
    ['bytes=50-5000', { start: 50, end: 99 }],
    ['bytes=100-', 'unsatisfiable'],
    ['bytes=-0', 'unsatisfiable'],
    ['bytes=0-1,5-6', null],
    ['items=0-1', null],
    ['bytes=9-2', null],
  ] as const)('%s on 100 bytes → %j', (header, expected) => {
    expect(parseByteRange(header, 100)).toEqual(expected);
  });
});
