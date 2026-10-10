import { FileText } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Prose } from "@/components/catalog/sections";
import { LessonActions, LessonNav } from "@/components/learning/lesson-actions";
import { LessonBody } from "@/components/learning/lesson-body";
import { CourseCompletedToast } from "@/components/learning/sync-status";
import { VideoPlayer } from "@/components/learning/video-player";
import { EmptyState } from "@/components/ui/feedback";
import { requireAuth } from "@/lib/api";
import { formatDuration } from "@/lib/format";
import { orderedLessons, type LessonContent } from "@/lib/learning";
import { serverFetch } from "@/lib/session";
import { getLearnContext } from "../context";

type Params = Promise<{ courseSlug: string; lessonId: string }>;

async function loadLesson(courseSlug: string, lessonId: string) {
  const response = await serverFetch(
    `/lessons/${encodeURIComponent(lessonId)}/content`,
  );
  // A malformed id is a page that does not exist, not a server fault.
  if (response.status === 400) notFound();
  await requireAuth(response, `/learn/${courseSlug}/${lessonId}`, courseSlug);
  if (!response.ok) {
    throw new Error(`GET /lessons/${lessonId}/content answered ${response.status}`);
  }
  return (await response.json()) as LessonContent;
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { courseSlug, lessonId } = await params;
  const { shell } = await getLearnContext(courseSlug);
  const lesson = orderedLessons(shell.course.sections).find(
    ({ id }) => id === lessonId,
  );
  return { title: lesson ? `${lesson.title} · ${shell.course.title}` : shell.course.title };
}

/** `/learn/[courseSlug]/[lessonId]` (UX_PLAN.md §3.3, §7.2). */
export default async function LessonPage({ params }: { params: Params }) {
  const { courseSlug, lessonId } = await params;
  const [{ shell, mode }, lesson] = await Promise.all([
    getLearnContext(courseSlug),
    loadLesson(courseSlug, lessonId),
  ]);
  // A lesson id from another course under this slug is not a page here.
  if (lesson.courseId !== shell.course.id) notFound();

  const lessons = orderedLessons(shell.course.sections);
  const section = shell.course.sections.find(({ id }) => id === lesson.sectionId);
  const link = (id: string | null) => {
    const target = lessons.find((item) => item.id === id);
    return target
      ? { href: `/learn/${courseSlug}/${target.id}`, title: target.title }
      : null;
  };
  // A preview visitor only steps between the other "Học thử" lessons; the
  // locked ones would bounce them to the course page.
  const open = lessons.filter(({ isPreview }) => isPreview);
  const step = (offset: number) =>
    open[open.findIndex(({ id }) => id === lesson.id) + offset]?.id ?? null;
  const preview = mode === "PREVIEW";
  const prev = link(preview ? step(-1) : lesson.prevLessonId);
  const next = link(preview ? step(1) : lesson.nextLessonId);
  const tracked = mode === "ENROLLED";
  const completed = shell.completedLessonIds.includes(lesson.id);
  const isArticle = lesson.type === "ARTICLE" || !lesson.hasVideo;

  const header = (
    <header className="grid gap-2">
      <p className="text-sm text-muted-foreground">
        {section?.title}
        {" · "}
        {isArticle ? "Bài đọc" : formatDuration(lesson.durationSeconds)}
      </p>
      <h1 tabIndex={-1} className="text-2xl font-semibold lg:text-3xl">
        {lesson.title}
      </h1>
    </header>
  );

  return (
    <article className={`flex flex-col lg:pb-12 ${tracked ? "pb-36" : "pb-24"}`}>
      <Suspense fallback={null}>
        <CourseCompletedToast />
      </Suspense>
      {!isArticle && (
        <VideoPlayer
          key={lesson.id}
          lessonId={lesson.id}
          track={tracked}
          initialPosition={lesson.progress?.lastPositionSeconds ?? null}
          initiallyCompleted={completed}
        />
      )}
      <div className="flex flex-col gap-6 px-4 pt-6 md:px-6 lg:max-w-[964px] lg:px-8 xl:max-w-[1064px]">
        {/* Right under the video (UX_PLAN.md §7.2); an article has none, so
            after its title. Under 1024px a fixed bottom bar after the content. */}
        <LessonActions
          key={lesson.id}
          lessonId={lesson.id}
          mode={mode}
          initiallyCompleted={completed}
          prev={prev}
          next={next}
          before={isArticle ? header : undefined}
        >
          {!isArticle && header}
          <LessonBody
            lessonId={lesson.id}
            resources={lesson.resources}
            content={
              lesson.content?.trim() ? (
                <Prose source={lesson.content} />
              ) : (
                <EmptyState
                  icon={FileText}
                  title={isArticle ? "Bài đọc này chưa có nội dung" : "Bài này chỉ có video"}
                  description={isArticle ? undefined : "Nội dung bài học nằm trong video ở phía trên."}
                />
              )
            }
          />
        </LessonActions>
        <LessonNav prev={prev} next={next} className="hidden lg:flex" />
      </div>
    </article>
  );
}
