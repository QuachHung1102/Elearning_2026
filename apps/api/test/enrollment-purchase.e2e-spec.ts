import type { NestExpressApplication } from '@nestjs/platform-express';
import { EnrollmentService } from '../src/enrollment/enrollment.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { bootApp, createCourse, createUser, truncateAll, warmPool } from './support.js';

/**
 * The payment path through `EnrollmentService.grant()` against the real
 * database (DATA_MODEL.md §Enrollment, "Bảng chuyển trạng thái"): the
 * columns each transition writes, and the lock order that keeps a paid grant
 * and an admin revoke from deadlocking.
 */
describe('purchase enrollments (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let enrollments: EnrollmentService;

  beforeAll(async () => {
    ({ app, prisma } = await bootApp());
    enrollments = app.get(EnrollmentService);
  });

  beforeEach(async () => {
    await truncateAll(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  async function shop() {
    const admin = await createUser(prisma, 'ADMIN');
    const course = await createCourse(prisma);
    const learner = async () => {
      const user = await createUser(prisma, 'STUDENT');
      return {
        userId: user.id,
        courseId: course.id,
        order: (status: 'PAID' | 'REFUNDED' = 'PAID') =>
          prisma.purchase.create({
            data: { userId: user.id, courseId: course.id, priceVnd: 499_000, status },
          }),
      };
    };
    const count = async () =>
      (await prisma.course.findUniqueOrThrow({ where: { id: course.id } }))
        .enrollmentCount;
    const active = () =>
      prisma.enrollment.count({ where: { courseId: course.id, status: 'ACTIVE' } });
    return { admin, course, learner, count, active };
  }

  it('links the order to the enrollment it creates, with nobody recorded as granter', async () => {
    const { learner, count } = await shop();
    const { userId, courseId, order } = await learner();
    const bought = await order();

    const granted = await enrollments.grant({
      userId,
      courseId,
      source: 'PURCHASE',
      actorId: null,
      purchaseId: bought.id,
    });

    expect(granted.changed).toBe(true);
    expect(granted.enrollment).toMatchObject({
      source: 'PURCHASE',
      purchaseId: bought.id,
      grantedById: null,
      status: 'ACTIVE',
    });
    expect(await count()).toBe(1);
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'enrollment.granted' },
    });
    expect(audit.actorId).toBeNull();
    expect(audit.metadata).toMatchObject({ source: 'PURCHASE', purchaseId: bought.id });
  });

  it('moves a manual grant onto the order without a second count, and a repeat changes nothing', async () => {
    const { admin, learner, count } = await shop();
    const { userId, courseId, order } = await learner();
    const manual = await enrollments.grant({
      userId,
      courseId,
      source: 'MANUAL_GRANT',
      actorId: admin.id,
    });
    const bought = await order();
    const pay = () =>
      enrollments.grant({
        userId,
        courseId,
        source: 'PURCHASE',
        actorId: null,
        purchaseId: bought.id,
      });

    const flipped = await pay();
    const repeat = await pay();

    expect(flipped.changed).toBe(true);
    expect(flipped.enrollment).toMatchObject({
      id: manual.enrollment.id,
      source: 'PURCHASE',
      purchaseId: bought.id,
      grantedById: admin.id,
    });
    expect(flipped.enrollment.grantedAt).toEqual(manual.enrollment.grantedAt);
    expect(repeat.changed).toBe(false);
    expect(await count()).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: 'enrollment.granted' } })).toBe(2);
  });

  it('reactivates a refunded learner for a new order, and refuses to link one order to two rows', async () => {
    const { learner, count } = await shop();
    const { userId, courseId, order } = await learner();
    const first = await order();
    const { enrollment } = await enrollments.grant({
      userId,
      courseId,
      source: 'PURCHASE',
      actorId: null,
      purchaseId: first.id,
    });
    await enrollments.revoke({
      enrollmentId: enrollment.id,
      actorId: null,
      reason: 'refund',
      trigger: 'refund',
    });
    await prisma.purchase.update({ where: { id: first.id }, data: { status: 'REFUNDED' } });
    expect(await count()).toBe(0);

    const second = await order();
    const again = await enrollments.grant({
      userId,
      courseId,
      source: 'PURCHASE',
      actorId: null,
      purchaseId: second.id,
    });

    expect(again.changed).toBe(true);
    expect(again.enrollment).toMatchObject({
      id: enrollment.id,
      status: 'ACTIVE',
      revokedAt: null,
      purchaseId: second.id,
    });
    expect(await count()).toBe(1);

    // One order unlocks at most one enrollment (`enrollments_purchase_id_key`).
    const other = await learner();
    await expect(
      enrollments.grant({
        userId: other.userId,
        courseId,
        source: 'PURCHASE',
        actorId: null,
        purchaseId: second.id,
      }),
    ).rejects.toThrow();
    expect(await count()).toBe(1);
  });

  // The flip writes the enrollment row while holding the course lock. A revoke
  // that took the row first would wait for that lock, and the flip for the row:
  // Postgres aborts one of them after `deadlock_timeout`. Ten pairs, each racing
  // a paid grant against an admin revoke of the same learner.
  it('never deadlocks a paid grant against a revoke, and the counter stays exact', async () => {
    const { admin, learner, count, active } = await shop();
    await warmPool(prisma);

    for (let round = 0; round < 10; round += 1) {
      const { userId, courseId, order } = await learner();
      const manual = await enrollments.grant({
        userId,
        courseId,
        source: 'MANUAL_GRANT',
        actorId: admin.id,
      });
      const bought = await order();

      const settled = await Promise.allSettled([
        enrollments.grant({
          userId,
          courseId,
          source: 'PURCHASE',
          actorId: null,
          purchaseId: bought.id,
        }),
        enrollments.revoke({
          enrollmentId: manual.enrollment.id,
          actorId: admin.id,
          reason: 'admin_revoke',
          trigger: 'admin',
        }),
      ]);

      expect(settled.map((result) => result.status)).toEqual(['fulfilled', 'fulfilled']);
      expect(await count()).toBe(await active());
    }
  });
});
