import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { hashPassword } from '../src/auth/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/** Shared e2e helpers for new specs; older specs still carry their own copies. */
export const PASSWORD = 'correct horse battery staple';

export type Session = { cookies: string[]; token: string };
export type Role = 'ADMIN' | 'STUDENT' | 'INSTRUCTOR';

export async function bootApp(options?: Parameters<typeof configureApp>[1]) {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleFixture.createNestApplication<NestExpressApplication>();
  configureApp(app, options);
  // Listening up front: handed a server that is not listening, supertest
  // listens and closes it per request, so parallel requests reset each other
  // (ECONNRESET on Linux CI).
  await app.listen(0, '127.0.0.1');
  return { app, prisma: app.get(PrismaService) };
}

/**
 * Runs the real seed (DATA_MODEL.md §Dữ liệu seed) against the test database.
 * It is idempotent, but it only puts its own rows back: truncate first when the
 * test needs an otherwise empty database.
 */
export function seedDemoData(): void {
  const tsx = createRequire(import.meta.url).resolve('tsx/cli');
  execFileSync(process.execPath, [tsx, 'prisma/seed.ts'], {
    cwd: resolve(import.meta.dirname, '..'),
    env: process.env,
    stdio: 'inherit',
  });
}

export async function truncateAll(prisma: PrismaService): Promise<void> {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const names = tables
    .map(({ tablename }) => `"${tablename.replaceAll('"', '""')}"`)
    .join(', ');
  if (names) {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`,
    );
  }
}

export async function createUser(prisma: PrismaService, role: Role) {
  return prisma.user.create({
    data: {
      email: `${role.toLowerCase()}-${randomUUID()}@example.com`,
      passwordHash: await hashPassword(PASSWORD),
      displayName: role === 'INSTRUCTOR' ? 'Giảng viên' : 'Người dùng',
      role,
      emailVerifiedAt: new Date(),
    },
    select: { id: true, email: true },
  });
}

/**
 * Opens `size` connections before a race test. A cold pool serves the first
 * transaction at once and makes the rest wait out a connection handshake, longer
 * than the transaction itself, so "simultaneous" calls run one after another and
 * the race never happens (measured: the others started ~80 ms after the first
 * had committed).
 */
/**
 * Resolves once some transaction is blocked on a lock: the moment a race test's
 * second writer is really waiting on the first, which a fixed sleep only guesses.
 * Throws if that does not happen within `timeoutMs`.
 */
export async function untilBlockedOnLock(
  prisma: PrismaService,
  timeoutMs = 5_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const [{ blocked }] = await prisma.$queryRaw<{ blocked: number }[]>`
      SELECT count(*)::int AS blocked FROM pg_stat_activity
      WHERE datname = current_database() AND wait_event_type = 'Lock'`;
    if (blocked > 0) return;
    if (Date.now() > deadline) {
      throw new Error('No transaction ended up waiting on a lock');
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

export async function warmPool(prisma: PrismaService, size = 8): Promise<void> {
  await Promise.all(
    Array.from({ length: size }, () =>
      prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT 1 AS warm FROM pg_sleep(0.2)`;
      }),
    ),
  );
}

export async function createCourse(
  prisma: PrismaService,
  over: {
    status?: 'PUBLISHED' | 'DRAFT' | 'ARCHIVED';
    priceVnd?: number;
  } = {},
) {
  return prisma.course.create({
    data: {
      slug: `khoa-${randomUUID().slice(0, 8)}`,
      title: 'Khóa có thể mua',
      description: '',
      priceVnd: over.priceVnd ?? 499_000,
      status: over.status ?? 'PUBLISHED',
      publishedAt: new Date(),
      learningOutcomes: [],
      requirements: [],
      targetAudience: [],
    },
  });
}

export type AttemptState = 'PENDING' | 'EXPIRED' | 'FAILED' | 'CANCELLED';

/**
 * One QR of an order. `ageMinutes` backdates `createdAt` (reconcile ignores
 * attempts younger than RECONCILE_MIN_AGE); a PENDING attempt is live for
 * fifteen more minutes, any other state expired fifteen minutes ago, unless
 * `expiresInMinutes` says otherwise.
 */
export function addAttempt(
  prisma: PrismaService,
  purchaseId: string,
  over: {
    status?: AttemptState;
    ageMinutes?: number;
    expiresInMinutes?: number;
    amountVnd?: number;
  } = {},
) {
  const status = over.status ?? 'PENDING';
  const inMinutes = over.expiresInMinutes ?? (status === 'PENDING' ? 15 : -15);
  return prisma.paymentAttempt.create({
    data: {
      purchaseId,
      appTransId: `260930_${randomUUID().slice(0, 8)}`,
      amountVnd: over.amountVnd ?? 499_000,
      status,
      createdAt: new Date(Date.now() - (over.ageMinutes ?? 0) * 60_000),
      expiresAt: new Date(Date.now() + inMinutes * 60_000),
    },
  });
}

export type OrderState = {
  purchase?: 'PENDING' | 'PAID' | 'CANCELLED' | 'REFUNDED';
  course?: 'PUBLISHED' | 'DRAFT';
  priceVnd?: number;
} & Parameters<typeof addAttempt>[2] & { attempt?: AttemptState };

/** A learner with an order and one QR, as `POST /checkout` leaves them. */
export async function createOrder(prisma: PrismaService, state: OrderState = {}) {
  const price = state.priceVnd ?? 499_000;
  const user = await createUser(prisma, 'STUDENT');
  const course = await createCourse(prisma, {
    status: state.course,
    priceVnd: price,
  });
  const purchase = await prisma.purchase.create({
    data: {
      userId: user.id,
      courseId: course.id,
      priceVnd: price,
      status: state.purchase ?? 'PENDING',
    },
  });
  const attempt = await addAttempt(prisma, purchase.id, {
    ...state,
    status: state.attempt ?? state.status,
    amountVnd: state.amountVnd ?? price,
  });
  return { user, course, purchase, attempt };
}

export type PaidOrderState = {
  status?: 'PENDING' | 'PAID' | 'REFUND_REQUESTED' | 'REFUNDED' | 'CANCELLED';
  paidDaysAgo?: number;
  priceVnd?: number;
  source?: 'PURCHASE' | 'MANUAL_GRANT';
  lessons?: number;
  completed?: number;
};

/**
 * A course `userId` has bought (or been granted by hand), with `lessons`
 * lessons of which `completed` are done: the shape the refund rules read.
 * An ACTIVE enrollment also bumps `enrollmentCount`, so the invariant
 * "count = ACTIVE rows" holds in the fixture as it does in production.
 */
export async function createPaidOrder(
  prisma: PrismaService,
  userId: string,
  over: PaidOrderState = {},
) {
  const price = over.priceVnd ?? 499_000;
  const course = await createCourse(prisma, { priceVnd: price });
  const status = over.status ?? 'PAID';
  const paid = status !== 'PENDING' && status !== 'CANCELLED';
  const purchase = await prisma.purchase.create({
    data: {
      userId,
      courseId: course.id,
      priceVnd: price,
      status,
      paidAt: paid
        ? new Date(Date.now() - (over.paidDaysAgo ?? 1) * 86_400_000)
        : null,
      refundedAt: status === 'REFUNDED' ? new Date() : null,
    },
  });
  if (paid) {
    const admin = await createUser(prisma, 'ADMIN');
    const source = over.source ?? 'PURCHASE';
    await prisma.enrollment.create({
      data: {
        userId,
        courseId: course.id,
        source,
        purchaseId: source === 'PURCHASE' ? purchase.id : null,
        grantedById: source === 'MANUAL_GRANT' ? admin.id : null,
      },
    });
    await prisma.course.update({
      where: { id: course.id },
      data: { enrollmentCount: 1 },
    });
  }
  const total = over.lessons ?? 10;
  if (total > 0) {
    const section = await prisma.section.create({
      data: { courseId: course.id, title: 'Chương 1', position: 1 },
    });
    for (let index = 0; index < total; index += 1) {
      const lesson = await prisma.lesson.create({
        data: {
          sectionId: section.id,
          title: `Bài ${index + 1}`,
          type: 'ARTICLE',
          position: index + 1,
        },
      });
      if (index < (over.completed ?? 0)) {
        await prisma.lessonProgress.create({
          data: { userId, lessonId: lesson.id, completedAt: new Date() },
        });
      }
    }
  }
  return { course, purchase };
}

export const cookieJar = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value : value ? [value] : []).map(
    (cookie) => cookie.split(';')[0],
  );

// Login is limited to 10/60s per client IP, so each sign-in gets its own.
let clientIp = 0;

export async function signIn(
  app: NestExpressApplication,
  email: string,
  password = PASSWORD,
): Promise<Session> {
  const csrf = await request(app.getHttpServer())
    .get('/api/v1/auth/csrf')
    .expect(200);
  const csrfCookies = cookieJar(csrf.headers['set-cookie']);
  const token = csrf.body.csrfToken as string;
  const login = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .set('Cookie', csrfCookies.join('; '))
    .set('X-CSRF-Token', token)
    .set(
      'X-Real-IP',
      `10.7.${Math.floor(clientIp / 250)}.${(clientIp += 1) % 250}`,
    )
    .send({ email, password })
    .expect(200);
  return {
    cookies: [...csrfCookies, ...cookieJar(login.headers['set-cookie'])],
    token,
  };
}

export const as = (session: Session) => ({
  Cookie: session.cookies.join('; '),
  'X-CSRF-Token': session.token,
});
