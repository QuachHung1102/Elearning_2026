import { HttpStatus, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { ERROR_CODE, appError } from '../common/error-codes.js';
import type { Enrollment, Prisma } from '../generated/prisma/client.js';
import {
  CourseStatus,
  EnrollmentSource,
  EnrollmentStatus,
  UserRole,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

type Tx = Prisma.TransactionClient;

export type Viewer = { id: string; role: UserRole };

/**
 * `ENROLLED` reads and writes everything. `ADMIN` and `PREVIEW` read the
 * lesson but get no resources, no progress and write nothing.
 */
export type AccessMode = 'ENROLLED' | 'ADMIN' | 'PREVIEW';

export type EnrollmentChange = {
  enrollment: Enrollment;
  /** `false` for an idempotent repeat: no write, no audit row, no count change. */
  changed: boolean;
};

export type GrantInput = {
  userId: string;
  courseId: string;
  source: EnrollmentSource;
  /** The granting admin; `null` only for the payment path. */
  actorId: string | null;
  ipAddress?: string | null;
  /** Goes into the audit metadata; there is no column for it. */
  note?: string;
  tx?: Tx;
};

export type RevokeInput = {
  enrollmentId: string;
  actorId: string | null;
  ipAddress?: string | null;
  reason: string;
  trigger: 'admin' | 'refund';
  tx?: Tx;
};

/**
 * The access rule, free of I/O so every branch is unit tested. Order matters:
 * visibility is decided before enrollment, so a lesson in a course the caller
 * may not see answers 404 even when it is a preview (API_CONTRACT.md §6.1).
 *
 * An ARCHIVED course stays visible to someone with an ACTIVE enrollment
 * (PLAN_SUPPLEMENT.md §4.10). DRAFT gets no such exemption: nobody can hold a
 * valid enrollment in a course that was never sold.
 */
export function resolveAccess(input: {
  courseStatus: CourseStatus;
  enrolled: boolean;
  isAdmin: boolean;
  isPreview: boolean;
}): AccessMode | 'NOT_FOUND' | 'NOT_ENROLLED' {
  const visible =
    input.courseStatus === CourseStatus.PUBLISHED ||
    input.isAdmin ||
    (input.courseStatus === CourseStatus.ARCHIVED && input.enrolled);
  if (!visible) return 'NOT_FOUND';
  if (input.enrolled) return 'ENROLLED';
  if (input.isAdmin) return 'ADMIN';
  if (input.isPreview) return 'PREVIEW';
  return 'NOT_ENROLLED';
}

function notFound(): never {
  throw appError(HttpStatus.NOT_FOUND, ERROR_CODE.NOT_FOUND, 'Not Found');
}

/**
 * The only writer of `enrollments` and of `Course.enrollmentCount`. Every
 * state change, its counter delta and its audit row share one transaction, so
 * `enrollmentCount = count(ACTIVE enrollments)` holds at every commit.
 */
@Injectable()
export class EnrollmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** ACTIVE enrollment, whatever the course status — ARCHIVED included. */
  async hasAccess(userId: string, courseId: string): Promise<boolean> {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: { status: true },
    });
    return enrollment?.status === EnrollmentStatus.ACTIVE;
  }

  /** Course-level reads (`/learn/{slug}`): there is no preview mode here. */
  async courseAccess(viewer: Viewer, slug: string) {
    const course = await this.prisma.course.findUnique({ where: { slug } });
    if (!course) notFound();
    const mode = await this.decide(viewer, course, false);
    return { course, mode: mode as Exclude<AccessMode, 'PREVIEW'> };
  }

  /** Lesson-level reads and writes; callers narrow the modes they accept. */
  async lessonAccess(viewer: Viewer, lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { videoAsset: true, section: { include: { course: true } } },
    });
    if (!lesson) notFound();
    const mode = await this.decide(
      viewer,
      lesson.section.course,
      lesson.isPreview,
    );
    return { lesson, mode };
  }

  /**
   * One upsert on `(userId, courseId)` split into its two race-safe halves:
   * `createMany … skipDuplicates` (INSERT … ON CONFLICT DO NOTHING) for a new
   * row and a conditional `updateMany` for REVOKED → ACTIVE. Both report
   * whether *this* call changed the row, so two concurrent grants can never
   * both increment the counter.
   */
  async grant(input: GrantInput): Promise<EnrollmentChange> {
    // DATA_MODEL.md §Enrollment: PURCHASE ⇒ purchaseId, MANUAL_GRANT ⇒
    // grantedById. `purchaseId` arrives with add_payment, so until then no
    // PURCHASE grant can satisfy its invariant.
    if (input.source === EnrollmentSource.PURCHASE) {
      throw new Error('A PURCHASE enrollment requires a purchaseId');
    }
    if (!input.actorId) {
      throw new Error('A MANUAL_GRANT enrollment requires the granting admin');
    }
    const { userId, courseId, source, actorId } = input;

    return this.inTransaction(input.tx, async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      // Locked, so an unpublish or delete racing this grant either waits for
      // it (and then sees the enrollment) or commits first (and this reads
      // DRAFT or no row). An unlocked read lets the grant land on a draft.
      const [course] = await tx.$queryRaw<{ status: CourseStatus }[]>`
        SELECT status FROM courses WHERE id = ${courseId}::uuid FOR NO KEY UPDATE`;
      if (!user || !course || course.status === CourseStatus.DRAFT) {
        notFound();
      }

      const where = { userId_courseId: { userId, courseId } };
      const existing = await tx.enrollment.findUnique({ where });
      if (existing?.status === EnrollmentStatus.ACTIVE) {
        return { enrollment: existing, changed: false };
      }

      const { count } = existing
        ? // Reactivates the same row. `grantedAt` is never rewritten: it is
          // the first day of access; later grants are in the audit log.
          await tx.enrollment.updateMany({
            where: { id: existing.id, status: EnrollmentStatus.REVOKED },
            data: {
              status: EnrollmentStatus.ACTIVE,
              revokedAt: null,
              source,
              grantedById: actorId,
            },
          })
        : await tx.enrollment.createMany({
            data: [
              {
                userId,
                courseId,
                source,
                grantedById: actorId,
                status: EnrollmentStatus.ACTIVE,
              },
            ],
            skipDuplicates: true,
          });
      const enrollment = await tx.enrollment.findUniqueOrThrow({ where });
      if (count === 0) return { enrollment, changed: false };

      await tx.course.update({
        where: { id: courseId },
        data: { enrollmentCount: { increment: 1 } },
      });
      await this.audit.record(
        {
          actorId,
          ipAddress: input.ipAddress ?? null,
          action: 'enrollment.granted',
          entityType: 'ENROLLMENT',
          entityId: enrollment.id,
          metadata: { courseId, userId, source, note: input.note ?? null },
        },
        tx,
      );
      return { enrollment, changed: true };
    });
  }

  /** ACTIVE → REVOKED. The row is never deleted; revoking twice is a no-op. */
  async revoke(input: RevokeInput): Promise<EnrollmentChange> {
    return this.inTransaction(input.tx, async (tx) => {
      const { count } = await tx.enrollment.updateMany({
        where: { id: input.enrollmentId, status: EnrollmentStatus.ACTIVE },
        data: { status: EnrollmentStatus.REVOKED, revokedAt: new Date() },
      });
      const enrollment = await tx.enrollment.findUnique({
        where: { id: input.enrollmentId },
      });
      if (!enrollment) notFound();
      if (count === 0) return { enrollment, changed: false };

      await tx.course.update({
        where: { id: enrollment.courseId },
        data: { enrollmentCount: { decrement: 1 } },
      });
      await this.audit.record(
        {
          actorId: input.actorId,
          ipAddress: input.ipAddress ?? null,
          action: 'enrollment.revoked',
          entityType: 'ENROLLMENT',
          entityId: enrollment.id,
          metadata: {
            courseId: enrollment.courseId,
            userId: enrollment.userId,
            reason: input.reason,
            trigger: input.trigger,
          },
        },
        tx,
      );
      return { enrollment, changed: true };
    });
  }

  private async decide(
    viewer: Viewer,
    course: { id: string; status: CourseStatus },
    isPreview: boolean,
  ): Promise<AccessMode> {
    const decision = resolveAccess({
      courseStatus: course.status,
      enrolled: await this.hasAccess(viewer.id, course.id),
      isAdmin: viewer.role === UserRole.ADMIN,
      isPreview,
    });
    if (decision === 'NOT_FOUND') notFound();
    if (decision === 'NOT_ENROLLED') {
      throw appError(
        HttpStatus.FORBIDDEN,
        ERROR_CODE.NOT_ENROLLED,
        'Not enrolled in this course',
      );
    }
    return decision;
  }

  private inTransaction<T>(
    tx: Tx | undefined,
    work: (tx: Tx) => Promise<T>,
  ): Promise<T> {
    return tx ? work(tx) : this.prisma.$transaction(work);
  }
}
