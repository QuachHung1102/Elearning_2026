import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import {
  addAttempt,
  as,
  bootApp,
  createCourse,
  createOrder,
  createUser,
  signIn,
  truncateAll,
  type Session,
} from './support.js';

type Sale = {
  status?: 'PENDING' | 'PAID' | 'REFUND_REQUESTED' | 'REFUNDED' | 'CANCELLED';
  priceVnd: number;
  paidAt?: string;
  courseId?: string;
};

/**
 * Revenue on `/admin` (API_CONTRACT.md §5.7): what the reports count as money,
 * on which day, and for whom. Read only.
 */
describe('reports and the user purchase columns (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await bootApp());
  });

  beforeEach(async () => {
    await truncateAll(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  async function admin() {
    const user = await createUser(prisma, 'ADMIN');
    return signIn(app, user.email);
  }

  const get = (session: Session | null, path: string) => {
    const call = request(app.getHttpServer()).get(`/api/v1${path}`);
    return session ? call.set(as(session)) : call;
  };

  /** One order by a fresh learner, in the state and at the time given. */
  async function sale({ status = 'PAID', priceVnd, paidAt, courseId }: Sale) {
    const user = await createUser(prisma, 'STUDENT');
    const course = courseId ? { id: courseId } : await createCourse(prisma, { priceVnd });
    const purchase = await prisma.purchase.create({
      data: {
        userId: user.id,
        courseId: course.id,
        priceVnd,
        status,
        paidAt: paidAt ? new Date(paidAt) : null,
        refundedAt: status === 'REFUNDED' ? new Date() : null,
      },
    });
    return { user, course, purchase };
  }

  describe('GET /admin/reports/overview', () => {
    const RANGE = '?from=2026-09-29T00:00:00.000Z&to=2026-10-02T00:00:00.000Z';

    it('counts paid money in the range, per Vietnamese calendar day, net of refunds', async () => {
      const session = await admin();
      // 01:00 on 1 October in Vietnam, but still 30 September in UTC.
      await sale({ priceVnd: 499_000, paidAt: '2026-09-30T18:00:00.000Z' });
      // 23:59:59 on 30 September in Vietnam.
      await sale({ priceVnd: 299_000, paidAt: '2026-09-30T16:59:59.000Z' });
      // A pending refund is still revenue until the order is REFUNDED.
      await sale({ status: 'REFUND_REQUESTED', priceVnd: 199_000, paidAt: '2026-09-30T02:00:00.000Z' });
      // None of these is money in this range.
      await sale({ status: 'REFUNDED', priceVnd: 999_000, paidAt: '2026-09-30T05:00:00.000Z' });
      await sale({ status: 'PENDING', priceVnd: 111_000 });
      await sale({ status: 'CANCELLED', priceVnd: 222_000 });
      await sale({ priceVnd: 333_000, paidAt: '2026-08-01T05:00:00.000Z' });

      const response = await get(session, `/admin/reports/overview${RANGE}`).expect(200);

      expect(response.body).toMatchObject({ revenueVnd: 997_000, paidPurchases: 3 });
      expect(response.body.series).toEqual([
        { date: '2026-09-29', revenueVnd: 0, purchases: 0 },
        { date: '2026-09-30', revenueVnd: 498_000, purchases: 2 },
        { date: '2026-10-01', revenueVnd: 499_000, purchases: 1 },
        { date: '2026-10-02', revenueVnd: 0, purchases: 0 },
      ]);
    });

    it('counts QR codes still waiting for payment as they are now, whatever the range', async () => {
      const session = await admin();
      const first = await createOrder(prisma, {});
      await addAttempt(prisma, first.purchase.id, { ageMinutes: 60 });
      await createOrder(prisma, { attempt: 'EXPIRED' });
      await createOrder(prisma, { attempt: 'FAILED' });

      const response = await get(session, '/admin/reports/overview?from=2020-01-01T00:00:00.000Z&to=2020-01-31T00:00:00.000Z').expect(200);

      expect(response.body.pendingPaymentAttempts).toBe(2);
      expect(response.body.revenueVnd).toBe(0);
    });

    it('is zero across the board when nothing was sold', async () => {
      const session = await admin();

      const response = await get(session, `/admin/reports/overview${RANGE}`).expect(200);

      expect(response.body).toMatchObject({ revenueVnd: 0, paidPurchases: 0, pendingPaymentAttempts: 0 });
      expect(response.body.series.every((day: { revenueVnd: number; purchases: number }) => day.revenueVnd === 0 && day.purchases === 0)).toBe(true);
    });
  });

  describe('GET /admin/reports/courses', () => {
    async function catalog() {
      const busy = await createCourse(prisma, { priceVnd: 499_000 });
      const quiet = await createCourse(prisma, { priceVnd: 299_000 });
      const idle = await createCourse(prisma, { priceVnd: 99_000 });
      const draft = await createCourse(prisma, { status: 'DRAFT' });
      await prisma.course.update({ where: { id: busy.id }, data: { title: 'Khóa bận rộn' } });
      await prisma.course.update({ where: { id: quiet.id }, data: { title: 'Khóa yên tĩnh' } });
      await prisma.course.update({ where: { id: idle.id }, data: { title: 'Khóa ế' } });

      // `busy`: two lessons, two active learners, one finished both.
      const section = await prisma.section.create({ data: { courseId: busy.id, title: 'Chương', position: 1 } });
      const lessons = await Promise.all(
        [1, 2].map((position) =>
          prisma.lesson.create({ data: { sectionId: section.id, title: `Bài ${position}`, type: 'ARTICLE', position } }),
        ),
      );
      const finisher = await sale({ priceVnd: 499_000, paidAt: new Date().toISOString(), courseId: busy.id });
      const partial = await createUser(prisma, 'STUDENT');
      for (const learner of [finisher.user, partial]) {
        await prisma.enrollment.create({
          data: { userId: learner.id, courseId: busy.id, source: 'MANUAL_GRANT', grantedById: (await createUser(prisma, 'ADMIN')).id },
        });
      }
      for (const lesson of lessons) {
        await prisma.lessonProgress.create({ data: { userId: finisher.user.id, lessonId: lesson.id, completedAt: new Date() } });
      }
      await prisma.lessonProgress.create({ data: { userId: partial.id, lessonId: lessons[0].id, completedAt: new Date() } });

      // `quiet`: sold once, and its only learner has been refunded and revoked.
      const gone = await sale({ priceVnd: 299_000, paidAt: new Date().toISOString(), courseId: quiet.id });
      await prisma.enrollment.create({
        data: { userId: gone.user.id, courseId: quiet.id, source: 'PURCHASE', purchaseId: gone.purchase.id, status: 'REVOKED', revokedAt: new Date() },
      });

      // `idle`: sold long ago, so no revenue in the default window.
      await sale({ priceVnd: 99_000, paidAt: '2020-01-01T00:00:00.000Z', courseId: idle.id });
      return { busy, quiet, idle, draft };
    }

    it('reports revenue, new learners, active learners and completion per course, biggest earner first', async () => {
      const session = await admin();
      const { busy, quiet, idle } = await catalog();

      const response = await get(session, '/admin/reports/courses').expect(200);

      expect(response.body).toMatchObject({ page: 1, pageSize: 20, total: 3, totalPages: 1 });
      expect(response.body.items).toEqual([
        { courseId: busy.id, title: 'Khóa bận rộn', revenueVnd: 499_000, newEnrollments: 2, activeStudents: 2, completionRate: 0.5 },
        // A revoked learner is not active, so the rate has no denominator: null, not 0.
        { courseId: quiet.id, title: 'Khóa yên tĩnh', revenueVnd: 299_000, newEnrollments: 1, activeStudents: 0, completionRate: null },
        { courseId: idle.id, title: 'Khóa ế', revenueVnd: 0, newEnrollments: 0, activeStudents: 0, completionRate: null },
      ]);
    });

    it('binds revenue and new learners to the range but not the current state', async () => {
      const session = await admin();
      const { busy } = await catalog();

      const response = await get(session, '/admin/reports/courses?from=2020-01-01T00:00:00.000Z&to=2020-12-31T00:00:00.000Z').expect(200);

      const row = response.body.items.find((item: { courseId: string }) => item.courseId === busy.id);
      expect(row).toMatchObject({ revenueVnd: 0, newEnrollments: 0, activeStudents: 2, completionRate: 0.5 });
    });

    it('pages and rejects a range it cannot read', async () => {
      const session = await admin();
      await catalog();

      const second = await get(session, '/admin/reports/courses?pageSize=1&page=2').expect(200);

      expect(second.body).toMatchObject({ page: 2, pageSize: 1, total: 3, totalPages: 3 });
      expect(second.body.items).toHaveLength(1);
      expect(second.body.items[0].title).toBe('Khóa yên tĩnh');
      await get(session, '/admin/reports/courses?from=2026-10-02T00:00:00.000Z&to=2026-10-01T00:00:00.000Z').expect(400);
      await get(session, '/admin/reports/courses?from=yesterday').expect(400);
    });

    it('is closed to everyone but an admin', async () => {
      const instructor = await createUser(prisma, 'INSTRUCTOR');
      const student = await createUser(prisma, 'STUDENT');

      await get(null, '/admin/reports/courses').expect(404);
      await get(await signIn(app, instructor.email), '/admin/reports/courses').expect(404);
      await get(await signIn(app, student.email), '/admin/reports/courses').expect(404);
    });
  });

  describe('purchases on the admin user screens', () => {
    it('counts the orders a user has paid, refunded ones included, on the list row', async () => {
      const session = await admin();
      const buyer = await createUser(prisma, 'STUDENT');
      const make = (status: Sale['status'], paid: boolean) =>
        createCourse(prisma).then((course) =>
          prisma.purchase.create({
            data: {
              userId: buyer.id,
              courseId: course.id,
              priceVnd: 499_000,
              status,
              paidAt: paid ? new Date() : null,
              refundedAt: status === 'REFUNDED' ? new Date() : null,
            },
          }),
        );
      await make('PAID', true);
      await make('REFUNDED', true);
      await make('PENDING', false);
      await make('CANCELLED', false);

      const list = await get(session, `/admin/users?email=${encodeURIComponent(buyer.email)}`).expect(200);

      expect(list.body.items[0]).toMatchObject({ id: buyer.id, purchaseCount: 2 });
    });

    it('lists every order of a user, newest first, on the detail page', async () => {
      const session = await admin();
      const buyer = await createUser(prisma, 'STUDENT');
      const older = await createCourse(prisma);
      const newer = await createCourse(prisma);
      const first = await prisma.purchase.create({
        data: { userId: buyer.id, courseId: older.id, priceVnd: 499_000, status: 'PAID', paidAt: new Date(), createdAt: new Date(Date.now() - 86_400_000) },
      });
      const second = await prisma.purchase.create({
        data: { userId: buyer.id, courseId: newer.id, priceVnd: 299_000, status: 'PENDING' },
      });

      const detail = await get(session, `/admin/users/${buyer.id}`).expect(200);

      expect(detail.body.purchases.map((row: { id: string }) => row.id)).toEqual([second.id, first.id]);
      expect(detail.body.purchases[0]).toEqual({
        id: second.id,
        courseId: newer.id,
        courseSlug: newer.slug,
        courseTitle: 'Khóa có thể mua',
        priceVnd: 299_000,
        status: 'PENDING',
        createdAt: expect.any(String),
        paidAt: null,
        refundedAt: null,
      });
      const other = await createUser(prisma, 'STUDENT');
      expect((await get(session, `/admin/users/${other.id}`).expect(200)).body.purchases).toEqual([]);
    });
  });
});
