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
import { AuditActor } from '../audit/audit-actor.decorator.js';
import {
  AuditService,
  type AuditActorContext,
} from '../audit/audit.service.js';
import { AuthRateLimitGuard } from '../auth/auth-rate-limit.guard.js';
import {
  OwnerScope,
  StaffAccess,
  StaffGuard,
} from '../auth/staff.guard.js';
import {
  AdminMutationRateLimit,
  RateLimit,
} from '../auth/rate-limit.decorator.js';
import { lockCourse, recomputeCourse } from '../catalog/catalog.shared.js';
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

/** A poll younger than this is answered from the row, not the provider. */
const STATUS_FRESH_MS = 10_000;

/**
 * The only way a `VideoAsset` row comes into existence. No Cloudflare webhook:
 * one owner uploads a handful of videos a month, so `GET /admin/videos/{id}`
 * polls while the lesson screen is open.
 *
 * An asset belongs to whoever registered it (`instructorId`, null = an admin,
 * i.e. the site owner); an instructor only ever sees their own.
 */
@Controller('admin/videos')
@UseGuards(StaffGuard, AuthRateLimitGuard)
export class AdminVideoController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(STREAM_CLIENT) private readonly stream: StreamClient,
  ) {}

  @Post()
  @StaffAccess('scoped')
  @AdminMutationRateLimit()
  async create(
    @Body() input: CreateVideoDto,
    @AuditActor() actor: AuditActorContext,
    @OwnerScope() ownerId: string | null,
  ) {
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
    const asset = await this.prisma.$transaction(async (tx) => {
      const created = await tx.videoAsset.create({
        data: {
          provider,
          externalId: input.externalId,
          instructorId: ownerId,
          status: status.errored
            ? VideoAssetStatus.ERRORED
            : status.ready
              ? VideoAssetStatus.READY
              : VideoAssetStatus.PENDING,
          durationSeconds: status.durationSeconds,
        },
      });
      await this.audit.record(
        {
          ...actor,
          action: 'video.registered',
          entityType: 'VIDEO_ASSET',
          entityId: created.id,
          metadata: { provider, externalId: created.externalId },
        },
        tx,
      );
      return created;
    });
    return this.toDto(asset);
  }

  @Get(':id')
  @StaffAccess('scoped')
  @RateLimit({ key: 'user', limit: 30, windowSeconds: 60 })
  async get(
    @Param('id', uuid()) id: string,
    @OwnerScope() ownerId: string | null,
  ) {
    const asset = await this.prisma.videoAsset.findUnique({ where: { id } });
    if (!asset || (ownerId !== null && asset.instructorId !== ownerId)) {
      throw appError(HttpStatus.NOT_FOUND, ERROR_CODE.NOT_FOUND, 'Not Found');
    }
    // READY and ERRORED are final, and a fresh answer is reused: the provider
    // is only asked about a pending video, at most once per STATUS_FRESH_MS.
    if (
      asset.status === VideoAssetStatus.READY ||
      asset.status === VideoAssetStatus.ERRORED ||
      Date.now() - asset.updatedAt.getTime() < STATUS_FRESH_MS
    ) {
      return this.toDto(asset);
    }
    // Synchronous poll: read the provider, then write back what it said. A
    // provider that cannot answer throws, and the row stays as it was.
    const status = await this.stream.getStatus(asset.externalId);
    const next = status.errored
      ? VideoAssetStatus.ERRORED
      : status.ready
        ? VideoAssetStatus.READY
        : VideoAssetStatus.PROCESSING;
    const durationSeconds = status.durationSeconds || asset.durationSeconds;
    const updated = await this.prisma.$transaction(async (tx) => {
      // Attaching copied the duration the asset had then — 0 while encoding —
      // so the lesson and the course total catch up when it turns ready.
      const lesson =
        next === VideoAssetStatus.READY
          ? await tx.lesson.findUnique({
              where: { videoAssetId: id },
              select: { id: true, section: { select: { courseId: true } } },
            })
          : null;
      if (lesson) await lockCourse(tx, lesson.section.courseId);
      const row = await tx.videoAsset.update({
        where: { id },
        data: { status: next, durationSeconds },
      });
      if (lesson) {
        await tx.lesson.update({
          where: { id: lesson.id },
          data: { durationSeconds },
        });
        await recomputeCourse(tx, lesson.section.courseId);
      }
      return row;
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
