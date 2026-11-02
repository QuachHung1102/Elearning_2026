import { describe, expect, it } from 'vitest';
import { bookTrialVideo } from './book-trial.js';

describe('public book video allowlist', () => {
  it('resolves the four book recordings to individual public MP4s', () => {
    for (const number of ['01', '02', '03', '04']) {
      const result = bookTrialVideo(`books/lesson-${number}`);
      expect(result?.path).toBe(`/videos/books/lesson-${number}.mp4`);
      expect(result?.durationSeconds).toBeGreaterThan(60);
    }
  });

  it('does not expose demo, paid or arbitrary files through the trial mapping', () => {
    for (const uid of [
      'demo/course-1',
      'paid/lesson-01',
      'books/lesson-05',
      'books/../secret',
      '__proto__',
      'constructor',
    ]) {
      expect(bookTrialVideo(uid)).toBeNull();
    }
  });
});
