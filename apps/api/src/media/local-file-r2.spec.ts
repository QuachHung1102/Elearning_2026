import type { Request, Response } from 'express';
import type { AuthService } from '../auth/auth.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { LocalDiskStorage } from './local-disk.storage.js';
import { LocalFileController } from './local-file.controller.js';

// A non-production STORAGE_DRIVER=r2 + VIDEO_DRIVER=demo mix registers the
// controller for the demo video; nothing else may be served or written there.
vi.mock('../config.js', async (original) => {
  const actual = await original<typeof import('../config.js')>();
  return { ...actual, config: { ...actual.config, storageDriver: 'r2' } };
});

const controller = new LocalFileController(
  new LocalDiskStorage(),
  {} as PrismaService,
  {} as AuthService,
);
const RESOURCE_KEY =
  'lessons/11111111-2222-4333-8444-555555555555/resources/66666666-7777-4888-8999-aaaaaaaaaaaa-bai-tap.pdf';
const COVER_KEY =
  'public/courses/11111111-2222-4333-8444-555555555555/cover/66666666-7777-4888-8999-aaaaaaaaaaaa.jpg';

describe('LocalFileController under STORAGE_DRIVER=r2', () => {
  it('answers 404 for a file key instead of checking its signature', async () => {
    await expect(
      controller.download(RESOURCE_KEY, undefined, undefined, {} as Response),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('answers 404 for any upload', async () => {
    await expect(
      controller.upload(COVER_KEY, '1', 'x', {} as Request),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('still routes a demo video key to the signed video check', async () => {
    await expect(
      controller.download('videos/abc.mp4', '1', 'x', {} as Response),
    ).rejects.toMatchObject({ status: 403 });
  });
});
