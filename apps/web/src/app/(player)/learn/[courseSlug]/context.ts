import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import type { CourseDetail, Paginated } from "@/lib/catalog";
import type { EnrollmentItem, LearnMode, LearnShell } from "@/lib/learning";
import { getSession, serverFetch } from "@/lib/session";

export type LearnContext = {
  shell: LearnShell;
  mode: LearnMode;
};

/**
 * `GET /learn/{slug}` once per request, shared by the layout and the pages
 * under it (`cache` dedupes within one render).
 *
 * `/learn/{slug}` has no preview mode, but the public curriculum links its
 * "Học thử" lessons here. So a signed-in learner without access gets the
 * public outline in `PREVIEW` mode: the lesson page then asks the API, which
 * serves only preview lessons and sends everything else back with
 * `NOT_ENROLLED` → `/courses/{slug}?denied=1`.
 */
export const getLearnContext = cache(
  async (slug: string): Promise<LearnContext> => {
    // Back to the lesson that was open (proxy.ts sets the path), not just the
    // course, so a stale session re-logs in to the same place.
    const path = (await headers()).get("x-elearning-path");
    const base = `/learn/${slug}`;
    const next =
      path && /^[/?]?$/.test(path.charAt(base.length)) && path.startsWith(base)
        ? path
        : base;
    const user = await getSession();
    if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);

    const response = await serverFetch(`/learn/${encodeURIComponent(slug)}`);
    if (response.status === 401) {
      redirect(`/login?next=${encodeURIComponent(next)}`);
    }
    if (response.status === 404 || response.status === 400) notFound();
    if (response.status === 403) {
      const outline = await serverFetch(`/courses/${encodeURIComponent(slug)}`);
      if (!outline.ok) redirect(`/courses/${slug}?denied=1`);
      const course = (await outline.json()) as CourseDetail;
      const total = course.sections.reduce(
        (sum, section) => sum + section.lessons.length,
        0,
      );
      return {
        mode: "PREVIEW",
        shell: {
          course: { ...course, status: "PUBLISHED" },
          progress: { completedLessons: 0, totalLessons: total, percent: 0 },
          completedLessonIds: [],
          resumeLessonId: null,
        },
      };
    }
    if (!response.ok) {
      throw new Error(`GET /learn/${slug} answered ${response.status}`);
    }
    const shell = (await response.json()) as LearnShell;

    // An admin reaches every course, an instructor their own; only an ACTIVE
    // enrollment makes the visit a learner's one that records progress.
    let mode: LearnMode = "ENROLLED";
    if (user.role !== "STUDENT") {
      const mine = await serverFetch(
        `/enrollments/me?courseId=${shell.course.id}&status=ACTIVE&pageSize=1`,
      );
      const items = mine.ok
        ? ((await mine.json()) as Paginated<EnrollmentItem>).items
        : [];
      mode = items.length > 0 ? "ENROLLED" : "ADMIN";
    }
    return { shell, mode };
  },
);
