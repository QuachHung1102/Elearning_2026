import { HttpException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { EnrollmentService, resolveAccess } from './enrollment.service.js';

const ADMIN = { id: 'admin-1', role: 'ADMIN' as const };
const STUDENT = { id: 'student-1', role: 'STUDENT' as const };

type Row = Record<string, any>;

/**
 * In-memory stand-in for the handful of Prisma calls the service makes. Every
 * write is tagged with the client it went through, so a test can prove the
 * status change, the counter and the audit row share one transaction.
 */
function fakeDatabase() {
  const users: Row[] = [{ id: ADMIN.id }, { id: STUDENT.id }];
  const courses: Row[] = [
    {
      id: 'published',
      slug: 'published',
      status: 'PUBLISHED',
      enrollmentCount: 0,
      instructorId: null,
    },
    {
      id: 'archived',
      slug: 'archived',
      status: 'ARCHIVED',
      enrollmentCount: 0,
      instructorId: null,
    },
    { id: 'draft', slug: 'draft', status: 'DRAFT', enrollmentCount: 0, instructorId: null },
    { id: 'instructor-draft', slug: 'instructor-draft', status: 'DRAFT', enrollmentCount: 0, instructorId: 'instructor-1' },
  ];
  const lessons: Row[] = [
    { id: 'paid-lesson', courseId: 'published', isPreview: false },
    { id: 'preview-lesson', courseId: 'published', isPreview: true },
    { id: 'draft-preview', courseId: 'draft', isPreview: true },
  ];
  const enrollments: Row[] = [];
  const auditLogs: Row[] = [];
  const writes: { via: string; op: string }[] = [];
  // Everything in call order, locks included: the lock-before-write rule is
  // about order, and a lock is not a write.
  const order: { via: string; op: string }[] = [];
  let transactions = 0;
  let nextId = 1;

  const findEnrollment = (where: Row) =>
    where.id
      ? enrollments.find((row) => row.id === where.id)
      : enrollments.find(
          (row) =>
            row.userId === where.userId_courseId.userId &&
            row.courseId === where.userId_courseId.courseId,
        );

  function client(via: string) {
    const write = (op: string) => {
      writes.push({ via, op });
      order.push({ via, op });
    };
    return {
      // The locked course read: grant() wants the status, revoke() the mutex.
      $queryRaw: async (_sql: TemplateStringsArray, id: string) => {
        order.push({ via, op: 'course.lock' });
        return courses
          .filter((row) => row.id === id)
          .map(({ status }) => ({ status }));
      },
      user: {
        findUnique: async ({ where }: Row) =>
          users.find((row) => row.id === where.id) ?? null,
      },
      course: {
        findUnique: async ({ where }: Row) =>
          courses.find((row) =>
            where.id ? row.id === where.id : row.slug === where.slug,
          ) ?? null,
        update: async ({ where, data }: Row) => {
          write('course.update');
          const course = courses.find((row) => row.id === where.id)!;
          course.enrollmentCount +=
            (data.enrollmentCount.increment ?? 0) -
            (data.enrollmentCount.decrement ?? 0);
          return course;
        },
      },
      lesson: {
        findUnique: async ({ where }: Row) => {
          const lesson = lessons.find((row) => row.id === where.id);
          if (!lesson) return null;
          const course = courses.find((row) => row.id === lesson.courseId);
          return { ...lesson, videoAsset: null, section: { course } };
        },
      },
      enrollment: {
        findUnique: async ({ where }: Row) => {
          const row = findEnrollment(where);
          return row ? { ...row } : null;
        },
        findUniqueOrThrow: async ({ where }: Row) => ({
          ...findEnrollment(where)!,
        }),
        createMany: async ({ data, skipDuplicates }: Row) => {
          write('enrollment.createMany');
          let count = 0;
          for (const item of data) {
            const duplicate = findEnrollment({
              userId_courseId: { userId: item.userId, courseId: item.courseId },
            });
            if (duplicate && skipDuplicates) continue;
            if (duplicate) throw new Error('P2002');
            enrollments.push({
              id: `enrollment-${nextId++}`,
              grantedAt: new Date(),
              revokedAt: null,
              grantedById: null,
              purchaseId: null,
              ...item,
            });
            count += 1;
          }
          return { count };
        },
        updateMany: async ({ where, data }: Row) => {
          write('enrollment.updateMany');
          const matches = enrollments.filter(
            (row) =>
              row.id === where.id &&
              row.status === where.status &&
              (where.source === undefined || row.source === where.source),
          );
          for (const row of matches) Object.assign(row, data);
          return { count: matches.length };
        },
      },
      auditLog: {
        create: async ({ data }: Row) => {
          write('auditLog.create');
          auditLogs.push(data);
          return data;
        },
      },
    };
  }

  const prisma = {
    ...client('root'),
    $transaction: async (work: (tx: unknown) => Promise<unknown>) => {
      transactions += 1;
      return work(client(`tx-${transactions}`));
    },
  };

  return {
    prisma: prisma as unknown as PrismaService,
    client,
    courses,
    enrollments,
    auditLogs,
    writes,
    order,
    transactions: () => transactions,
  };
}

function setup() {
  const db = fakeDatabase();
  const service = new EnrollmentService(db.prisma, new AuditService(db.prisma));
  const grant = (courseId = 'published') =>
    service.grant({
      userId: STUDENT.id,
      courseId,
      source: 'MANUAL_GRANT',
      actorId: ADMIN.id,
      ipAddress: '127.0.0.1',
    });
  // The payment path: the system grants, and the order is the reason.
  const buy = (purchaseId = 'purchase-1', courseId = 'published') =>
    service.grant({
      userId: STUDENT.id,
      courseId,
      source: 'PURCHASE',
      actorId: null,
      purchaseId,
    });
  const revoke = (enrollmentId: string) =>
    service.revoke({
      enrollmentId,
      actorId: ADMIN.id,
      reason: 'admin_revoke',
      trigger: 'admin',
    });
  return { db, service, grant, buy, revoke };
}

async function statusOf(promise: Promise<unknown>): Promise<number> {
  try {
    await promise;
    return 200;
  } catch (error) {
    return (error as HttpException).getStatus();
  }
}

describe('EnrollmentService', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('never creates a second row for a duplicate grant', async () => {
    const { db, grant } = setup();

    const first = await grant();
    const second = await grant();

    expect(first.changed).toBe(true);
    expect(second.changed).toBe(false);
    expect(second.enrollment.id).toBe(first.enrollment.id);
    expect(db.enrollments).toHaveLength(1);
    expect(db.courses[0].enrollmentCount).toBe(1);
    // The repeat is a pure read: no write and no audit row of its own.
    expect(db.auditLogs).toHaveLength(1);
    expect(db.writes.filter((write) => write.via === 'tx-2')).toEqual([]);
  });

  it('counts concurrent grants and concurrent re-grants exactly once', async () => {
    const { db, grant, revoke } = setup();

    // Both calls read "no row" before either writes; only one insert wins.
    const created = await Promise.all([grant(), grant()]);
    expect(created.map((result) => result.changed).sort()).toEqual([
      false,
      true,
    ]);
    expect(db.enrollments).toHaveLength(1);
    expect(db.courses[0].enrollmentCount).toBe(1);
    expect(db.auditLogs).toHaveLength(1);

    await revoke(created[0].enrollment.id);
    // Both read REVOKED; only one conditional update flips it back.
    const reactivated = await Promise.all([grant(), grant()]);
    expect(reactivated.map((result) => result.changed).sort()).toEqual([
      false,
      true,
    ]);
    expect(db.enrollments).toHaveLength(1);
    expect(db.courses[0].enrollmentCount).toBe(1);
    expect(db.auditLogs.map((log) => log.action)).toEqual([
      'enrollment.granted',
      'enrollment.revoked',
      'enrollment.granted',
    ]);
  });

  it('reactivates the same row on re-grant, keeps grantedAt, and moves the counter +1 -1 +1', async () => {
    vi.useFakeTimers();
    const { db, grant, revoke } = setup();

    vi.setSystemTime(new Date('2026-09-01T00:00:00.000Z'));
    const granted = await grant();
    expect(db.courses[0].enrollmentCount).toBe(1);

    vi.setSystemTime(new Date('2026-09-02T00:00:00.000Z'));
    const revoked = await revoke(granted.enrollment.id);
    expect(revoked).toMatchObject({ changed: true });
    expect(revoked.enrollment).toMatchObject({ status: 'REVOKED' });
    expect(revoked.enrollment.revokedAt).toEqual(
      new Date('2026-09-02T00:00:00.000Z'),
    );
    expect(db.courses[0].enrollmentCount).toBe(0);

    // Revoking an already revoked row changes nothing and records nothing.
    expect(await revoke(granted.enrollment.id)).toMatchObject({
      changed: false,
    });
    expect(db.courses[0].enrollmentCount).toBe(0);

    vi.setSystemTime(new Date('2026-09-03T00:00:00.000Z'));
    const regranted = await grant();
    expect(regranted.changed).toBe(true);
    expect(regranted.enrollment).toMatchObject({
      id: granted.enrollment.id,
      status: 'ACTIVE',
      revokedAt: null,
      grantedById: ADMIN.id,
    });
    expect(regranted.enrollment.grantedAt).toEqual(
      new Date('2026-09-01T00:00:00.000Z'),
    );
    expect(db.enrollments).toHaveLength(1);
    expect(db.courses[0].enrollmentCount).toBe(1);

    expect(db.auditLogs.map((log) => log.action)).toEqual([
      'enrollment.granted',
      'enrollment.revoked',
      'enrollment.granted',
    ]);
    expect(db.auditLogs[1]).toMatchObject({
      actorId: ADMIN.id,
      entityType: 'ENROLLMENT',
      entityId: granted.enrollment.id,
      metadata: {
        courseId: 'published',
        userId: STUDENT.id,
        reason: 'admin_revoke',
        trigger: 'admin',
      },
    });
    expect(db.auditLogs[0]).toMatchObject({
      ipAddress: '127.0.0.1',
      metadata: {
        courseId: 'published',
        userId: STUDENT.id,
        source: 'MANUAL_GRANT',
      },
    });
  });

  it('grants a purchase as the system: the order is linked, nobody is recorded as granter, the counter moves once', async () => {
    const { db, buy } = setup();

    const result = await buy();

    expect(result.changed).toBe(true);
    expect(result.enrollment).toMatchObject({
      status: 'ACTIVE',
      source: 'PURCHASE',
      purchaseId: 'purchase-1',
      grantedById: null,
    });
    expect(db.courses[0].enrollmentCount).toBe(1);
    expect(db.auditLogs).toEqual([
      expect.objectContaining({
        actorId: null,
        action: 'enrollment.granted',
        metadata: expect.objectContaining({
          source: 'PURCHASE',
          purchaseId: 'purchase-1',
        }),
      }),
    ]);
  });

  // DATA_MODEL.md §Enrollment: buying after a manual grant moves the access
  // onto the order, so a refund later knows it may revoke it.
  it('flips an ACTIVE manual grant to the purchase without a second count, keeping who granted it and when', async () => {
    vi.useFakeTimers();
    const { db, grant, buy } = setup();
    vi.setSystemTime(new Date('2026-09-01T00:00:00.000Z'));
    const manual = await grant();
    vi.setSystemTime(new Date('2026-09-05T00:00:00.000Z'));

    const result = await buy();

    expect(result.changed).toBe(true);
    expect(result.enrollment).toMatchObject({
      id: manual.enrollment.id,
      status: 'ACTIVE',
      source: 'PURCHASE',
      purchaseId: 'purchase-1',
      grantedById: ADMIN.id,
    });
    expect(result.enrollment.grantedAt).toEqual(
      new Date('2026-09-01T00:00:00.000Z'),
    );
    expect(db.enrollments).toHaveLength(1);
    expect(db.courses[0].enrollmentCount).toBe(1);
    expect(db.auditLogs.map((log) => log.action)).toEqual([
      'enrollment.granted',
      'enrollment.granted',
    ]);
    expect(db.auditLogs[1].metadata).toMatchObject({
      source: 'PURCHASE',
      previousSource: 'MANUAL_GRANT',
    });
  });

  it('answers a repeated purchase grant, and a manual grant over a purchase, with no write', async () => {
    const { db, grant, buy } = setup();
    const first = await buy();
    const written = db.writes.length;

    const again = await buy();
    const manual = await grant();

    expect(again).toMatchObject({ changed: false });
    expect(manual).toMatchObject({ changed: false });
    // The access keeps resting on the order: a manual grant never downgrades it.
    expect(manual.enrollment).toMatchObject({
      id: first.enrollment.id,
      source: 'PURCHASE',
      purchaseId: 'purchase-1',
    });
    expect(db.writes).toHaveLength(written);
    expect(db.courses[0].enrollmentCount).toBe(1);
    expect(db.auditLogs).toHaveLength(1);
  });

  it('reactivates a revoked row for a new order, and a later manual grant clears the order link', async () => {
    const { db, grant, buy, revoke } = setup();
    const manual = await grant();
    await revoke(manual.enrollment.id);

    const bought = await buy('purchase-2');

    expect(bought.changed).toBe(true);
    // The old granter stays: it is history, not state.
    expect(bought.enrollment).toMatchObject({
      id: manual.enrollment.id,
      status: 'ACTIVE',
      revokedAt: null,
      source: 'PURCHASE',
      purchaseId: 'purchase-2',
      grantedById: ADMIN.id,
    });
    expect(db.courses[0].enrollmentCount).toBe(1);

    await revoke(manual.enrollment.id);
    const regranted = await grant();

    expect(regranted.enrollment).toMatchObject({
      source: 'MANUAL_GRANT',
      purchaseId: null,
      grantedById: ADMIN.id,
    });
    expect(db.courses[0].enrollmentCount).toBe(1);
  });

  // Checkout only sells PUBLISHED courses. If the owner unpublishes one a minute
  // later, the payment is already collected: a 404 here would roll the whole
  // confirmation back and leave money taken with nothing recorded.
  it('grants a paid order on a course unpublished after checkout began, but never a manual grant', async () => {
    const { db, grant, buy } = setup();

    const bought = await buy('purchase-1', 'draft');

    expect(bought.changed).toBe(true);
    expect(db.courses.find((course) => course.id === 'draft')?.enrollmentCount).toBe(1);
    expect(await statusOf(grant('draft'))).toBe(404);
    expect(await statusOf(buy('purchase-2', 'missing'))).toBe(404);
  });

  // The purchase flip writes an enrollment row while holding the course lock;
  // a revoke that locked the row first would wait on that lock while the flip
  // waits on the row: a deadlock. Both take the course first.
  it('locks the course before it writes the enrollment, in grant and in revoke', async () => {
    const { db, buy, revoke } = setup();

    const { enrollment } = await buy();
    await revoke(enrollment.id);

    expect(db.order.filter((step) => step.via === 'tx-1').map((step) => step.op)).toEqual([
      'course.lock',
      'enrollment.createMany',
      'course.update',
      'auditLog.create',
    ]);
    expect(db.order.filter((step) => step.via === 'tx-2').map((step) => step.op)).toEqual([
      'course.lock',
      'enrollment.updateMany',
      'course.update',
      'auditLog.create',
    ]);
  });

  it('writes each state change, its counter and its audit row in one transaction', async () => {
    const { db, grant, revoke } = setup();

    const { enrollment } = await grant();
    await revoke(enrollment.id);

    expect(db.writes.every((write) => write.via !== 'root')).toBe(true);
    expect(db.writes.filter((write) => write.via === 'tx-1')).toEqual([
      { via: 'tx-1', op: 'enrollment.createMany' },
      { via: 'tx-1', op: 'course.update' },
      { via: 'tx-1', op: 'auditLog.create' },
    ]);
    expect(db.writes.filter((write) => write.via === 'tx-2')).toEqual([
      { via: 'tx-2', op: 'enrollment.updateMany' },
      { via: 'tx-2', op: 'course.update' },
      { via: 'tx-2', op: 'auditLog.create' },
    ]);
  });

  it("joins the caller's transaction instead of opening its own", async () => {
    const { db, service } = setup();
    const outer = db.client('outer');

    await service.grant({
      userId: STUDENT.id,
      courseId: 'published',
      source: 'MANUAL_GRANT',
      actorId: ADMIN.id,
      tx: outer as never,
    });

    expect(db.transactions()).toBe(0);
    expect(new Set(db.writes.map((write) => write.via))).toEqual(
      new Set(['outer']),
    );
  });

  it('hasAccess is true for an ARCHIVED course while the enrollment is ACTIVE', async () => {
    const { service, grant, revoke } = setup();

    expect(await service.hasAccess(STUDENT.id, 'archived')).toBe(false);
    const { enrollment } = await grant('archived');
    expect(await service.hasAccess(STUDENT.id, 'archived')).toBe(true);
    await revoke(enrollment.id);
    expect(await service.hasAccess(STUDENT.id, 'archived')).toBe(false);
  });

  it('refuses to grant a DRAFT or missing course, a manual grant without an admin, or a purchase without an order', async () => {
    const { db, service, grant } = setup();

    expect(await statusOf(grant('draft'))).toBe(404);
    expect(await statusOf(grant('missing'))).toBe(404);
    await expect(
      service.grant({
        userId: STUDENT.id,
        courseId: 'published',
        source: 'MANUAL_GRANT',
        actorId: null,
      }),
    ).rejects.toThrow(/granting admin/);
    await expect(
      service.grant({
        userId: STUDENT.id,
        courseId: 'published',
        source: 'PURCHASE',
        actorId: null,
      }),
    ).rejects.toThrow(/purchaseId/);
    expect(db.enrollments).toEqual([]);
    expect(db.auditLogs).toEqual([]);
  });

  it('answers the lesson and course access rule with the right status codes', async () => {
    const { service, grant } = setup();

    expect(await statusOf(service.lessonAccess(STUDENT, 'paid-lesson'))).toBe(
      403,
    );
    expect(await statusOf(service.lessonAccess(STUDENT, 'missing'))).toBe(404);
    expect(await statusOf(service.lessonAccess(STUDENT, 'draft-preview'))).toBe(
      404,
    );
    await expect(
      service.lessonAccess(STUDENT, 'preview-lesson'),
    ).resolves.toMatchObject({ mode: 'PREVIEW' });
    await expect(
      service.lessonAccess(ADMIN, 'draft-preview'),
    ).resolves.toMatchObject({ mode: 'ADMIN' });

    // Course level has no preview mode.
    expect(await statusOf(service.courseAccess(STUDENT, 'published'))).toBe(
      403,
    );
    expect(await statusOf(service.courseAccess(STUDENT, 'archived'))).toBe(404);
    await grant('archived');
    await expect(
      service.courseAccess(STUDENT, 'archived'),
    ).resolves.toMatchObject({ mode: 'ENROLLED' });
  });
});

describe('resolveAccess', () => {
  it.each([
    // courseStatus, enrolled, canManage, isPreview, expected
    ['PUBLISHED', true, false, false, 'ENROLLED'],
    ['PUBLISHED', false, false, true, 'PREVIEW'],
    ['PUBLISHED', false, false, false, 'NOT_ENROLLED'],
    ['PUBLISHED', false, true, false, 'ADMIN'],
    // An admin or instructor owner who also holds an ACTIVE enrollment learns as a student.
    ['PUBLISHED', true, true, false, 'ENROLLED'],
    ['ARCHIVED', true, false, false, 'ENROLLED'],
    ['ARCHIVED', false, false, true, 'NOT_FOUND'],
    ['ARCHIVED', false, true, false, 'ADMIN'],
    ['DRAFT', false, false, true, 'NOT_FOUND'],
    // No enrollment exemption for a course that was never sold.
    ['DRAFT', true, false, false, 'NOT_FOUND'],
    ['DRAFT', false, true, true, 'ADMIN'],
  ] as const)(
    '%s, enrolled=%s, canManage=%s, preview=%s → %s',
    (courseStatus, enrolled, canManage, isPreview, expected) => {
      expect(
        resolveAccess({ courseStatus, enrolled, canManage, isPreview }),
      ).toBe(expected);
    },
  );

  describe('resolveAccess for a course owner', () => {
    it('lets the owning instructor preview a DRAFT course like an admin', () => {
      expect(
        resolveAccess({ courseStatus: 'DRAFT', enrolled: false, canManage: true, isPreview: false }),
      ).toBe('ADMIN');
    });
  });
});
