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
import { config } from '../config.js';
import { Prisma, UserRole } from '../generated/prisma/client.js';
import {
  CourseLevel,
  CourseStatus,
  EnrollmentStatus,
  LessonType,
  StorageProvider,
} from '../generated/prisma/enums.js';
import {
  coverKeyPrefix,
  OBJECT_STORAGE,
  resourceKeyPrefix,
  type ObjectStorage,
} from '../media/object-storage.js';
import { STREAM_CLIENT, type StreamClient } from '../media/stream.client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  publishIssues,
  type PublishIssue,
} from './publish-validation.js';
import { isSameSet, reorderSteps } from './reorder.js';
import { buildSearchText, normalize } from './search-text.js';
import { uniqueSlug } from './slug.js';
import type {
  AdminCourseListQuery,
  CourseListQuery,
  CreateCategoryDto,
  CreateCourseDto,
  CreateLessonDto,
  CreateResourceDto,
  UpdateCategoryDto,
  UpdateCourseDto,
  UpdateLessonDto,
} from './course.dto.js';

type Tx = Prisma.TransactionClient;

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
} satisfies Prisma.CourseSelect;

function notFound(): never {
  throw appError(HttpStatus.NOT_FOUND, ERROR_CODE.NOT_FOUND, 'Not Found');
}

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(STREAM_CLIENT) private readonly stream: StreamClient,
  ) {}

  // ── Public catalog ───────────────────────────────────────────────

  async listCategories() {
    const categories = await this.prisma.category.findMany({
      orderBy: { position: 'asc' },
      include: {
        _count: { select: { courses: { where: { status: 'PUBLISHED' } } } },
      },
    });
    return { items: categories.map((category) => this.toCategory(category)) };
  }

  async getCategoryBySlug(slug: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      include: {
        _count: { select: { courses: { where: { status: 'PUBLISHED' } } } },
      },
    });
    if (!category) notFound();
    return this.toCategory(category);
  }

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

  // ── Admin: categories ────────────────────────────────────────────

  async listCategoriesForAdmin() {
    const categories = await this.prisma.category.findMany({
      orderBy: { position: 'asc' },
      include: { _count: { select: { courses: true } } },
    });
    return { items: categories.map((category) => this.toCategory(category)) };
  }

  async createCategory(input: CreateCategoryDto, actor: AuditActorContext) {
    const slug = await this.resolveSlug(input.slug, input.name, 80, (value) =>
      this.categorySlugTaken(value),
    );
    const last = await this.prisma.category.findFirst({
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    return this.prisma.$transaction(async (tx) => {
      const category = await tx.category.create({
        data: {
          slug,
          name: input.name,
          description: input.description ?? null,
          icon: input.icon ?? null,
          position: (last?.position ?? 0) + 1,
        },
        include: { _count: { select: { courses: true } } },
      });
      await this.audit.record(
        {
          ...actor,
          action: 'category.created',
          entityType: 'CATEGORY',
          entityId: category.id,
          metadata: { slug: category.slug },
        },
        tx,
      );
      return this.toCategory(category);
    });
  }

  async updateCategory(
    id: string,
    input: UpdateCategoryDto,
    actor: AuditActorContext,
  ) {
    await this.mustFindCategory(id);
    if (input.slug && (await this.categorySlugTaken(input.slug, id))) {
      throw appError(
        HttpStatus.CONFLICT,
        ERROR_CODE.SLUG_TAKEN,
        'Slug is already taken',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const category = await tx.category.update({
        where: { id },
        data: {
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.slug === undefined ? {} : { slug: input.slug }),
          ...(input.description === undefined
            ? {}
            : { description: input.description || null }),
          ...(input.icon === undefined ? {} : { icon: input.icon || null }),
        },
        include: { _count: { select: { courses: true } } },
      });
      await this.audit.record(
        {
          ...actor,
          action: 'category.updated',
          entityType: 'CATEGORY',
          entityId: id,
          metadata: { slug: category.slug },
        },
        tx,
      );
      return this.toCategory(category);
    });
  }

  async deleteCategory(id: string, actor: AuditActorContext): Promise<void> {
    const category = await this.mustFindCategory(id);
    const courses = await this.prisma.course.count({
      where: { categoryId: id },
    });
    if (courses > 0) {
      throw appError(
        HttpStatus.CONFLICT,
        ERROR_CODE.CATEGORY_NOT_EMPTY,
        'Category still has courses',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.category.delete({ where: { id } });
      await this.audit.record(
        {
          ...actor,
          action: 'category.deleted',
          entityType: 'CATEGORY',
          entityId: id,
          metadata: { slug: category.slug },
        },
        tx,
      );
    });
  }

  async reorderCategories(
    categoryIds: string[],
    actor: AuditActorContext,
  ): Promise<void> {
    const current = await this.prisma.category.findMany({
      orderBy: { position: 'asc' },
      select: { id: true },
    });
    this.assertSameSet(
      current.map((row) => row.id),
      categoryIds,
    );
    // Category.position is not unique, but normalising through the same
    // two-phase routine keeps one reorder implementation in the codebase.
    await this.prisma.$transaction(async (tx) => {
      for (const phase of reorderSteps(categoryIds)) {
        for (const update of phase) {
          await tx.category.update({
            where: { id: update.id },
            data: { position: update.position },
          });
        }
      }
      await this.audit.record(
        {
          ...actor,
          action: 'category.reordered',
          entityType: 'CATEGORY',
          metadata: { categoryIds },
        },
        tx,
      );
    });
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
        orderBy: { [field]: direction },
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
    const slug = await this.resolveSlug(input.slug, input.title, 120, (value) =>
      this.courseSlugTaken(value),
    );
    if (input.categoryId) await this.mustFindCategory(input.categoryId);
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
  }

  async updateCourse(
    id: string,
    input: UpdateCourseDto,
    actor: AuditActorContext,
  ) {
    const course = await this.mustFindCourse(id);

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
    if (input.categoryId) await this.mustFindCategory(input.categoryId);
    if (input.coverImageKey && !input.coverImageKey.startsWith(coverKeyPrefix(id))) {
      throw appError(
        HttpStatus.BAD_REQUEST,
        ERROR_CODE.VALIDATION_FAILED,
        'coverImageKey must belong to this course',
      );
    }
    if (input.instructorId) {
      const teacher = await this.prisma.user.findUnique({
        where: { id: input.instructorId },
        select: { role: true },
      });
      if (teacher?.role !== UserRole.INSTRUCTOR) {
        throw appError(
          HttpStatus.BAD_REQUEST,
          ERROR_CODE.VALIDATION_FAILED,
          'instructorId must reference an instructor',
        );
      }
    }

    const title = input.title ?? course.title;
    const subtitle =
      input.subtitle === undefined ? course.subtitle : input.subtitle || null;
    const priceVnd = input.priceVnd ?? course.priceVnd;
    const compareAtPriceVnd =
      input.compareAtPriceVnd === undefined
        ? course.compareAtPriceVnd
        : (input.compareAtPriceVnd ?? null);
    if (compareAtPriceVnd !== null && compareAtPriceVnd <= priceVnd) {
      throw appError(
        HttpStatus.BAD_REQUEST,
        ERROR_CODE.VALIDATION_FAILED,
        'compareAtPriceVnd must be greater than priceVnd',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.course.update({
        where: { id },
        data: {
          title,
          subtitle,
          priceVnd,
          compareAtPriceVnd,
          searchText: buildSearchText(title, subtitle),
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
                  ? this.storageProvider()
                  : null,
              }),
        },
        include: this.detailInclude,
      });
      await this.audit.record(
        {
          ...actor,
          action: 'course.updated',
          entityType: 'COURSE',
          entityId: id,
          metadata: { slug: updated.slug },
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

    const issues: PublishIssue[] = publishIssues({
      coverImageKey: course.coverImageKey,
      description: course.description,
      priceVnd: course.priceVnd,
      categoryId: course.categoryId,
      learningOutcomes: course.learningOutcomes,
      sections: course.sections.map((section) => ({
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
    if (issues.length > 0) {
      throw appError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        ERROR_CODE.COURSE_NOT_PUBLISHABLE,
        'Course is not ready to publish',
        { issues },
      );
    }

    return this.prisma.$transaction(async (tx) => {
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
    await this.mustFindCourse(id);
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
    const course = await this.mustFindCourse(id);
    await this.prisma.$transaction(async (tx) => {
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

  // ── Admin: curriculum ────────────────────────────────────────────

  async createSection(
    courseId: string,
    title: string,
    actor: AuditActorContext,
  ) {
    await this.mustFindCourse(courseId);
    const last = await this.prisma.section.findFirst({
      where: { courseId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    return this.prisma.$transaction(async (tx) => {
      const section = await tx.section.create({
        data: { courseId, title, position: (last?.position ?? 0) + 1 },
        include: { lessons: { orderBy: { position: 'asc' } } },
      });
      await this.audit.record(
        {
          ...actor,
          action: 'section.created',
          entityType: 'SECTION',
          entityId: section.id,
          metadata: { courseId, title },
        },
        tx,
      );
      return this.toSectionOutline(section);
    });
  }

  async updateSection(id: string, title: string, actor: AuditActorContext) {
    const current = await this.mustFindSection(id);
    return this.prisma.$transaction(async (tx) => {
      const section = await tx.section.update({
        where: { id },
        data: { title },
        include: { lessons: { orderBy: { position: 'asc' } } },
      });
      await this.audit.record(
        {
          ...actor,
          action: 'section.updated',
          entityType: 'SECTION',
          entityId: id,
          metadata: { courseId: current.courseId, title },
        },
        tx,
      );
      return this.toSectionOutline(section);
    });
  }

  async deleteSection(id: string, actor: AuditActorContext): Promise<void> {
    const section = await this.mustFindSection(id);
    const lessons = await this.prisma.lesson.count({ where: { sectionId: id } });
    if (lessons > 0) {
      throw appError(
        HttpStatus.CONFLICT,
        ERROR_CODE.SECTION_NOT_EMPTY,
        'Section still has lessons',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.section.delete({ where: { id } });
      await this.recompute(tx, section.courseId);
      await this.audit.record(
        {
          ...actor,
          action: 'section.deleted',
          entityType: 'SECTION',
          entityId: id,
          metadata: { courseId: section.courseId, title: section.title },
        },
        tx,
      );
    });
  }

  async reorderSections(
    courseId: string,
    sectionIds: string[],
    actor: AuditActorContext,
  ): Promise<void> {
    await this.mustFindCourse(courseId);
    const current = await this.prisma.section.findMany({
      where: { courseId },
      select: { id: true },
    });
    this.assertSameSet(
      current.map((row) => row.id),
      sectionIds,
    );
    await this.prisma.$transaction(async (tx) => {
      for (const phase of reorderSteps(sectionIds)) {
        for (const update of phase) {
          await tx.section.update({
            where: { id: update.id },
            data: { position: update.position },
          });
        }
      }
      await this.recompute(tx, courseId);
      await this.audit.record(
        {
          ...actor,
          action: 'section.reordered',
          entityType: 'COURSE',
          entityId: courseId,
          metadata: { sectionIds },
        },
        tx,
      );
    });
  }

  async createLesson(
    sectionId: string,
    input: CreateLessonDto,
    actor: AuditActorContext,
  ) {
    const section = await this.mustFindSection(sectionId);
    const last = await this.prisma.lesson.findFirst({
      where: { sectionId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    return this.prisma.$transaction(async (tx) => {
      const lesson = await tx.lesson.create({
        data: {
          sectionId,
          title: input.title,
          type: input.type,
          position: (last?.position ?? 0) + 1,
        },
      });
      await this.recompute(tx, section.courseId);
      await this.audit.record(
        {
          ...actor,
          action: 'lesson.created',
          entityType: 'LESSON',
          entityId: lesson.id,
          metadata: { courseId: section.courseId, title: lesson.title },
        },
        tx,
      );
      return this.toLessonOutline(lesson);
    });
  }

  /**
   * The editor at /admin/courses/[id]/lessons/[lessonId] needs the current
   * content to put in the textarea, and  is
   * deliberately outline-only. API_CONTRACT.md §5.2 routes admin *preview*
   * through /learn/*, which is a different job from loading a form.
   */
  async getLessonForAdmin(id: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id },
      include: {
        videoAsset: true,
        resources: { orderBy: { position: 'asc' } },
        section: { select: { courseId: true, title: true } },
      },
    });
    if (!lesson) notFound();
    return {
      ...this.toLessonOutline(lesson),
      courseId: lesson.section.courseId,
      sectionTitle: lesson.section.title,
      content: lesson.content,
      videoAssetId: lesson.videoAssetId,
      videoAsset: lesson.videoAsset
        ? {
            id: lesson.videoAsset.id,
            provider: lesson.videoAsset.provider,
            externalId: lesson.videoAsset.externalId,
            status: lesson.videoAsset.status,
            durationSeconds: lesson.videoAsset.durationSeconds,
          }
        : null,
      resources: lesson.resources.map((resource) => this.toResource(resource)),
    };
  }

  async updateLesson(
    id: string,
    input: UpdateLessonDto,
    actor: AuditActorContext,
  ) {
    const lesson = await this.mustFindLesson(id);
    const type = input.type ?? lesson.type;

    let videoAssetId =
      input.videoAssetId === undefined
        ? lesson.videoAssetId
        : (input.videoAssetId ?? null);
    if (type === LessonType.ARTICLE) videoAssetId = null;

    if (videoAssetId && videoAssetId !== lesson.videoAssetId) {
      const asset = await this.prisma.videoAsset.findUnique({
        where: { id: videoAssetId },
        include: { lesson: { select: { id: true } } },
      });
      if (!asset) notFound();
      if (asset.lesson && asset.lesson.id !== id) {
        throw appError(
          HttpStatus.CONFLICT,
          ERROR_CODE.VIDEO_ALREADY_ATTACHED,
          'Video is already attached to another lesson',
        );
      }
    }

    const durationSeconds =
      type === LessonType.ARTICLE
        ? 0
        : videoAssetId
          ? ((
              await this.prisma.videoAsset.findUnique({
                where: { id: videoAssetId },
                select: { durationSeconds: true },
              })
            )?.durationSeconds ?? 0)
          : 0;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.lesson.update({
        where: { id },
        data: {
          ...(input.title === undefined ? {} : { title: input.title }),
          ...(input.isPreview === undefined
            ? {}
            : { isPreview: input.isPreview }),
          ...(input.content === undefined ? {} : { content: input.content }),
          type,
          videoAssetId,
          durationSeconds,
        },
      });
      await this.recompute(tx, lesson.section.courseId);

      const changedFields = [
        input.title !== undefined && input.title !== lesson.title && 'title',
        type !== lesson.type && 'type',
        input.content !== undefined &&
          input.content !== lesson.content &&
          'content',
        input.isPreview !== undefined &&
          input.isPreview !== lesson.isPreview &&
          'isPreview',
        videoAssetId !== lesson.videoAssetId && 'videoAssetId',
      ].filter(Boolean);
      const metadata = {
        courseId: lesson.section.courseId,
        title: updated.title,
        changedFields,
      };
      // One row per request: a video change is the more specific event, so it
      // replaces `lesson.updated` rather than being written alongside it.
      if (videoAssetId !== lesson.videoAssetId) {
        await this.audit.record(
          {
            ...actor,
            action: videoAssetId ? 'video.attached' : 'video.detached',
            entityType: 'LESSON',
            entityId: id,
            metadata: {
              ...metadata,
              videoAssetId: videoAssetId ?? lesson.videoAssetId,
            },
          },
          tx,
        );
      } else {
        await this.audit.record(
          {
            ...actor,
            action: 'lesson.updated',
            entityType: 'LESSON',
            entityId: id,
            metadata,
          },
          tx,
        );
      }

      return {
        ...this.toLessonOutline(updated),
        content: updated.content,
        videoAssetId: updated.videoAssetId,
      };
    });
  }

  async deleteLesson(id: string, actor: AuditActorContext): Promise<void> {
    const lesson = await this.mustFindLesson(id);
    await this.prisma.$transaction(async (tx) => {
      // Counted inside the transaction: the rows cascade with the lesson, and
      // the audit row is the only trace of how much progress went with it.
      const deletedProgressRows = await tx.lessonProgress.count({
        where: { lessonId: id },
      });
      await tx.lesson.delete({ where: { id } });
      await this.recompute(tx, lesson.section.courseId);
      await this.audit.record(
        {
          ...actor,
          action: 'lesson.deleted',
          entityType: 'LESSON',
          entityId: id,
          metadata: {
            courseId: lesson.section.courseId,
            title: lesson.title,
            deletedProgressRows,
          },
        },
        tx,
      );
    });
  }

  async reorderLessons(
    sectionId: string,
    lessonIds: string[],
    actor: AuditActorContext,
  ): Promise<void> {
    const section = await this.mustFindSection(sectionId);
    const current = await this.prisma.lesson.findMany({
      where: { sectionId },
      select: { id: true },
    });
    this.assertSameSet(
      current.map((row) => row.id),
      lessonIds,
    );
    await this.prisma.$transaction(async (tx) => {
      for (const phase of reorderSteps(lessonIds)) {
        for (const update of phase) {
          await tx.lesson.update({
            where: { id: update.id },
            data: { position: update.position },
          });
        }
      }
      await this.recompute(tx, section.courseId);
      await this.audit.record(
        {
          ...actor,
          action: 'lesson.reordered',
          entityType: 'SECTION',
          entityId: sectionId,
          metadata: { lessonIds },
        },
        tx,
      );
    });
  }

  // ── Admin: lesson resources ──────────────────────────────────────

  async addResource(
    lessonId: string,
    input: CreateResourceDto,
    actor: AuditActorContext,
  ) {
    await this.mustFindLesson(lessonId);
    if (!input.objectKey.startsWith(resourceKeyPrefix(lessonId))) {
      throw appError(
        HttpStatus.BAD_REQUEST,
        ERROR_CODE.VALIDATION_FAILED,
        'objectKey must belong to this lesson',
      );
    }
    const last = await this.prisma.lessonResource.findFirst({
      where: { lessonId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    return this.prisma.$transaction(async (tx) => {
      const resource = await tx.lessonResource.create({
        data: {
          lessonId,
          storage: this.storageProvider(),
          objectKey: input.objectKey,
          filename: input.filename,
          contentType: input.contentType,
          sizeBytes: input.sizeBytes,
          position: (last?.position ?? 0) + 1,
        },
      });
      await this.audit.record(
        {
          ...actor,
          action: 'resource.created',
          entityType: 'RESOURCE',
          entityId: resource.id,
          metadata: { lessonId, filename: resource.filename },
        },
        tx,
      );
      return this.toResource(resource);
    });
  }

  async listResources(lessonId: string) {
    await this.mustFindLesson(lessonId);
    const resources = await this.prisma.lessonResource.findMany({
      where: { lessonId },
      orderBy: { position: 'asc' },
    });
    return { items: resources.map((resource) => this.toResource(resource)) };
  }

  async deleteResource(id: string, actor: AuditActorContext): Promise<void> {
    const resource = await this.prisma.lessonResource.findUnique({
      where: { id },
    });
    if (!resource) notFound();
    await this.prisma.$transaction(async (tx) => {
      await tx.lessonResource.delete({ where: { id } });
      await this.audit.record(
        {
          ...actor,
          action: 'resource.deleted',
          entityType: 'RESOURCE',
          entityId: id,
          metadata: {
            lessonId: resource.lessonId,
            filename: resource.filename,
          },
        },
        tx,
      );
    });
    await this.storage.delete(resource.objectKey);
  }

  // ── Shared ───────────────────────────────────────────────────────

  /**
   * The single writer of the two denormalised curriculum counters. Called in
   * the same transaction as every mutation that touches a lesson — publish is
   * just one more caller, not the only one.
   */
  private async recompute(tx: Tx, courseId: string): Promise<void> {
    const lessons = await tx.lesson.findMany({
      where: { section: { courseId } },
      select: { durationSeconds: true },
    });
    await tx.course.update({
      where: { id: courseId },
      data: {
        lessonCount: lessons.length,
        totalDurationSeconds: lessons.reduce(
          (total, lesson) => total + lesson.durationSeconds,
          0,
        ),
      },
    });
  }

  storageProvider(): StorageProvider {
    return config.storageDriver === 'r2'
      ? StorageProvider.CLOUDFLARE_R2
      : StorageProvider.DEMO;
  }

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

  private readonly detailInclude = {
    category: true,
    sections: {
      orderBy: { position: 'asc' },
      include: { lessons: { orderBy: { position: 'asc' } } },
    },
  } satisfies Prisma.CourseInclude;

  /** Admin outline additionally carries the attached VideoAsset rows. */
  private adminDetailInclude() {
    return {
      category: true,
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

  private async resolveSlug(
    explicit: string | undefined,
    source: string,
    maxLength: number,
    isTaken: (slug: string) => Promise<boolean>,
  ): Promise<string> {
    if (!explicit) return uniqueSlug(source, isTaken, maxLength);
    if (await isTaken(explicit)) {
      throw appError(
        HttpStatus.CONFLICT,
        ERROR_CODE.SLUG_TAKEN,
        'Slug is already taken',
      );
    }
    return explicit;
  }

  private async categorySlugTaken(slug: string, exceptId?: string) {
    const row = await this.prisma.category.findUnique({
      where: { slug },
      select: { id: true },
    });
    return Boolean(row) && row!.id !== exceptId;
  }

  private async courseSlugTaken(slug: string, exceptId?: string) {
    const row = await this.prisma.course.findUnique({
      where: { slug },
      select: { id: true },
    });
    return Boolean(row) && row!.id !== exceptId;
  }

  private assertSameSet(current: string[], ordered: string[]): void {
    if (!isSameSet(current, ordered)) {
      throw appError(
        HttpStatus.BAD_REQUEST,
        ERROR_CODE.ORDER_MISMATCH,
        'The submitted order does not match the current items',
      );
    }
  }

  private async mustFindCategory(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) notFound();
    return category;
  }

  private async mustFindCourse(id: string) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) notFound();
    return course;
  }

  private async mustFindSection(id: string) {
    const section = await this.prisma.section.findUnique({ where: { id } });
    if (!section) notFound();
    return section;
  }

  private async mustFindLesson(id: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id },
      include: { section: { select: { courseId: true } } },
    });
    if (!lesson) notFound();
    return lesson;
  }

  // ── Response shapes ──────────────────────────────────────────────

  private toCategory(category: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    icon: string | null;
    position: number;
    _count?: { courses: number };
  }) {
    return {
      id: category.id,
      slug: category.slug,
      name: category.name,
      description: category.description,
      icon: category.icon,
      position: category.position,
      courseCount: category._count?.courses ?? 0,
    };
  }

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
      category: course.category
        ? this.toCategory({ ...course.category })
        : null,
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
      sections: course.sections.map((section) =>
        this.toSectionOutline(section),
      ),
    };
  }

  private toSectionOutline(section: {
    id: string;
    title: string;
    position: number;
    lessons: LessonRow[];
  }) {
    return {
      id: section.id,
      title: section.title,
      position: section.position,
      lessons: section.lessons.map((lesson) => this.toLessonOutline(lesson)),
    };
  }

  /** Never carries `content` or `videoAssetId` — that is the guest boundary. */
  private toLessonOutline(lesson: LessonRow) {
    return {
      id: lesson.id,
      title: lesson.title,
      position: lesson.position,
      type: lesson.type,
      durationSeconds: lesson.durationSeconds,
      isPreview: lesson.isPreview,
    };
  }

  private toResource(resource: {
    id: string;
    filename: string;
    contentType: string;
    sizeBytes: number;
    position: number;
  }) {
    return {
      id: resource.id,
      filename: resource.filename,
      contentType: resource.contentType,
      sizeBytes: resource.sizeBytes,
      position: resource.position,
    };
  }
}

type LessonRow = {
  id: string;
  title: string;
  position: number;
  type: LessonType;
  durationSeconds: number;
  isPreview: boolean;
};

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
};

export type CategoryDto = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  position: number;
  courseCount: number;
};
