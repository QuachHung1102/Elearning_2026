import {
  Controller,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthRateLimitGuard } from '../auth/auth-rate-limit.guard.js';
import { RateLimit } from '../auth/rate-limit.decorator.js';
import {
  SessionAuthGuard,
  type AuthenticatedRequest,
} from '../auth/session-auth.guard.js';
import { ERROR_CODE, appError } from '../common/error-codes.js';
import { config } from '../config.js';
import { EnrollmentService } from '../enrollment/enrollment.service.js';
import { STREAM_CLIENT, type StreamClient } from './stream.client.js';

/**
 * `POST /lessons/{lessonId}/playback-token` — the eight steps of
 * API_CONTRACT.md §6.1, in order. Steps 2–4 are the shared access rule.
 */
@Controller('lessons')
export class PlaybackController {
  constructor(
    private readonly enrollments: EnrollmentService,
    @Inject(STREAM_CLIENT) private readonly stream: StreamClient,
  ) {}

  @Post(':lessonId/playback-token')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @RateLimit({ key: 'user', limit: 30, windowSeconds: 60 })
  // Step 1: a session is required even for a preview lesson.
  @UseGuards(SessionAuthGuard, AuthRateLimitGuard)
  async playbackToken(
    @Req() request: AuthenticatedRequest,
    @Param('lessonId', new ParseUUIDPipe({ version: '4' })) lessonId: string,
  ) {
    // Steps 2–4: ENROLLED, ADMIN and PREVIEW all may play.
    const { lesson } = await this.enrollments.lessonAccess(
      request.auth.user,
      lessonId,
    );
    // Step 5: an ARTICLE, or a VIDEO lesson with nothing attached.
    if (!lesson.videoAsset) {
      throw appError(HttpStatus.NOT_FOUND, ERROR_CODE.NOT_FOUND, 'Not Found');
    }
    // Step 6: awaited — a Promise has no `.ready`, so forgetting it answers
    // 409 to every request.
    const status = await this.stream.getStatus(lesson.videoAsset.externalId);
    if (status.ready !== true) {
      throw appError(
        HttpStatus.CONFLICT,
        ERROR_CODE.VIDEO_NOT_READY,
        'Video is not ready',
      );
    }
    // Steps 7–8: bound to this video and this viewer; nothing else returned.
    const token = await this.stream.signPlayback(
      lesson.videoAsset.externalId,
      config.playbackTokenTtlSeconds,
      request.auth.user.id,
    );
    return {
      playbackUrl: token.playbackUrl,
      kind: token.kind,
      expiresAt: token.expiresAt,
    };
  }
}
