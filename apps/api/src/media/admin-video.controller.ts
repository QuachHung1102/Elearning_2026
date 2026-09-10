import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard.js';
import { CreateVideoDto } from '../catalog/course.dto.js';
import { ERROR_CODE, appError } from '../common/error-codes.js';
import { config } from '../config.js';
import {
  VideoAssetStatus,
  VideoProvider,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { STREAM_CLIENT, type StreamClient } from './stream.client.js';

const uuid = () => new ParseUUIDPipe({ version: '4' });

/**
 * The only way a `VideoAsset` row comes into existence. No Cloudflare webhook:
 * one owner uploads a handful of videos a month, so `GET /admin/videos/{id}`
 * polls while the lesson screen is open.
 */
@Controller('admin/videos')
@UseGuards(AdminGuard)
export class AdminVideoController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STREAM_CLIENT) private readonly stream: StreamClient,
  ) {}

  @Post()
  async create(@Body() input: CreateVideoDto) {
    const provider = this.provider();
    const existing = await this.prisma.videoAsset.findUnique({
      where: {
        provider_externalId: { provider, externalId: input.externalId },
      },
      select: { id: true },
    });
    if (existing) {
      throw appError(
        HttpStatus.CONFLICT,
        ERROR_CODE.EXTERNAL_ID_TAKEN,
        'This video is already registered',
      );
    }

    const status = await this.stream.getStatus(input.externalId);
    const asset = await this.prisma.videoAsset.create({
      data: {
        provider,
        externalId: input.externalId,
        status: status.ready
          ? VideoAssetStatus.READY
          : VideoAssetStatus.PENDING,
        durationSeconds: status.durationSeconds,
      },
    });
    return this.toDto(asset);
  }

  @Get(':id')
  async get(@Param('id', uuid()) id: string) {
    const asset = await this.prisma.videoAsset.findUnique({ where: { id } });
    if (!asset) {
      throw appError(HttpStatus.NOT_FOUND, ERROR_CODE.NOT_FOUND, 'Not Found');
    }
    // Synchronous poll: read the provider, then write back what it said.
    const status = await this.stream.getStatus(asset.externalId);
    const updated = await this.prisma.videoAsset.update({
      where: { id },
      data: {
        status: status.ready
          ? VideoAssetStatus.READY
          : asset.status === VideoAssetStatus.ERRORED
            ? VideoAssetStatus.ERRORED
            : VideoAssetStatus.PROCESSING,
        durationSeconds: status.durationSeconds || asset.durationSeconds,
      },
    });
    return this.toDto(updated);
  }

  private provider(): VideoProvider {
    return config.videoDriver === 'cloudflare'
      ? VideoProvider.CLOUDFLARE_STREAM
      : VideoProvider.DEMO;
  }

  private toDto(asset: {
    id: string;
    provider: VideoProvider;
    externalId: string;
    status: VideoAssetStatus;
    durationSeconds: number;
    thumbnailUrl: string | null;
  }) {
    return {
      id: asset.id,
      provider: asset.provider,
      externalId: asset.externalId,
      status: asset.status,
      durationSeconds: asset.durationSeconds,
      thumbnailUrl: asset.thumbnailUrl,
    };
  }
}
