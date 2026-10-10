import {
  coverKey,
  isCoverKeyFor,
  isResourceKeyFor,
  resourceKey,
} from './object-storage.js';

const COURSE_ID = '11111111-2222-4333-8444-555555555555';
const OTHER_COURSE_ID = '99999999-8888-4777-8666-555555555555';
const LESSON_ID = '66666666-7777-4888-8999-aaaaaaaaaaaa';
const OTHER_LESSON_ID = 'cccccccc-dddd-4eee-8fff-000000000000';

describe('isCoverKeyFor', () => {
  it('accepts exactly what coverKey() generates for the same course', () => {
    const key = coverKey(COURSE_ID, 'image/jpeg');
    expect(isCoverKeyFor(COURSE_ID, key)).toBe(true);
  });

  it('rejects a key generated for a different course', () => {
    const key = coverKey(OTHER_COURSE_ID, 'image/jpeg');
    expect(isCoverKeyFor(COURSE_ID, key)).toBe(false);
  });

  it('rejects a traversal attempt that only matches the prefix as a string', () => {
    expect(
      isCoverKeyFor(
        COURSE_ID,
        `public/courses/${COURSE_ID}/cover/../../${OTHER_COURSE_ID}/cover/x.jpg`,
      ),
    ).toBe(false);
    expect(
      isCoverKeyFor(
        COURSE_ID,
        `public/courses/${COURSE_ID}/cover/..\\..\\${OTHER_COURSE_ID}\\cover\\x.jpg`,
      ),
    ).toBe(false);
  });
});

describe('isResourceKeyFor', () => {
  it('accepts exactly what resourceKey() generates for the same lesson', () => {
    const key = resourceKey(LESSON_ID, 'bài tập.pdf');
    expect(isResourceKeyFor(LESSON_ID, key)).toBe(true);
  });

  it('rejects a key generated for a different lesson', () => {
    const key = resourceKey(OTHER_LESSON_ID, 'bai-tap.pdf');
    expect(isResourceKeyFor(LESSON_ID, key)).toBe(false);
  });

  it('rejects a traversal attempt that only matches the prefix as a string', () => {
    expect(
      isResourceKeyFor(
        LESSON_ID,
        `lessons/${LESSON_ID}/resources/../../${OTHER_LESSON_ID}/resources/x.pdf`,
      ),
    ).toBe(false);
    expect(
      isResourceKeyFor(
        LESSON_ID,
        `lessons/${LESSON_ID}/resources/..\\..\\${OTHER_LESSON_ID}\\resources\\x.pdf`,
      ),
    ).toBe(false);
  });
});
