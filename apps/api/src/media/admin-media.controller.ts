import {
  Body,
  Controller,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard.js';
import { AuthRateLimitGuard } from '../auth/auth-rate-limit.guard.js';
import { AdminMutationRateLimit } from '../auth/rate-limit.decorator.js';
import {
  CoverUploadUrlDto,
  ResourceUploadUrlDto,
} from '../catalog/course.dto.js';
import { ERROR_CODE, appError } from '../common/error-codes.js';
import { config } from '../config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  OBJECT_STORAGE,
  coverKey,
  resourceKey,
  type ObjectStorage,
} from './object-storage.js';

const uuid = () => new ParseUUIDPipe({ version: '4' });

/**
 * Object keys are generated here, never accepted from the client — that is
 * what stops an uploader from writing outside its own prefix.
 */
@Controller('admin')
@UseGuards(AdminGuard, AuthRateLimitGuard)
export class AdminMediaController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  @Post('courses/:id/cover-upload-url')
  @AdminMutationRateLimit()
  async coverUploadUrl(
    @Param('id', uuid()) id: string,
    @Body() input: CoverUploadUrlDto,
  ) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!course) {
      throw appError(HttpStatus.NOT_FOUND, ERROR_CODE.NOT_FOUND, 'Not Found');
    }
    return this.signedUpload(coverKey(id, input.contentType), input.contentType);
  }

  @Post('lessons/:id/resources/upload-url')
  @AdminMutationRateLimit()
  async resourceUploadUrl(
    @Param('id', uuid()) id: string,
    @Body() input: ResourceUploadUrlDto,
  ) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!lesson) {
      throw appError(HttpStatus.NOT_FOUND, ERROR_CODE.NOT_FOUND, 'Not Found');
    }
    return this.signedUpload(
      resourceKey(id, input.filename),
      input.contentType,
    );
  }

  private async signedUpload(objectKey: string, contentType: string) {
    const ttl = config.signedFileTtlSeconds;
    return {
      uploadUrl: await this.storage.signedUploadUrl(
        objectKey,
        contentType,
        ttl,
      ),
      method: 'PUT',
      objectKey,
      expiresAt: new Date(Date.now() + ttl * 1000),
      maxBytes: config.maxUploadBytes,
    };
  }
}
