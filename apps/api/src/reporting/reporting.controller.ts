import {
  Controller,
  Get,
  HttpStatus,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard.js';
import { ReportRangeQuery } from '../catalog/course.dto.js';
import { ERROR_CODE, appError } from '../common/error-codes.js';
import {
  CourseStatus,
  EnrollmentStatus,
  VideoAssetStatus,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

const TIMEZONE = 'Asia/Ho_Chi_Minh';
const MAX_RANGE_DAYS = 366;
const DAY_MS = 86_400_000;

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
@UseGuards(AdminGuard)
export class ReportingController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('overview')
  async overview(@Query() query: ReportRangeQuery) {
    const { from, to } = this.range(query);

    const [newStudents, activeEnrollments, draftCourses, videoAssetsNotReady] =
      await Promise.all([
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
      ]);

    return {
      // Purchases arrive with checkout; the keys stay so /admin renders one
      // shape throughout.
      revenueVnd: 0,
      paidPurchases: 0,
      newStudents,
      activeEnrollments,
      draftCourses,
      pendingPaymentAttempts: 0,
      videoAssetsNotReady,
      series: this.emptySeries(from, to),
    };
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
  private emptySeries(from: Date, to: Date) {
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
      series.push({ date, revenueVnd: 0, purchases: 0 });
    }
    return series;
  }
}
