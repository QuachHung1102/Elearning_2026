import {
  Body,
  Controller,
  Get,
  Header,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { AuthRateLimitGuard } from '../auth/auth-rate-limit.guard.js';
import { RateLimit } from '../auth/rate-limit.decorator.js';
import {
  SessionAuthGuard,
  type AuthenticatedRequest,
} from '../auth/session-auth.guard.js';
import { CourseService } from '../catalog/course.service.js';
import { SlugParam } from '../catalog/course.dto.js';
import { ERROR_CODE, appError } from '../common/error-codes.js';
import { config } from '../config.js';
import {
  EnrollmentService,
  type AccessMode,
} from '../enrollment/enrollment.service.js';
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from '../media/object-storage.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProgressService } from './progress.service.js';

const uuid = () => new ParseUUIDPipe({ version: '4' });

export class ProgressDto {
  @IsInt()
  @Min(0)
  @Max(86_400)
  lastPositionSeconds: number;

  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}

/** Resources and progress belong to the enrollment branch only (D3). */
function requireEnrolled(mode: AccessMode): void {
  if (mode !== 'ENROLLED') {
    throw appError(
      HttpStatus.FORBIDDEN,
      ERROR_CODE.NOT_ENROLLED,
      'Not enrolled in this course',
    );
  }
}

/**
 * Learner reads and writes (API_CONTRACT.md §5.5, §5.6 download). Every route
 * resolves access through `EnrollmentService`, the one rule shared with the
 * playback token, so a lesson can never be readable here and locked there.
 */
@Controller()
@UseGuards(SessionAuthGuard, AuthRateLimitGuard)
export class LearningController {
  constructor(
    private readonly enrollments: EnrollmentService,
    private readonly progress: ProgressService,
    private readonly catalog: CourseService,
    private readonly prisma: PrismaService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  @Get('learn/:slug')
  @Header('Cache-Control', 'no-store')
  async shell(
    @Req() request: AuthenticatedRequest,
    @Param() params: SlugParam,
  ) {
    const { course, mode } = await this.enrollments.courseAccess(
      request.auth.user,
      params.slug,
    );
    // The admin preview reads the curriculum but no one's progress: zero done,
    // start at the first lesson (API_CONTRACT.md §5.5).
    const summary = await this.progress.courseSummary(
      mode === 'ENROLLED' ? request.auth.user.id : null,
      course.id,
    );
    return {
      course: await this.catalog.getCourseDetailForLearner(course.id),
      progress: summary.progress,
      completedLessonIds: summary.completedLessonIds,
      resumeLessonId: summary.resumeLessonId,
    };
  }

  @Get('lessons/:lessonId/content')
  @Header('Cache-Control', 'no-store')
  async content(
    @Req() request: AuthenticatedRequest,
    @Param('lessonId', uuid()) lessonId: string,
  ) {
    const { lesson, mode } = await this.enrollments.lessonAccess(
      request.auth.user,
      lessonId,
    );
    const enrolled = mode === 'ENROLLED';
    const courseId = lesson.section.courseId;
    const [ordered, resources, progress] = await Promise.all([
      this.prisma.lesson.findMany({
        where: { section: { courseId } },
        orderBy: [{ section: { position: 'asc' } }, { position: 'asc' }],
        select: { id: true },
      }),
      enrolled
        ? this.prisma.lessonResource.findMany({
            where: { lessonId },
            orderBy: { position: 'asc' },
            select: {
              id: true,
              filename: true,
              contentType: true,
              sizeBytes: true,
              position: true,
            },
          })
        : [],
      enrolled
        ? this.progress.lessonProgress(request.auth.user.id, lessonId)
        : null,
    ]);
    const index = ordered.findIndex(({ id }) => id === lessonId);
    return {
      id: lesson.id,
      courseId,
      sectionId: lesson.sectionId,
      title: lesson.title,
      type: lesson.type,
      content: lesson.content,
      durationSeconds: lesson.durationSeconds,
      hasVideo: lesson.videoAssetId !== null,
      isPreview: lesson.isPreview,
      resources,
      progress,
      prevLessonId: ordered[index - 1]?.id ?? null,
      nextLessonId: ordered[index + 1]?.id ?? null,
    };
  }

  @Put('lessons/:lessonId/progress')
  @Header('Cache-Control', 'no-store')
  @RateLimit({ key: 'user', limit: 60, windowSeconds: 60 })
  async saveProgress(
    @Req() request: AuthenticatedRequest,
    @Param('lessonId', uuid()) lessonId: string,
    @Body() input: ProgressDto,
  ) {
    const { lesson, mode } = await this.enrollments.lessonAccess(
      request.auth.user,
      lessonId,
    );
    // No admin branch: an owner's preview is not a learner's progress.
    requireEnrolled(mode);
    return this.progress.save(
      request.auth.user.id,
      { ...lesson, courseId: lesson.section.courseId },
      input,
    );
  }

  @Get('lessons/:lessonId/resources/:resourceId/download')
  @Header('Cache-Control', 'no-store')
  @RateLimit({ key: 'user', limit: 30, windowSeconds: 300 })
  async download(
    @Req() request: AuthenticatedRequest,
    @Param('lessonId', uuid()) lessonId: string,
    @Param('resourceId', uuid()) resourceId: string,
  ) {
    const { mode } = await this.enrollments.lessonAccess(
      request.auth.user,
      lessonId,
    );
    requireEnrolled(mode);
    // Scoped by lesson: a resource id from another lesson answers 404, so the
    // access check above can never be borrowed for someone else's file.
    const resource = await this.prisma.lessonResource.findFirst({
      where: { id: resourceId, lessonId },
      select: { objectKey: true, filename: true },
    });
    if (!resource) {
      throw appError(HttpStatus.NOT_FOUND, ERROR_CODE.NOT_FOUND, 'Not Found');
    }
    const ttl = config.signedFileTtlSeconds;
    return {
      url: await this.storage.signedDownloadUrl(resource.objectKey, ttl),
      filename: resource.filename,
      expiresAt: new Date(Date.now() + ttl * 1_000),
    };
  }
}
