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
import { CARD_SELECT, CourseService } from '../catalog/course.service.js';
import { csv, PageQuery } from '../catalog/course.dto.js';
import { paginated, resolvePage } from '../common/pagination.js';
import { Prisma } from '../generated/prisma/client.js';
import { EnrollmentStatus, UserRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { courseProgress, PROGRESS_STATS } from './course-progress.js';

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
    private readonly catalog: CourseService,
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
    const where = [
      Prisma.sql`e.user_id = ${userId}::uuid`,
      ...(query.status
        ? [Prisma.sql`e.status::text IN (${Prisma.join(query.status)})`]
        : []),
      ...(query.courseId
        ? [Prisma.sql`e.course_id = ${query.courseId}::uuid`]
        : []),
      // D3 visibility: a course the caller could not open by slug (DRAFT,
      // or ARCHIVED without an ACTIVE enrollment) must not leak through here.
      ...(request.auth.user.role !== UserRole.ADMIN
        ? [
            Prisma.sql`(c.status = 'PUBLISHED' OR (e.status = 'ACTIVE' AND c.status = 'ARCHIVED'))`,
          ]
        : []),
    ];
    // An empty course is never "done": there is nothing to have finished.
    const completed =
      query.completed === undefined
        ? Prisma.sql`TRUE`
        : Prisma.sql`(total > 0 AND completed = total) = ${query.completed}`;
    const order = {
      'grantedAt:desc': Prisma.sql`granted_at DESC, id`,
      'grantedAt:asc': Prisma.sql`granted_at ASC, id`,
      'lastActivityAt:desc': Prisma.sql`last_activity_at DESC, id`,
    }[query.sort ?? 'grantedAt:desc'];

    // Filter, sort and page in one statement (REVIEW F-14). The LEFT JOIN
    // keeps the count row when the page is past the end. Resume: the lesson
    // touched last (curriculum order breaks a tie), else the first lesson.
    const rows = await this.prisma.$queryRaw<
      {
        totalRows: number;
        id: string | null;
        total: number;
        completed: number;
        resumeLessonId: string | null;
      }[]
    >`
      WITH filtered AS (
        SELECT e.id, e.course_id, e.granted_at, stats.total, stats.completed,
               COALESCE(stats.last_activity_at, e.granted_at) AS last_activity_at
        FROM enrollments e
        JOIN courses c ON c.id = e.course_id
        ${PROGRESS_STATS}
        WHERE ${Prisma.join(where, ' AND ')}
      )
      SELECT counted.total_rows AS "totalRows", paged.id, paged.total,
             paged.completed, paged.resume_lesson_id AS "resumeLessonId"
      FROM (
        SELECT count(*)::int AS total_rows FROM filtered WHERE ${completed}
      ) counted
      LEFT JOIN LATERAL (
        SELECT f.id, f.total, f.completed,
               row_number() OVER (ORDER BY ${order}) AS position,
               COALESCE(
                 (SELECT p.lesson_id
                  FROM lesson_progress p
                  JOIN lessons l ON l.id = p.lesson_id
                  JOIN sections s ON s.id = l.section_id
                  WHERE s.course_id = f.course_id AND p.user_id = ${userId}::uuid
                  ORDER BY p.updated_at DESC, s.position, l.position
                  LIMIT 1),
                 (SELECT l.id
                  FROM lessons l
                  JOIN sections s ON s.id = l.section_id
                  WHERE s.course_id = f.course_id
                  ORDER BY s.position, l.position
                  LIMIT 1)
               ) AS resume_lesson_id
        FROM filtered f
        WHERE ${completed}
        ORDER BY ${order}
        LIMIT ${page.take} OFFSET ${page.skip}
      ) paged ON TRUE
      ORDER BY paged.position`;
    const pageRows = rows.filter((row) => row.id !== null);

    const enrollments = pageRows.length
      ? await this.prisma.enrollment.findMany({
          where: { id: { in: pageRows.map(({ id }) => id!) } },
          select: {
            id: true,
            status: true,
            source: true,
            grantedAt: true,
            course: { select: { ...CARD_SELECT, status: true } },
          },
        })
      : [];
    const byId = new Map(enrollments.map((row) => [row.id, row]));
    const items = pageRows.flatMap((row) => {
      const found = byId.get(row.id!);
      if (!found) return [];
      const {
        course: { status, ...card },
        ...enrollment
      } = found;
      return [
        {
          ...enrollment,
          course: { ...this.catalog.toCourseCard(card), status },
          progress: courseProgress(row.completed, row.total),
          resumeLessonId: row.resumeLessonId,
        },
      ];
    });

    return paginated(items, rows[0]?.totalRows ?? 0, page);
  }
}
