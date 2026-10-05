import { HttpException } from '@nestjs/common';
import { CatalogService } from './catalog.service.js';
import { buildSearchText } from './search-text.js';

const ID = '11111111-1111-4111-8111-111111111111';
const COVER = `public/courses/${ID}/cover/22222222-2222-4222-8222-222222222222.png`;
const actor = { actorId: 'admin-1', ipAddress: null };

/** What `updateCourse` reads before its transaction: deliberately stale. */
const staleCourse = {
  id: ID,
  slug: 'khoa-hoc',
  title: 'Tiêu đề cũ',
  subtitle: null,
  priceVnd: 100_000,
  compareAtPriceVnd: null,
  publishedAt: null,
  instructorId: null,
};

/** What the row holds once the transaction has locked it. */
const lockedRow = {
  title: 'Tiêu đề hiện tại',
  subtitle: 'Phụ đề hiện tại',
  price_vnd: 500_000,
  compare_at_price_vnd: null,
};

const updatedRow = {
  id: ID,
  slug: 'khoa-hoc',
  title: 'x',
  subtitle: null,
  coverImageKey: null,
  priceVnd: 500_000,
  compareAtPriceVnd: null,
  level: 'ALL_LEVELS',
  language: 'vi',
  lessonCount: 0,
  totalDurationSeconds: 0,
  enrollmentCount: 0,
  ratingAverage: null,
  ratingCount: 0,
  demoStats: false,
  category: null,
  instructor: null,
  description: '',
  learningOutcomes: [],
  requirements: [],
  targetAudience: [],
  publishedAt: null,
  updatedAt: new Date(),
  sections: [],
};

function setup() {
  const writes: { data: Record<string, unknown> }[] = [];
  const tx = {
    $queryRaw: vi.fn(async (): Promise<unknown[]> => [lockedRow]),
    course: {
      update: vi.fn(async (args: { data: Record<string, unknown> }) => {
        writes.push(args);
        return updatedRow;
      }),
    },
  };
  const prisma = {
    course: { findUnique: vi.fn(async () => staleCourse) },
    $transaction: vi.fn(async (run: (t: typeof tx) => unknown) => run(tx)),
  };
  const service = new CatalogService(
    prisma as never,
    { record: vi.fn(async () => undefined) } as never,
    { publicUrl: (key: string) => `/files/${key}` } as never,
    {} as never,
  );
  return { service, writes, tx };
}

const statusOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return (error as HttpException).getStatus();
  }
  return null;
};

// REVIEW F-07: `updateCourse` wrote title, subtitle, prices and searchText from
// the snapshot it read before the transaction, so a cover PATCH racing a price
// edit put the old price back.
describe('CatalogService.updateCourse writes', () => {
  it('sends only the fields the caller sent', async () => {
    const { service, writes } = setup();

    await service.updateCourse(ID, { coverImageKey: COVER }, actor);

    expect(Object.keys(writes[0].data).sort()).toEqual([
      'coverImageKey',
      'coverImageStorage',
    ]);
  });

  it('checks compareAtPriceVnd against the price stored now, not the one read earlier', async () => {
    const { service, writes } = setup();

    // 300,000 beats the stale 100,000 but not the stored 500,000.
    const status = await statusOf(
      service.updateCourse(ID, { compareAtPriceVnd: 300_000 }, actor),
    );

    expect(status).toBe(400);
    expect(writes).toHaveLength(0);
  });

  // REVIEW F-29: the new owner's role was read before the transaction, so an
  // instructor demoted in between could still be handed a course.
  it('re-checks that the new owner is still an instructor, under a lock', async () => {
    const owner = '33333333-3333-4333-8333-333333333333';
    const demoted = setup();
    // Owner's role first, then the course row: the order a demotion locks them in.
    demoted.tx.$queryRaw.mockResolvedValueOnce([{ role: 'STUDENT' }]);

    expect(
      await statusOf(
        demoted.service.updateCourse(ID, { instructorId: owner }, actor),
      ),
    ).toBe(400);
    expect(demoted.writes).toHaveLength(0);

    const teaching = setup();
    teaching.tx.$queryRaw
      .mockResolvedValueOnce([{ role: 'INSTRUCTOR' }])
      .mockResolvedValueOnce([lockedRow]);
    await teaching.service.updateCourse(ID, { instructorId: owner }, actor);
    expect(teaching.writes[0].data).toMatchObject({ instructorId: owner });
  });

  it('rebuilds searchText from the stored subtitle when only the title changes', async () => {
    const { service, writes } = setup();

    await service.updateCourse(ID, { title: 'Tiêu đề mới hơn' }, actor);

    expect(writes[0].data).toMatchObject({
      title: 'Tiêu đề mới hơn',
      searchText: buildSearchText('Tiêu đề mới hơn', 'Phụ đề hiện tại'),
    });
    expect(writes[0].data).not.toHaveProperty('priceVnd');
    expect(writes[0].data).not.toHaveProperty('subtitle');
  });
});
