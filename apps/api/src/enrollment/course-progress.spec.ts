import { summarizeProgress } from './course-progress.js';

const at = (minute: number) => new Date(Date.UTC(2026, 8, 1, 10, minute));

describe('summarizeProgress', () => {
  it('counts completed lessons and resumes on the most recently touched one', () => {
    const result = summarizeProgress(
      ['a', 'b', 'c'],
      [
        { lessonId: 'a', completedAt: at(1), updatedAt: at(1) },
        { lessonId: 'c', completedAt: null, updatedAt: at(9) },
        { lessonId: 'b', completedAt: at(5), updatedAt: at(5) },
      ],
    );
    expect(result).toEqual({
      progress: { completedLessons: 2, totalLessons: 3, percent: 67 },
      resumeLessonId: 'c',
      lastActivityAt: at(9),
    });
  });

  it('starts at the first lesson when nothing was touched', () => {
    expect(summarizeProgress(['a', 'b'], [])).toEqual({
      progress: { completedLessons: 0, totalLessons: 2, percent: 0 },
      resumeLessonId: 'a',
      lastActivityAt: null,
    });
  });

  it('ignores rows of lessons outside the current curriculum', () => {
    const result = summarizeProgress(
      ['a'],
      [{ lessonId: 'gone', completedAt: at(1), updatedAt: at(9) }],
    );
    expect(result.progress.completedLessons).toBe(0);
    expect(result.resumeLessonId).toBe('a');
  });

  it('answers 0 % and no resume lesson for an empty course', () => {
    expect(summarizeProgress([], [])).toEqual({
      progress: { completedLessons: 0, totalLessons: 0, percent: 0 },
      resumeLessonId: null,
      lastActivityAt: null,
    });
  });
});
