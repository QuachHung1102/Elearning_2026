import { PassThrough } from 'node:stream';
import type { Request, Response } from 'express';
import { LocalDiskStorage } from './local-disk.storage.js';
import { LocalFileController } from './local-file.controller.js';
import type { AuthService } from '../auth/auth.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

const COURSE_ID = '11111111-2222-4333-8444-555555555555';
const FILE_ID = '66666666-7777-4888-8999-aaaaaaaaaaaa';
const COVER_KEY = `public/courses/${COURSE_ID}/cover/${FILE_ID}.jpg`;
const RESOURCE_KEY = `lessons/${COURSE_ID}/resources/${FILE_ID}-bai-tap.pdf`;

const prisma = {
  lessonResource: {
    findFirst: async () => ({ contentType: 'application/pdf', filename: 'bai-tap.pdf' }),
  },
} as unknown as PrismaService;

const storage = new LocalDiskStorage();
const controller = new LocalFileController(
  storage,
  prisma,
  {} as AuthService,
);

function queryOf(url: string): { exp: string; sig: string; key: string } {
  const parsed = new URL(url);
  return {
    key: decodeURIComponent(parsed.pathname.replace('/api/v1/media/local/', '')),
    exp: parsed.searchParams.get('exp')!,
    sig: parsed.searchParams.get('sig')!,
  };
}

function putRequest(contentType: string, bytes = 10): Request {
  const headers: Record<string, string> = {
    'content-type': contentType,
    'content-length': String(bytes),
  };
  return {
    body: Buffer.alloc(bytes),
    get: (name: string) => headers[name.toLowerCase()],
  } as unknown as Request;
}

/** A writable that records headers, because the handler streams the file into it. */
function fakeResponse(): Response & { headers: Record<string, string> } {
  const sink = new PassThrough();
  const headers: Record<string, string> = {};
  return Object.assign(sink, {
    headers,
    setHeader(name: string, value: string) {
      headers[name] = value;
    },
    headersSent: false,
    status: () => sink,
  }) as unknown as Response & { headers: Record<string, string> };
}

describe('LocalFileController write path', () => {
  it('rejects a download URL replayed as an upload — the method is signed', async () => {
    const { key, exp, sig } = queryOf(
      await storage.signedDownloadUrl(RESOURCE_KEY, 300),
    );
    await expect(
      controller.upload(key, exp, sig, putRequest('application/pdf')),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('accepts an upload URL used exactly as issued', async () => {
    const { key, exp, sig } = queryOf(
      await storage.signedUploadUrl(RESOURCE_KEY, 'application/pdf', 10, 300),
    );
    await expect(
      controller.upload(key, exp, sig, putRequest('application/pdf')),
    ).resolves.toBeUndefined();
    await storage.delete(RESOURCE_KEY);
  });

  it('rejects an upload whose length differs from the signed one', async () => {
    const { key, exp, sig } = queryOf(
      await storage.signedUploadUrl(RESOURCE_KEY, 'application/pdf', 10, 300),
    );
    await expect(
      controller.upload(key, exp, sig, putRequest('application/pdf', 11)),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('rejects an upload sent with a different content type than it was signed for', async () => {
    const { key, exp, sig } = queryOf(
      await storage.signedUploadUrl(RESOURCE_KEY, 'application/pdf', 10, 300),
    );
    await expect(
      controller.upload(key, exp, sig, putRequest('text/plain')),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('rejects a content type outside the allowlist with 415', async () => {
    const { key, exp, sig } = queryOf(
      await storage.signedUploadUrl(RESOURCE_KEY, 'image/svg+xml', 10, 300),
    );
    await expect(
      controller.upload(key, exp, sig, putRequest('image/svg+xml')),
    ).rejects.toMatchObject({ status: 415 });
  });

  it('rejects a public key that does not match the cover template', async () => {
    const key = 'public/x.svg';
    const { exp, sig } = queryOf(
      await storage.signedUploadUrl(key, 'image/png', 10, 300),
    );
    await expect(
      controller.upload(key, exp, sig, putRequest('image/png')),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('accepts a cover key that does match the template', async () => {
    const { key, exp, sig } = queryOf(
      await storage.signedUploadUrl(COVER_KEY, 'image/jpeg', 10, 300),
    );
    await expect(
      controller.upload(key, exp, sig, putRequest('image/jpeg')),
    ).resolves.toBeUndefined();
    await storage.delete(COVER_KEY);
  });

  it('rejects a traversal key even with a valid signature', async () => {
    const key = '../../.env';
    const { exp, sig } = queryOf(
      await storage.signedUploadUrl(key, 'text/plain', 10, 300),
    );
    await expect(
      controller.upload(key, exp, sig, putRequest('text/plain')),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('rejects a body larger than the upload limit', async () => {
    const { key, exp, sig } = queryOf(
      await storage.signedUploadUrl(RESOURCE_KEY, 'application/pdf', 10, 300),
    );
    const oversized = putRequest('application/pdf', 1);
    (oversized.get as unknown) = (name: string) =>
      name.toLowerCase() === 'content-length'
        ? '999999999'
        : 'application/pdf';
    await expect(
      controller.upload(key, exp, sig, oversized),
    ).rejects.toMatchObject({ status: 413 });
  });
});

describe('LocalFileController read path', () => {
  it('serves a public cover key with no exp or sig', async () => {
    const { key, exp, sig } = queryOf(
      await storage.signedUploadUrl(COVER_KEY, 'image/jpeg', 10, 300),
    );
    await controller.upload(key, exp, sig, putRequest('image/jpeg'));

    const response = fakeResponse();
    await controller.download(COVER_KEY, undefined, undefined, response);
    expect(response.headers['Content-Type']).toBe('image/jpeg');
    expect(response.headers['Content-Disposition']).toBe('inline');
    expect(response.headers['X-Content-Type-Options']).toBe('nosniff');
    await storage.delete(COVER_KEY);
  });

  it('requires a signature for a resource key', async () => {
    await expect(
      controller.download(RESOURCE_KEY, undefined, undefined, fakeResponse()),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('serves a resource as an attachment named after the stored filename', async () => {
    const { key, exp, sig } = queryOf(
      await storage.signedUploadUrl(RESOURCE_KEY, 'application/pdf', 10, 300),
    );
    await controller.upload(key, exp, sig, putRequest('application/pdf'));

    const download = queryOf(await storage.signedDownloadUrl(RESOURCE_KEY, 300));
    const response = fakeResponse();
    await controller.download(
      RESOURCE_KEY,
      download.exp,
      download.sig,
      response,
    );
    expect(response.headers['Content-Type']).toBe('application/pdf');
    expect(response.headers['Content-Disposition']).toBe(
      `attachment; filename="bai-tap.pdf"; filename*=UTF-8''bai-tap.pdf`,
    );
    await storage.delete(RESOURCE_KEY);
  });

  it('rejects an expired download URL', async () => {
    // Signature is correct for this exp; only the clock rejects it.
    const { key, exp, sig } = queryOf(
      await storage.signedDownloadUrl(RESOURCE_KEY, -10),
    );
    await expect(
      controller.download(key, exp, sig, fakeResponse()),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('joins the segment array Express 5 hands back before checking anything', async () => {
    const { key, exp, sig } = queryOf(
      await storage.signedUploadUrl(COVER_KEY, 'image/jpeg', 10, 300),
    );
    await controller.upload(key, exp, sig, putRequest('image/jpeg'));

    const response = fakeResponse();
    await controller.download(
      COVER_KEY.split('/'),
      undefined,
      undefined,
      response,
    );
    expect(response.headers['Content-Disposition']).toBe('inline');
    await storage.delete(COVER_KEY);
  });
});
