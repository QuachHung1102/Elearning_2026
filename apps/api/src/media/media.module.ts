import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { config } from '../config.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AdminMediaController } from './admin-media.controller.js';
import { AdminVideoController } from './admin-video.controller.js';
import { CloudflareStreamClient } from './cloudflare-stream.client.js';
import { LocalDiskStorage } from './local-disk.storage.js';
import { LocalFileController } from './local-file.controller.js';
import { LocalStreamClient } from './local-stream.client.js';
import { OBJECT_STORAGE } from './object-storage.js';
import { R2ObjectStorage } from './r2.storage.js';
import { STREAM_CLIENT } from './stream.client.js';

/**
 * Default is demo: only the exact string 'cloudflare' / 'r2' selects the real
 * client, so a typo is a loud failure in production rather than a silent one.
 *
 * `LocalFileController` is not registered at all under `STORAGE_DRIVER=r2` —
 * the route does not exist rather than being blocked by a guard.
 */
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [
    AdminMediaController,
    AdminVideoController,
    ...(config.storageDriver === 'r2' ? [] : [LocalFileController]),
  ],
  providers: [
    LocalDiskStorage,
    {
      provide: OBJECT_STORAGE,
      useClass:
        config.storageDriver === 'r2' ? R2ObjectStorage : LocalDiskStorage,
    },
    {
      provide: STREAM_CLIENT,
      useClass:
        config.videoDriver === 'cloudflare'
          ? CloudflareStreamClient
          : LocalStreamClient,
    },
  ],
  exports: [OBJECT_STORAGE, STREAM_CLIENT],
})
export class MediaModule {}
