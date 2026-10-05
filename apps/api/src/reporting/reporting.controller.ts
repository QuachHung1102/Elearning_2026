import {
  Controller,
  Get,
  HttpStatus,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OwnerScope, StaffAccess, StaffGuard } from '../auth/staff.guard.js';
import { CourseReportQuery, ReportRangeQuery } from '../catalog/course.dto.js';
import { ERROR_CODE, appError } from '../common/error-codes.js';
import { paginated, resolvePage } from '../common/pagination.js';
import {
  CourseStatus,
  EnrollmentStatus,
  PaymentAttemptStatus,
  PurchaseStatus,
  VideoAssetStatus,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

const TIMEZONE = 'Asia/Ho_Chi_Minh';
const MAX_RANGE_DAYS = 366;
const DAY_MS = 86_400_000;

/**
 * What counts as money: an order that is paid, or paid and awaiting a refund
 * decision. REFUNDED is out (revenue is net of refunds); PENDING and CANCELLED
 * never were money.
 */
const SOLD = [PurchaseStatus.PAID, PurchaseStatus.REFUND_REQUESTED];

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Read only. Feeds the five `StatTile` cards on `/admin`; the two revenue
 * cards are hidden by the web app while checkout is off, but the keys are
 * always present so the shape does not change when it is switched on.
 */
@Controller('admin/reports')
@UseGuards(StaffGuard)
export class ReportingController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('instructor-overview')
  @StaffAccess('scoped')
  async instructorOverview(@OwnerScope() ownerId: string | null) {
    const course = ownerId ? { instructorId: ownerId } : {};
    const since = new Date(Date.now() - 30 * DAY_MS);
    const [publishedCourses, draftCourses, activeEnrollments, newEnrollments30d] =
      await Promise.all([
        this.prisma.course.count({ where: { ...course, status: CourseStatus.PUBLISHED } }),
        this.prisma.course.count({ where: { ...course, status: CourseStatus.DRAFT } }),
        this.prisma.enrollment.count({ where: { status: EnrollmentStatus.ACTIVE, course } }),
        this.prisma.enrollment.count({ where: { grantedAt: { gte: since }, course } }),
      ]);
    return { publishedCourses, draftCourses, activeEnrollments, newEnrollments30d };
  }

  @Get('overview')
  async overview(@Query() query: ReportRangeQuery) {
    const { from, to } = this.range(query);

    const [
      newStudents,
      activeEnrollments,
      draftCourses,
      videoAssetsNotReady,
      pendingPaymentAttempts,
      sales,
      daily,
    ] = await Promise.all([
        this.prisma.user.count({
          where: { role: 'STUDENT', createdAt: { gte: from, lte: to } },
        }),
        // Current state, like the draft and video counts: not range-bound.
        this.prisma.enrollment.count({
          where: { status: EnrollmentStatus.ACTIVE },
        }),
        this.prisma.course.count({ where: { status: CourseStatus.DRAFT } }),
        this.prisma.videoAsset.count({
          where: { status: { not: VideoAssetStatus.READY } },
        }),
        // Current state as well: a QR waiting for payment right now.
        this.prisma.paymentAttempt.count({
          where: { status: PaymentAttemptStatus.PENDING },
        }),
        this.prisma.purchase.aggregate({
          where: { status: { in: SOLD }, paidAt: { gte: from, lte: to } },
          _sum: { priceVnd: true },
          _count: true,
        }),
        this.dailySales(from, to),
      ]);

    return {
      revenueVnd: sales._sum.priceVnd ?? 0,
      paidPurchases: sales._count,
      newStudents,
      activeEnrollments,
      draftCourses,
      pendingPaymentAttempts,
      videoAssetsNotReady,
      series: this.series(from, to, daily),
    };
  }

  /**
   * Revenue, new learners, active learners and completion per course, biggest
   * earner first. Revenue and new learners are bound to the range; the active
   * count and the completion rate are the state right now.
   * ponytail: assembled and sorted in memory, which is fine for a catalog of
   * hundreds; move the join and the ORDER BY into SQL when it is not.
   */
  @Get('courses')
  async courses(@Query() query: CourseReportQuery) {
    const { from, to } = this.range(query);
    const page = resolvePage(query);
    const inRange = { gte: from, lte: to };
    const [courses, revenue, joined, active, completed] = await Promise.all([
      this.prisma.course.findMany({
        where: { status: { not: CourseStatus.DRAFT } },
        select: { id: true, title: true },
      }),
      this.prisma.purchase.groupBy({
        by: ['courseId'],
        where: { status: { in: SOLD }, paidAt: inRange },
        _sum: { priceVnd: true },
      }),
      this.prisma.enrollment.groupBy({
        by: ['courseId'],
        where: { grantedAt: inRange },
        _count: { _all: true },
      }),
      this.prisma.enrollment.groupBy({
        by: ['courseId'],
        where: { status: EnrollmentStatus.ACTIVE },
        _count: { _all: true },
      }),
      this.completedLearners(),
    ]);

    const by = <T>(rows: T[], key: (row: T) => string) =>
      new Map(rows.map((row) => [key(row), row]));
    const revenueOf = by(revenue, (row) => row.courseId);
    const joinedOf = by(joined, (row) => row.courseId);
    const activeOf = by(active, (row) => row.courseId);
    const completedOf = by(completed, (row) => row.courseId);

    const rows = courses
      .map(({ id, title }) => {
        const activeStudents = activeOf.get(id)?._count._all ?? 0;
        const done = completedOf.get(id)?.completed ?? 0;
        return {
          courseId: id,
          title,
          revenueVnd: revenueOf.get(id)?._sum.priceVnd ?? 0,
          newEnrollments: joinedOf.get(id)?._count._all ?? 0,
          activeStudents,
          // No active learner, no rate: null, not a misleading 0.
          completionRate: activeStudents
            ? Math.round((done / activeStudents) * 10_000) / 10_000
            : null,
        };
      })
      .sort(
        (a, b) =>
          b.revenueVnd - a.revenueVnd ||
          b.activeStudents - a.activeStudents ||
          a.title.localeCompare(b.title, 'vi') ||
          a.courseId.localeCompare(b.courseId),
      );
    return paginated(rows.slice(page.skip, page.skip + page.take), rows.length, page);
  }

  /**
   * Money per Vietnamese calendar day. The grouping happens in SQL with
   * `AT TIME ZONE`: grouping in UTC would put a 07:00 sale in the previous
   * day and shift the whole chart (API_CONTRACT.md §5.7).
   */
  private dailySales(from: Date, to: Date) {
    return this.prisma.$queryRaw<
      { date: string; revenueVnd: number; purchases: number }[]
    >`
      SELECT to_char(paid_at AT TIME ZONE ${TIMEZONE}, 'YYYY-MM-DD') AS date,
             COALESCE(SUM(price_vnd), 0)::float8 AS "revenueVnd",
             COUNT(*)::int AS purchases
      FROM purchases
      WHERE status IN ('PAID', 'REFUND_REQUESTED')
        AND paid_at >= ${from} AND paid_at <= ${to}
      GROUP BY 1`;
  }

  /** ACTIVE learners who have completed every lesson of the course. */
  private completedLearners() {
    return this.prisma.$queryRaw<{ courseId: string; completed: number }[]>`
      SELECT e.course_id AS "courseId", COUNT(*)::int AS completed
      FROM enrollments e
      JOIN (
        SELECT s.course_id, COUNT(*) AS total
        FROM lessons l JOIN sections s ON s.id = l.section_id
        GROUP BY s.course_id
      ) t ON t.course_id = e.course_id
      WHERE e.status = 'ACTIVE'
        AND (
          SELECT COUNT(*)
          FROM lesson_progress lp
          JOIN lessons l ON l.id = lp.lesson_id
          JOIN sections s ON s.id = l.section_id
          WHERE lp.user_id = e.user_id
            AND s.course_id = e.course_id
            AND lp.completed_at IS NOT NULL
        ) = t.total
      GROUP BY e.course_id`;
  }

  /** Missing range means the last 30 calendar days in Vietnam time. */
  private range(query: ReportRangeQuery): { from: Date; to: Date } {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - 29 * DAY_MS);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw appError(
        HttpStatus.BAD_REQUEST,
        ERROR_CODE.VALIDATION_FAILED,
        'Invalid reporting range',
      );
    }
    if (from > to || to.getTime() - from.getTime() > MAX_RANGE_DAYS * DAY_MS) {
      throw appError(
        HttpStatus.BAD_REQUEST,
        ERROR_CODE.VALIDATION_FAILED,
        `Reporting range must be between 0 and ${MAX_RANGE_DAYS} days`,
      );
    }
    return { from, to };
  }

  /**
   * `date` is a calendar day in Vietnam time, formatted "YYYY-MM-DD" — the
   * single documented exception to the ISO-UTC rule, because forcing a
   * calendar day through UTC shifts the whole chart by one day.
   */
  private series(
    from: Date,
    to: Date,
    daily: { date: string; revenueVnd: number; purchases: number }[],
  ) {
    const sold = new Map(daily.map((day) => [day.date, day]));
    const series: { date: string; revenueVnd: number; purchases: number }[] =
      [];
    const seen = new Set<string>();
    for (
      let cursor = from.getTime();
      cursor <= to.getTime() + DAY_MS;
      cursor += DAY_MS
    ) {
      const date = dayFormatter.format(new Date(cursor));
      if (date > dayFormatter.format(to) || seen.has(date)) continue;
      seen.add(date);
      series.push({
        date,
        revenueVnd: sold.get(date)?.revenueVnd ?? 0,
        purchases: sold.get(date)?.purchases ?? 0,
      });
    }
    return series;
  }
}
