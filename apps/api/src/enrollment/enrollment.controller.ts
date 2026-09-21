import {
  Controller,
  Get,
  Header,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { AuthRateLimitGuard } from '../auth/auth-rate-limit.guard.js';
import { RateLimit } from '../auth/rate-limit.decorator.js';
import {
  SessionAuthGuard,
  type AuthenticatedRequest,
} from '../auth/session-auth.guard.js';
import { CARD_SELECT, CatalogService } from '../catalog/catalog.service.js';
import { csv, PageQuery } from '../catalog/course.dto.js';
import { paginated, resolvePage } from '../common/pagination.js';
import {
  CourseStatus,
  EnrollmentStatus,
  UserRole,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { summarizeProgress } from './course-progress.js';

const MY_ENROLLMENT_SORTS = [
  'grantedAt:desc',
  'grantedAt:asc',
  'lastActivityAt:desc',
] as const;

export class MyEnrollmentsQuery extends PageQuery {
  @IsOptional()
  @csv()
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(EnrollmentStatus, { each: true })
  status?: EnrollmentStatus[];

  /** `true`/`false` only; anything else stays a string and fails `IsBoolean`. */
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  completed?: boolean;

  @IsOptional()
  @IsUUID('4')
  courseId?: string;

  @IsOptional()
  @IsIn(MY_ENROLLMENT_SORTS)
  sort?: (typeof MY_ENROLLMENT_SORTS)[number];
}

/**
 * `GET /enrollments/me` (API_CONTRACT.md §5.4). Registered in CatalogModule
 * because it renders `CourseCard`; EnrollmentModule must stay free of Media,
 * which will depend on it for the access rule.
 */
@Controller('enrollments')
export class EnrollmentController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
  ) {}

  @Get('me')
  @Header('Cache-Control', 'no-store')
  @RateLimit({ key: 'user', limit: 60, windowSeconds: 60 })
  @UseGuards(SessionAuthGuard, AuthRateLimitGuard)
  async mine(
    @Req() request: AuthenticatedRequest,
    @Query() query: MyEnrollmentsQuery,
  ) {
    const userId = request.auth.user.id;
    const page = resolvePage(query);
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        userId,
        status: query.status && { in: query.status },
        courseId: query.courseId,
        // D3 visibility: a course the caller could not open by slug (DRAFT,
        // or ARCHIVED without an ACTIVE enrollment) must not leak through here.
        ...(request.auth.user.role !== UserRole.ADMIN && {
          OR: [
            { course: { status: CourseStatus.PUBLISHED } },
            {
              status: EnrollmentStatus.ACTIVE,
              course: { status: CourseStatus.ARCHIVED },
            },
          ],
        }),
      },
      select: {
        id: true,
        status: true,
        source: true,
        grantedAt: true,
        course: {
          select: {
            ...CARD_SELECT,
            status: true,
            sections: {
              orderBy: { position: 'asc' },
              select: {
                lessons: { orderBy: { position: 'asc' }, select: { id: true } },
              },
            },
          },
        },
      },
    });
    const progressRows = await this.prisma.lessonProgress.findMany({
      where: {
        userId,
        lesson: {
          section: {
            courseId: { in: enrollments.map(({ course }) => course.id) },
          },
        },
      },
      select: { lessonId: true, completedAt: true, updatedAt: true },
    });

    // ponytail: the `completed` filter and the activity sort run in memory
    // over one learner's own enrollments (tens at most). Move both into SQL if
    // a learner ever holds thousands.
    let items = enrollments.map(({ course, ...enrollment }) => {
      const { sections, status, ...card } = course;
      const summary = summarizeProgress(
        sections.flatMap(({ lessons }) => lessons.map(({ id }) => id)),
        progressRows,
      );
      return {
        item: {
          ...enrollment,
          course: { ...this.catalog.toCourseCard(card), status },
          progress: summary.progress,
          resumeLessonId: summary.resumeLessonId,
        },
        lastActivityAt: summary.lastActivityAt ?? enrollment.grantedAt,
      };
    });
    if (query.completed !== undefined) {
      // An empty course is never "done": there is nothing to have finished.
      items = items.filter(
        ({ item: { progress } }) =>
          (progress.totalLessons > 0 &&
            progress.completedLessons === progress.totalLessons) ===
          query.completed,
      );
    }
    const sort = query.sort ?? 'grantedAt:desc';
    const key = (entry: (typeof items)[number]) =>
      (sort === 'lastActivityAt:desc'
        ? entry.lastActivityAt
        : entry.item.grantedAt
      ).getTime();
    const direction = sort === 'grantedAt:asc' ? 1 : -1;
    items.sort(
      (a, b) =>
        direction * (key(a) - key(b)) || a.item.id.localeCompare(b.item.id),
    );

    return paginated(
      items.slice(page.skip, page.skip + page.take).map(({ item }) => item),
      items.length,
      page,
    );
  }
}
