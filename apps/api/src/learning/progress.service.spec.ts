import { LessonType } from '../generated/prisma/enums.js';
import { nextProgress } from './progress.service.js';

const VIDEO = { type: LessonType.VIDEO, durationSeconds: 600 };
const ARTICLE = { type: LessonType.ARTICLE, durationSeconds: 0 };
const NOW = new Date('2026-09-20T08:00:00.000Z');
const EARLIER = new Date('2026-09-10T08:00:00.000Z');

describe('nextProgress', () => {
  it('creates a row from nothing', () => {
    expect(nextProgress(null, { lastPositionSeconds: 120 }, VIDEO, NOW)).toEqual(
      { lastPositionSeconds: 120, completedAt: null },
    );
  });

  it('never moves lastPositionSeconds below the stored value', () => {
    const stored = { lastPositionSeconds: 300, completedAt: null };
    expect(
      nextProgress(stored, { lastPositionSeconds: 40 }, VIDEO, NOW)
        .lastPositionSeconds,
    ).toBe(300);
    expect(
      nextProgress(stored, { lastPositionSeconds: 420 }, VIDEO, NOW)
        .lastPositionSeconds,
    ).toBe(420);
  });

  it('clamps the position to the lesson length when it is known', () => {
    expect(
      nextProgress(null, { lastPositionSeconds: 9_000 }, VIDEO, NOW)
        .lastPositionSeconds,
    ).toBe(600);
    expect(
      nextProgress(
        null,
        { lastPositionSeconds: 9_000 },
        { type: LessonType.VIDEO, durationSeconds: 0 },
        NOW,
      ).lastPositionSeconds,
    ).toBe(9_000);
  });

  it('stores 0 for an article whatever the client sends', () => {
    expect(
      nextProgress(null, { lastPositionSeconds: 55 }, ARTICLE, NOW)
        .lastPositionSeconds,
    ).toBe(0);
  });

  // The 95% threshold is measured client-side and arrives as completed=true.
  it('sets completedAt when the lesson is completed', () => {
    expect(
      nextProgress(
        { lastPositionSeconds: 560, completedAt: null },
        { lastPositionSeconds: 575, completed: true },
        VIDEO,
        NOW,
      ).completedAt,
    ).toEqual(NOW);
  });

  it('never overwrites an existing completedAt', () => {
    const stored = { lastPositionSeconds: 600, completedAt: EARLIER };
    expect(
      nextProgress(stored, { lastPositionSeconds: 600, completed: true }, VIDEO, NOW)
        .completedAt,
    ).toEqual(EARLIER);
    expect(
      nextProgress(stored, { lastPositionSeconds: 10 }, VIDEO, NOW).completedAt,
    ).toEqual(EARLIER);
  });

  it('clears completedAt only on an explicit completed=false', () => {
    const stored = { lastPositionSeconds: 0, completedAt: EARLIER };
    expect(
      nextProgress(stored, { lastPositionSeconds: 0, completed: false }, ARTICLE, NOW)
        .completedAt,
    ).toBeNull();
  });
});
