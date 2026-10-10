import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  AuditService,
  type AuditActorContext,
} from '../audit/audit.service.js';
import { ERROR_CODE, appError } from '../common/error-codes.js';
import {
  paginated,
  resolvePage,
  type Paginated,
} from '../common/pagination.js';
import { Prisma, UserRole } from '../generated/prisma/client.js';
import {
  CourseLevel,
  CourseStatus,
  EnrollmentStatus,
} from '../generated/prisma/enums.js';
import {
  isCoverKeyFor,
  OBJECT_STORAGE,
  type ObjectStorage,
} from '../media/object-storage.js';
import { STREAM_CLIENT, type StreamClient } from '../media/stream.client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  lockCourse,
  mustFindCategory,
  mustFindCourse,
  notFound,
  resolveSlug,
  storageProvider,
  toCategory,
  toSectionOutline,
  writeWithSlug,
  type CategoryDto,
  type LessonRow,
} from './catalog.shared.js';
import {
  publishIssues,
  type PublishIssue,
} from './publish-validation.js';
import { buildSearchText, normalize } from './search-text.js';
import type {
  AdminCourseListQuery,
  CourseListQuery,
  CreateCourseDto,
  UpdateCourseDto,
} from './course.dto.js';

export const CATALOG_PAGE_SIZE = 12;

export const CARD_SELECT = {
  id: true,
  slug: true,
  title: true,
  subtitle: true,
  coverImageKey: true,
  priceVnd: true,
  compareAtPriceVnd: true,
  level: true,
  language: true,
  lessonCount: true,
  totalDurationSeconds: true,
  enrollmentCount: true,
  ratingAverage: true,
  ratingCount: true,
  demoStats: true,
  category: true,
  instructor: { select: { displayName: true } },
} satisfies Prisma.CourseSelect;

@Injectable()
export class CourseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(STREAM_CLIENT) private readonly stream: StreamClient,
  ) {}

  // ── Public catalog ───────────────────────────────────────────────

  async listCourses(query: CourseListQuery): Promise<Paginated<CourseCard>> {
    const page = resolvePage(query, CATALOG_PAGE_SIZE);
    const where: Prisma.CourseWhereInput = { status: CourseStatus.PUBLISHED };

    if (query.q) where.searchText = { contains: normalize(query.q) };
    if (query.category?.length) {
      where.category = { slug: { in: query.category } };
    }
    if (query.level?.length) where.level = { in: query.level };
    if (query.priceVndMin !== undefined || query.priceVndMax !== undefined) {
      where.priceVnd = {
        ...(query.priceVndMin === undefined ? {} : { gte: query.priceVndMin }),
        ...(query.priceVndMax === undefined ? {} : { lte: query.priceVndMax }),
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        select: CARD_SELECT,
        orderBy: this.courseOrder(query.sort),
        skip: page.skip,
        take: page.take,
      }),
      this.prisma.course.count({ where }),
    ]);
    return paginated(
      items.map((course) => this.toCourseCard(course)),
      total,
      page,
    );
  }

  async getCourseBySlug(slug: string) {
    const course = await this.prisma.course.findFirst({
      where: { slug, status: CourseStatus.PUBLISHED },
      include: this.detailInclude,
    });
    // A DRAFT or ARCHIVED course answers exactly like a slug that never
    // existed — there is no `?preview=` back door.
    if (!course) notFound();
    return this.toCourseDetail(course);
  }

  /**
   * The learner shell (`GET /learn/{slug}`): `CourseDetail` plus `status`,
   * whatever the status. The caller has already applied the access rule.
   */
  async getCourseDetailForLearner(id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: this.detailInclude,
    });
    if (!course) notFound();
    return { ...this.toCourseDetail(course), status: course.status };
  }

  // ── Admin: courses ───────────────────────────────────────────────

  async listCoursesForAdmin(
    query: AdminCourseListQuery,
    ownerId: string | null = null,
  ) {
    const page = resolvePage(query);
    const where: Prisma.CourseWhereInput = {};
    if (ownerId) where.instructorId = ownerId;
    if (query.q) where.searchText = { contains: normalize(query.q) };
    if (query.status?.length) where.status = { in: query.status };

    const [field, direction] = (query.sort ?? 'updatedAt:desc').split(':') as [
      string,
      'asc' | 'desc',
    ];
    const [items, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        select: { ...CARD_SELECT, status: true, updatedAt: true, instructorId: true },
        // Courses that tie on the key keep one order, or a page boundary repeats one and skips another.
        orderBy: [{ [field]: direction }, { id: 'asc' }],
        skip: page.skip,
        take: page.take,
      }),
      this.prisma.course.count({ where }),
    ]);
    return paginated(
      items.map((course) => ({
        ...this.toCourseCard(course),
        status: course.status,
        updatedAt: course.updatedAt,
        instructorId: course.instructorId,
      })),
      total,
      page,
    );
  }

  async getCourseForAdmin(id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: this.adminDetailInclude(),
    });
    if (!course) notFound();
    return {
      ...this.toCourseDetail(course),
      status: course.status,
      archivedAt: course.archivedAt,
      instructorId: course.instructorId,
      videoAssets: course.sections.flatMap((section) =>
        section.lessons.flatMap((lesson) =>
          lesson.videoAsset
            ? [
                {
                  lessonId: lesson.id,
                  provider: lesson.videoAsset.provider,
                  externalId: lesson.videoAsset.externalId,
                  status: lesson.videoAsset.status,
                  durationSeconds: lesson.videoAsset.durationSeconds,
                },
              ]
            : [],
        ),
      ),
    };
  }

  async createCourse(
    input: CreateCourseDto,
    actor: AuditActorContext,
    ownerId: string | null = null,
  ) {
    return writeWithSlug(
      () =>
        resolveSlug(input.slug, input.title, 120, (value) =>
          this.courseSlugTaken(value),
        ),
      async (slug) => {
        if (input.categoryId) await mustFindCategory(this.prisma, input.categoryId);
        return this.prisma.$transaction(async (tx) => {
          const course = await tx.course.create({
            data: {
              slug,
              title: input.title,
              description: '',
              searchText: buildSearchText(input.title),
              priceVnd: 0,
              categoryId: input.categoryId ?? null,
              instructorId: ownerId,
              learningOutcomes: [],
              requirements: [],
              targetAudience: [],
            },
            include: this.detailInclude,
          });
          await this.audit.record(
            {
              ...actor,
              action: 'course.created',
              entityType: 'COURSE',
              entityId: course.id,
              metadata: { slug: course.slug },
            },
            tx,
          );
          return this.toCourseDetail(course);
        });
      },
    );
  }

  async updateCourse(
    id: string,
    input: UpdateCourseDto,
    actor: AuditActorContext,
  ) {
    const course = await mustFindCourse(this.prisma, id);

    if (input.slug !== undefined && input.slug !== course.slug) {
      // Slug locks on `publishedAt`, not on `status`: unpublishing does not
      // reopen the field, because shared links and the sitemap already point
      // at the old value.
      if (course.publishedAt) {
        throw appError(
          HttpStatus.CONFLICT,
          ERROR_CODE.CONFLICT,
          'Slug cannot change after the first publish',
        );
      }
      if (await this.courseSlugTaken(input.slug, id)) {
        throw appError(
          HttpStatus.CONFLICT,
          ERROR_CODE.SLUG_TAKEN,
          'Slug is already taken',
        );
      }
    }
    if (input.categoryId) await mustFindCategory(this.prisma, input.categoryId);
    if (input.coverImageKey && !isCoverKeyFor(id, input.coverImageKey)) {
      throw appError(
        HttpStatus.BAD_REQUEST,
        ERROR_CODE.VALIDATION_FAILED,
        'coverImageKey must belong to this course',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      // The new owner's role is read under a share lock here, not before the
      // transaction: a demotion racing this waits for it (and then releases the
      // course) or commits first (and this refuses), so a course is never left
      // with an owner who is no longer an instructor.
      if (input.instructorId) {
        const [teacher] = await tx.$queryRaw<{ role: string }[]>`
          SELECT role FROM users WHERE id = ${input.instructorId}::uuid FOR SHARE`;
        if (teacher?.role !== UserRole.INSTRUCTOR) {
          throw appError(
            HttpStatus.BAD_REQUEST,
            ERROR_CODE.VALIDATION_FAILED,
            'instructorId must reference an instructor',
          );
        }
      }
      // Locked and read here, not taken from the snapshot above: a PATCH that
      // leaves the price out must not put back the one it saw before another
      // edit landed, and the price check needs the values as they are now.
      const [stored] = await tx.$queryRaw<
        {
          title: string;
          subtitle: string | null;
          price_vnd: number;
          compare_at_price_vnd: number | null;
        }[]
      >`SELECT title, subtitle, price_vnd, compare_at_price_vnd
        FROM courses WHERE id = ${id}::uuid FOR NO KEY UPDATE`;
      if (!stored) notFound();
      const title = input.title ?? stored.title;
      const subtitle =
        input.subtitle === undefined ? stored.subtitle : input.subtitle || null;
      const priceVnd = input.priceVnd ?? stored.price_vnd;
      const compareAtPriceVnd =
        input.compareAtPriceVnd === undefined
          ? stored.compare_at_price_vnd
          : (input.compareAtPriceVnd ?? null);
      if (compareAtPriceVnd !== null && compareAtPriceVnd <= priceVnd) {
        throw appError(
          HttpStatus.BAD_REQUEST,
          ERROR_CODE.VALIDATION_FAILED,
          'compareAtPriceVnd must be greater than priceVnd',
        );
      }
      const updated = await tx.course.update({
        where: { id },
        data: {
          ...(input.title === undefined ? {} : { title }),
          ...(input.subtitle === undefined ? {} : { subtitle }),
          ...(input.priceVnd === undefined ? {} : { priceVnd }),
          ...(input.compareAtPriceVnd === undefined
            ? {}
            : { compareAtPriceVnd }),
          ...(input.title === undefined && input.subtitle === undefined
            ? {}
            : { searchText: buildSearchText(title, subtitle) }),
          ...(input.slug === undefined ? {} : { slug: input.slug }),
          ...(input.description === undefined
            ? {}
            : { description: input.description }),
          ...(input.level === undefined ? {} : { level: input.level }),
          ...(input.language === undefined
            ? {}
            : { language: input.language }),
          ...(input.categoryId === undefined
            ? {}
            : { categoryId: input.categoryId ?? null }),
          ...(input.instructorId === undefined
            ? {}
            : { instructorId: input.instructorId ?? null }),
          ...(input.learningOutcomes === undefined
            ? {}
            : { learningOutcomes: input.learningOutcomes }),
          ...(input.requirements === undefined
            ? {}
            : { requirements: input.requirements }),
          ...(input.targetAudience === undefined
            ? {}
            : { targetAudience: input.targetAudience }),
          ...(input.coverImageKey === undefined
            ? {}
            : {
                coverImageKey: input.coverImageKey || null,
                coverImageStorage: input.coverImageKey
                  ? storageProvider()
                  : null,
              }),
        },
        include: this.detailInclude,
      });
      const instructorReassigned =
        input.instructorId !== undefined &&
        (input.instructorId ?? null) !== course.instructorId;
      await this.audit.record(
        {
          ...actor,
          action: 'course.updated',
          entityType: 'COURSE',
          entityId: id,
          metadata: {
            slug: updated.slug,
            ...(instructorReassigned
              ? {
                  fromInstructorId: course.instructorId,
                  toInstructorId: input.instructorId ?? null,
                }
              : {}),
          },
        },
        tx,
      );
      return this.toCourseDetail(updated);
    });
  }

  async publishCourse(id: string, actor: AuditActorContext) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: this.adminDetailInclude(),
    });
    if (!course) notFound();

    const lessons = course.sections.flatMap((section) => section.lessons);
    // `getStatus()` is read live rather than trusting the stored column: a
    // video that finished encoding since the last write is ready now.
    const readiness = new Map<string, boolean>();
    await Promise.all(
      lessons
        .filter((lesson) => lesson.videoAsset)
        .map(async (lesson) => {
          const asset = lesson.videoAsset!;
          const status = await this.stream.getStatus(asset.externalId);
          readiness.set(asset.id, status.ready);
        }),
    );

    const checklist = (source: NonNullable<typeof course>): PublishIssue[] =>
      publishIssues({
        coverImageKey: source.coverImageKey,
        description: source.description,
        priceVnd: source.priceVnd,
        categoryId: source.categoryId,
        learningOutcomes: source.learningOutcomes,
        sections: source.sections.map((section) => ({
          id: section.id,
          lessons: section.lessons.map((lesson) => ({
            id: lesson.id,
            type: lesson.type,
            content: lesson.content,
            isPreview: lesson.isPreview,
            videoAssetId: lesson.videoAssetId,
            videoReady: lesson.videoAssetId
              ? (readiness.get(lesson.videoAssetId) ?? false)
              : false,
          })),
        })),
      });
    const notPublishable = (issues: PublishIssue[]) =>
      appError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        ERROR_CODE.COURSE_NOT_PUBLISHABLE,
        'Course is not ready to publish',
        { issues },
      );
    const issues = checklist(course);
    if (issues.length > 0) throw notPublishable(issues);

    return this.prisma.$transaction(async (tx) => {
      // Checked again under the course lock: an edit that landed after the read
      // above must not let an unpublishable course out. `readiness` is what was
      // fetched before, so a video attached since counts as not ready.
      await lockCourse(tx, id);
      const fresh = await tx.course.findUniqueOrThrow({
        where: { id },
        include: this.adminDetailInclude(),
      });
      const current = checklist(fresh);
      if (current.length > 0) throw notPublishable(current);

      // Only DRAFT or ARCHIVED → PUBLISHED; conditional like archiveCourse so
      // a repeat or concurrent publish records nothing.
      const { count } = await tx.course.updateMany({
        where: {
          id,
          status: { in: [CourseStatus.DRAFT, CourseStatus.ARCHIVED] },
        },
        data: {
          status: CourseStatus.PUBLISHED,
          publishedAt: course.publishedAt ?? new Date(),
          archivedAt: null,
        },
      });
      if (count === 0) {
        throw appError(
          HttpStatus.CONFLICT,
          ERROR_CODE.CONFLICT,
          'Course is already published',
        );
      }
      const updated = await tx.course.findUniqueOrThrow({
        where: { id },
        include: this.detailInclude,
      });
      await this.audit.record(
        {
          ...actor,
          action: 'course.published',
          entityType: 'COURSE',
          entityId: id,
          metadata: { slug: updated.slug },
        },
        tx,
      );
      return this.toCourseDetail(updated);
    });
  }

  async unpublishCourse(id: string, actor: AuditActorContext) {
    // Accepts both PUBLISHED and ARCHIVED; `publishedAt` is never cleared, so
    // the slug stays locked.
    return this.prisma.$transaction(async (tx) => {
      const course = await tx.course.findUnique({
        where: { id },
        select: { status: true },
      });
      if (!course) notFound();
      const fromStatus = course.status;
      // Conditional on the status just read, so `fromStatus` is exactly what
      // this call replaced and a racing transition gets a 409.
      const { count } = await tx.course.updateMany({
        where: {
          id,
          status: { equals: fromStatus, not: CourseStatus.DRAFT },
        },
        data: { status: CourseStatus.DRAFT, archivedAt: null },
      });
      if (count === 0) {
        throw appError(
          HttpStatus.CONFLICT,
          ERROR_CODE.CONFLICT,
          'Only a published or archived course can be unpublished',
        );
      }
      // A DRAFT gives enrollments no access (PLAN_SUPPLEMENT.md §4.10), so
      // unpublishing would lock every current learner out. Counted after the
      // update, whose row lock waits for any grant holding the course row.
      const learners = await tx.enrollment.count({
        where: { courseId: id, status: EnrollmentStatus.ACTIVE },
      });
      if (learners > 0) {
        throw appError(
          HttpStatus.CONFLICT,
          ERROR_CODE.COURSE_HAS_ENROLLMENTS,
          'Course still has students',
        );
      }
      const updated = await tx.course.findUniqueOrThrow({
        where: { id },
        include: this.detailInclude,
      });
      await this.audit.record(
        {
          ...actor,
          action: 'course.unpublished',
          entityType: 'COURSE',
          entityId: id,
          metadata: { slug: updated.slug, fromStatus },
        },
        tx,
      );
      return {
        ...this.toCourseDetail(updated),
        status: updated.status,
        archivedAt: updated.archivedAt,
      };
    });
  }

  async archiveCourse(id: string, actor: AuditActorContext) {
    await mustFindCourse(this.prisma, id);
    return this.prisma.$transaction(async (tx) => {
      // DATA_MODEL.md §Chuyển trạng thái: only PUBLISHED → ARCHIVED. A DRAFT
      // was never sold (delete it instead), and re-archiving would rewrite
      // `archivedAt`. Conditional so a concurrent transition cannot slip in.
      const { count } = await tx.course.updateMany({
        where: { id, status: CourseStatus.PUBLISHED },
        data: { status: CourseStatus.ARCHIVED, archivedAt: new Date() },
      });
      if (count === 0) {
        throw appError(
          HttpStatus.CONFLICT,
          ERROR_CODE.CONFLICT,
          'Only a published course can be archived',
        );
      }
      const updated = await tx.course.findUniqueOrThrow({
        where: { id },
        include: this.detailInclude,
      });
      await this.audit.record(
        {
          ...actor,
          action: 'course.archived',
          entityType: 'COURSE',
          entityId: id,
          metadata: { slug: updated.slug },
        },
        tx,
      );
      return {
        ...this.toCourseDetail(updated),
        status: updated.status,
        archivedAt: updated.archivedAt,
      };
    });
  }

  async deleteCourse(id: string, actor: AuditActorContext): Promise<void> {
    const course = await mustFindCourse(this.prisma, id);
    await this.prisma.$transaction(async (tx) => {
      // Only a draft is deleted for good (DATA_MODEL.md §Xóa): a published
      // course's slug is already in shared links and the sitemap, and one that
      // ever had students is retired by archiving. Locked, so a publish or a
      // grant racing this delete either waits for it or is seen by it.
      const [row] = await tx.$queryRaw<{ status: CourseStatus }[]>`
        SELECT status FROM courses WHERE id = ${id}::uuid FOR NO KEY UPDATE`;
      if (!row) notFound();
      if (row.status !== CourseStatus.DRAFT) {
        // Say why: any enrollment row, a revoked one included, is students.
        const enrolled = await tx.enrollment.count({ where: { courseId: id } });
        throw enrolled > 0
          ? appError(
              HttpStatus.CONFLICT,
              ERROR_CODE.COURSE_HAS_ENROLLMENTS,
              'Course still has students',
            )
          : appError(
              HttpStatus.CONFLICT,
              ERROR_CODE.CONFLICT,
              'Only a draft course can be deleted; archive it instead',
            );
      }
      try {
        await tx.course.delete({ where: { id } });
      } catch (error) {
        // `enrollments.course_id` is the only Restrict FK onto courses, and
        // any row blocks it, REVOKED included. Asking the FK instead of
        // counting first keeps a grant racing this delete a 409, not a 500.
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2003'
        ) {
          throw appError(
            HttpStatus.CONFLICT,
            ERROR_CODE.COURSE_HAS_ENROLLMENTS,
            'Course still has students',
          );
        }
        throw error;
      }
      await this.audit.record(
        {
          ...actor,
          action: 'course.deleted',
          entityType: 'COURSE',
          entityId: id,
          metadata: { slug: course.slug },
        },
        tx,
      );
    });
  }

  // ── Shared ───────────────────────────────────────────────────────

  private courseOrder(sort?: string): Prisma.CourseOrderByWithRelationInput[] {
    const [field, direction] = (sort ?? 'enrollmentCount:desc').split(':') as [
      string,
      'asc' | 'desc',
    ];
    const primary: Prisma.CourseOrderByWithRelationInput =
      field === 'ratingAverage' || field === 'publishedAt'
        ? { [field]: { sort: direction, nulls: 'last' } }
        : { [field]: direction };
    // A stable tiebreaker keeps pagination from repeating or skipping rows.
    return [primary, { id: 'asc' }];
  }

  /**
   * A lesson's outline, never its text: the page shows six fields of it and
   * this used to read every column, the whole article included (REVIEW F-31).
   */
  private readonly detailInclude = {
    category: true,
    instructor: { select: { displayName: true } },
    sections: {
      orderBy: { position: 'asc' },
      include: {
        lessons: {
          orderBy: { position: 'asc' },
          select: {
            id: true,
            title: true,
            position: true,
            type: true,
            durationSeconds: true,
            isPreview: true,
          },
        },
      },
    },
  } satisfies Prisma.CourseInclude;

  /** Admin outline additionally carries the attached VideoAsset rows. */
  private adminDetailInclude() {
    return {
      category: true,
      instructor: { select: { displayName: true } },
      sections: {
        orderBy: { position: 'asc' },
        include: {
          lessons: {
            orderBy: { position: 'asc' },
            include: { videoAsset: true },
          },
        },
      },
    } satisfies Prisma.CourseInclude;
  }

  private async courseSlugTaken(slug: string, exceptId?: string) {
    const row = await this.prisma.course.findUnique({
      where: { slug },
      select: { id: true },
    });
    return Boolean(row) && row!.id !== exceptId;
  }

  // ── Response shapes ──────────────────────────────────────────────

  toCourseCard(course: CourseCardRow): CourseCard {
    return {
      id: course.id,
      slug: course.slug,
      title: course.title,
      subtitle: course.subtitle,
      coverUrl: course.coverImageKey
        ? this.storage.publicUrl(course.coverImageKey)
        : null,
      priceVnd: course.priceVnd,
      compareAtPriceVnd: course.compareAtPriceVnd,
      level: course.level,
      language: course.language,
      lessonCount: course.lessonCount,
      totalDurationSeconds: course.totalDurationSeconds,
      enrollmentCount: course.enrollmentCount,
      ratingAverage:
        course.ratingAverage === null ? null : Number(course.ratingAverage),
      ratingCount: course.ratingCount,
      demoStats: course.demoStats,
      category: course.category ? toCategory({ ...course.category }) : null,
      instructorName: course.instructor?.displayName ?? null,
    };
  }

  private toCourseDetail(course: CourseCardRow & CourseDetailRow) {
    return {
      ...this.toCourseCard(course),
      description: course.description,
      learningOutcomes: course.learningOutcomes,
      requirements: course.requirements,
      targetAudience: course.targetAudience,
      publishedAt: course.publishedAt,
      updatedAt: course.updatedAt,
      sections: course.sections.map((section) => toSectionOutline(section)),
    };
  }
}

type CourseCardRow = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  coverImageKey: string | null;
  priceVnd: number;
  compareAtPriceVnd: number | null;
  level: CourseLevel;
  language: string;
  lessonCount: number;
  totalDurationSeconds: number;
  enrollmentCount: number;
  ratingAverage: unknown;
  ratingCount: number;
  demoStats: boolean;
  category: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    icon: string | null;
    position: number;
  } | null;
  instructor: { displayName: string } | null;
};

type CourseDetailRow = {
  description: string;
  learningOutcomes: string[];
  requirements: string[];
  targetAudience: string[];
  publishedAt: Date | null;
  updatedAt: Date;
  sections: {
    id: string;
    title: string;
    position: number;
    lessons: LessonRow[];
  }[];
};

export type CourseCard = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  coverUrl: string | null;
  priceVnd: number;
  compareAtPriceVnd: number | null;
  level: CourseLevel;
  language: string;
  lessonCount: number;
  totalDurationSeconds: number;
  enrollmentCount: number;
  ratingAverage: number | null;
  ratingCount: number;
  demoStats: boolean;
  category: CategoryDto | null;
  instructorName: string | null;
};
