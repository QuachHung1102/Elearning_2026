import type { NestExpressApplication } from '@nestjs/platform-express';
import { bootApp, createCourse, truncateAll, untilBlockedOnLock } from './support.js';

/**
 * The helper that stands in for a fixed sleep in race tests (plan T2.5): it
 * returns when a transaction really is waiting on a lock, not after a guess of
 * how long that takes.
 */
describe('untilBlockedOnLock (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: Awaited<ReturnType<typeof bootApp>>['prisma'];

  beforeAll(async () => {
    ({ app, prisma } = await bootApp());
    await truncateAll(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns once a second transaction is stuck behind the first', async () => {
    const course = await createCourse(prisma);
    let waiter!: Promise<unknown>;

    await prisma.$transaction(async (tx) => {
      await tx.course.update({ where: { id: course.id }, data: { title: 'giữ khóa' } });
      waiter = prisma.$transaction((other) =>
        other.course.update({ where: { id: course.id }, data: { title: 'chờ khóa' } }),
      );
      await untilBlockedOnLock(prisma);
      // Still waiting: the first transaction has not committed.
      const raced = await Promise.race([waiter.then(() => 'done'), Promise.resolve('waiting')]);
      expect(raced).toBe('waiting');
    });

    await waiter;
    expect((await prisma.course.findUniqueOrThrow({ where: { id: course.id } })).title).toBe('chờ khóa');
  });

  it('gives up with a message of its own when nobody ever waits', async () => {
    await expect(untilBlockedOnLock(prisma, 150)).rejects.toThrow(/waiting on a lock/);
  });
});
