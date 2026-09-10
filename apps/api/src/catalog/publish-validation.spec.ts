import { LessonType } from '../generated/prisma/enums.js';
import {
  publishIssues,
  type PublishCandidate,
  type PublishLesson,
} from './publish-validation.js';

function lesson(overrides: Partial<PublishLesson> = {}): PublishLesson {
  return {
    id: 'lesson-1',
    type: LessonType.VIDEO,
    content: null,
    isPreview: true,
    videoAssetId: 'video-1',
    videoReady: true,
    ...overrides,
  };
}

function publishable(
  overrides: Partial<PublishCandidate> = {},
): PublishCandidate {
  return {
    coverImageKey: 'public/courses/c1/cover/a.jpg',
    description: 'M'.repeat(240),
    priceVnd: 499_000,
    categoryId: 'category-1',
    learningOutcomes: ['Hiểu và áp dụng nền tảng'],
    sections: [{ id: 'section-1', lessons: [lesson()] }],
    ...overrides,
  };
}

describe('publishIssues', () => {
  it('passes a complete course', () => {
    expect(publishIssues(publishable())).toEqual([]);
  });

  it('reports a missing cover image', () => {
    expect(publishIssues(publishable({ coverImageKey: null }))).toContainEqual({
      field: 'coverImageKey',
      reason: 'MISSING',
    });
  });

  it('separates an empty description from a short one', () => {
    expect(publishIssues(publishable({ description: '   ' }))).toContainEqual({
      field: 'description',
      reason: 'MISSING',
    });
    expect(publishIssues(publishable({ description: 'ngắn' }))).toContainEqual({
      field: 'description',
      reason: 'TOO_SHORT',
    });
  });

  it.each([0, -1])('rejects priceVnd=%i', (priceVnd) => {
    expect(publishIssues(publishable({ priceVnd }))).toContainEqual({
      field: 'priceVnd',
      reason: 'MISSING',
    });
  });

  it('reports a course with no section', () => {
    expect(publishIssues(publishable({ sections: [] }))).toContainEqual({
      field: 'sections',
      reason: 'EMPTY',
    });
  });

  it('names the empty section', () => {
    const issues = publishIssues(
      publishable({ sections: [{ id: 'section-9', lessons: [] }] }),
    );
    expect(issues).toContainEqual({
      field: 'lessons',
      reason: 'EMPTY',
      lessonId: 'section-9',
    });
  });

  it('blocks a video lesson whose asset is not ready yet', () => {
    const issues = publishIssues(
      publishable({
        sections: [
          {
            id: 'section-1',
            lessons: [lesson({ id: 'lesson-7', videoReady: false })],
          },
        ],
      }),
    );
    expect(issues).toContainEqual({
      field: 'videoAsset',
      reason: 'NOT_READY',
      lessonId: 'lesson-7',
    });
  });

  it('blocks a video lesson with no asset attached', () => {
    const issues = publishIssues(
      publishable({
        sections: [
          {
            id: 'section-1',
            lessons: [lesson({ id: 'lesson-3', videoAssetId: null })],
          },
        ],
      }),
    );
    expect(issues).toContainEqual({
      field: 'videoAsset',
      reason: 'MISSING',
      lessonId: 'lesson-3',
    });
  });

  it('blocks an article lesson with no content', () => {
    const issues = publishIssues(
      publishable({
        sections: [
          {
            id: 'section-1',
            lessons: [
              lesson({
                id: 'lesson-4',
                type: LessonType.ARTICLE,
                videoAssetId: null,
                content: '  ',
              }),
            ],
          },
        ],
      }),
    );
    expect(issues).toContainEqual({
      field: 'lessons',
      reason: 'MISSING',
      lessonId: 'lesson-4',
    });
  });

  it('requires at least one preview lesson', () => {
    const issues = publishIssues(
      publishable({
        sections: [{ id: 'section-1', lessons: [lesson({ isPreview: false })] }],
      }),
    );
    expect(issues).toContainEqual({
      field: 'previewLesson',
      reason: 'MISSING',
    });
  });

  it('reports every reason in one pass instead of one per attempt', () => {
    const issues = publishIssues({
      coverImageKey: null,
      description: '',
      priceVnd: 0,
      categoryId: null,
      learningOutcomes: [],
      sections: [],
    });
    expect(issues.map((issue) => issue.field)).toEqual([
      'coverImageKey',
      'description',
      'priceVnd',
      'categoryId',
      'learningOutcomes',
      'sections',
      'previewLesson',
    ]);
  });
});
