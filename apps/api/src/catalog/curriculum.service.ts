import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  AuditService,
  type AuditActorContext,
} from '../audit/audit.service.js';
import { ERROR_CODE, appError } from '../common/error-codes.js';
import { LessonType } from '../generated/prisma/enums.js';
import {
  isResourceKeyFor,
  OBJECT_STORAGE,
  type ObjectStorage,
} from '../media/object-storage.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  assertSameSet,
  LAST_POSITION,
  lockCourse,
  mustFindCourse,
  nextPosition,
  notFound,
  storageProvider,
  toLessonOutline,
  toResource,
  toSectionOutline,
  writeOrder,
  type Tx,
} from './catalog.shared.js';
import type {
  CreateLessonDto,
  CreateResourceDto,
  UpdateLessonDto,
} from './course.dto.js';

/** Sections, lessons and lesson resources of a course. */
@Injectable()
export class CurriculumService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  // ── Admin: curriculum ────────────────────────────────────────────

  async createSection(
    courseId: string,
    title: string,
    actor: AuditActorContext,
  ) {
    await mustFindCourse(this.prisma, courseId);
    return this.prisma.$transaction(async (tx) => {
      await lockCourse(tx, courseId);
      const position = await nextPosition(
        tx.section.findFirst({ where: { courseId }, ...LAST_POSITION }),
      );
      const section = await tx.section.create({
        data: { courseId, title, position },
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
      return toSectionOutline(section);
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
      return toSectionOutline(section);
    });
  }

  async deleteSection(id: string, actor: AuditActorContext): Promise<void> {
    const section = await this.mustFindSection(id);
    await this.prisma.$transaction(async (tx) => {
      // Counted under the course lock: a lesson created a moment ago is seen,
      // instead of being cascaded away with the section.
      await lockCourse(tx, section.courseId);
      const lessons = await tx.lesson.count({ where: { sectionId: id } });
      if (lessons > 0) {
        throw appError(
          HttpStatus.CONFLICT,
          ERROR_CODE.SECTION_NOT_EMPTY,
          'Section still has lessons',
        );
      }
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
    await mustFindCourse(this.prisma, courseId);
    await this.prisma.$transaction(async (tx) => {
      await lockCourse(tx, courseId);
      const current = await tx.section.findMany({
        where: { courseId },
        select: { id: true },
      });
      assertSameSet(
        current.map((row) => row.id),
        sectionIds,
      );
      await writeOrder(sectionIds, ({ id, position }) =>
        tx.section.update({ where: { id }, data: { position } }),
      );
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
    return this.prisma.$transaction(async (tx) => {
      await lockCourse(tx, section.courseId);
      const position = await nextPosition(
        tx.lesson.findFirst({ where: { sectionId }, ...LAST_POSITION }),
      );
      const lesson = await tx.lesson.create({
        data: {
          sectionId,
          title: input.title,
          type: input.type,
          position,
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
      return toLessonOutline(lesson);
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
      ...toLessonOutline(lesson),
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
      resources: lesson.resources.map((resource) => toResource(resource)),
    };
  }

  async updateLesson(
    id: string,
    input: UpdateLessonDto,
    actor: AuditActorContext,
    /** `null` for an admin; an instructor attaches only videos they registered. */
    ownerId: string | null,
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
      if (!asset || (ownerId !== null && asset.instructorId !== ownerId)) {
        notFound();
      }
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
      // Course before lesson row, as every curriculum writer does: a reorder
      // holds the course lock and then writes this row.
      await lockCourse(tx, lesson.section.courseId);
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
        ...toLessonOutline(updated),
        content: updated.content,
        videoAssetId: updated.videoAssetId,
      };
    });
  }

  async deleteLesson(id: string, actor: AuditActorContext): Promise<void> {
    const lesson = await this.mustFindLesson(id);
    await this.prisma.$transaction(async (tx) => {
      await lockCourse(tx, lesson.section.courseId);
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
    await this.prisma.$transaction(async (tx) => {
      await lockCourse(tx, section.courseId);
      const current = await tx.lesson.findMany({
        where: { sectionId },
        select: { id: true },
      });
      assertSameSet(
        current.map((row) => row.id),
        lessonIds,
      );
      await writeOrder(lessonIds, ({ id, position }) =>
        tx.lesson.update({ where: { id }, data: { position } }),
      );
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
    const lesson = await this.mustFindLesson(lessonId);
    if (!isResourceKeyFor(lessonId, input.objectKey)) {
      throw appError(
        HttpStatus.BAD_REQUEST,
        ERROR_CODE.VALIDATION_FAILED,
        'objectKey must belong to this lesson',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      await lockCourse(tx, lesson.section.courseId);
      const position = await nextPosition(
        tx.lessonResource.findFirst({ where: { lessonId }, ...LAST_POSITION }),
      );
      const resource = await tx.lessonResource.create({
        data: {
          lessonId,
          storage: storageProvider(),
          objectKey: input.objectKey,
          filename: input.filename,
          contentType: input.contentType,
          sizeBytes: input.sizeBytes,
          position,
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
      return toResource(resource);
    });
  }

  async listResources(lessonId: string) {
    await this.mustFindLesson(lessonId);
    const resources = await this.prisma.lessonResource.findMany({
      where: { lessonId },
      orderBy: { position: 'asc' },
    });
    return { items: resources.map((resource) => toResource(resource)) };
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
    await lockCourse(tx, courseId);
    const { _count, _sum } = await tx.lesson.aggregate({
      where: { section: { courseId } },
      _count: true,
      _sum: { durationSeconds: true },
    });
    await tx.course.update({
      where: { id: courseId },
      data: {
        lessonCount: _count,
        totalDurationSeconds: _sum.durationSeconds ?? 0,
      },
    });
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
}
