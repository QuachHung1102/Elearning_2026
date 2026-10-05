import { CourseService } from './course.service.js';

/**
 * REVIEW F-31: the public course page needs each lesson's outline, and used to
 * read every column of every lesson (the whole text of each article) to throw
 * all but six of them away.
 */
describe('the course detail query', () => {
  const OUTLINE = { id: true, title: true, position: true, type: true, durationSeconds: true, isPreview: true };

  function lessonsOf(call: unknown) {
    const { include } = call as {
      include: { sections: { include: { lessons: Record<string, unknown> } } };
    };
    return include.sections.include.lessons;
  }

  it('reads the outline of a lesson and never its text, for the public page', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const service = new CourseService({ course: { findFirst } } as never, {} as never, {} as never, {} as never);

    await service.getCourseBySlug('khoa-hoc').catch(() => undefined);

    const lessons = lessonsOf(findFirst.mock.calls[0][0]);
    expect(lessons.select).toEqual(OUTLINE);
    expect(lessons).not.toHaveProperty('include');
  });

  it('and for the learner shell', async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const service = new CourseService({ course: { findUnique } } as never, {} as never, {} as never, {} as never);

    await service.getCourseDetailForLearner('id').catch(() => undefined);

    expect(lessonsOf(findUnique.mock.calls[0][0]).select).toEqual(OUTLINE);
  });
});
