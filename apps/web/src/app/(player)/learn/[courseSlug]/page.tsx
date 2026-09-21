import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { orderedLessons } from "@/lib/learning";
import { getLearnContext } from "./context";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ courseSlug: string }>;
}): Promise<Metadata> {
  const { shell } = await getLearnContext((await params).courseSlug);
  return { title: shell.course.title };
}

/**
 * "Tiếp tục học" (API_CONTRACT.md §5.5): straight to `resumeLessonId`. A
 * learner who has finished everything lands on the last lesson, told so once.
 */
export default async function ResumePage({
  params,
}: {
  params: Promise<{ courseSlug: string }>;
}) {
  const { courseSlug } = await params;
  const { shell, mode } = await getLearnContext(courseSlug);
  // The course-level shell has no preview mode.
  if (mode === "PREVIEW") redirect(`/courses/${courseSlug}?denied=1`);

  const lessons = orderedLessons(shell.course.sections);
  if (lessons.length === 0) {
    return (
      <div className="grid gap-6 p-4 md:p-6 lg:p-8">
        <h1 tabIndex={-1} className="text-3xl font-semibold">
          {shell.course.title}
        </h1>
        <EmptyState
          title="Chương trình học đang được cập nhật"
          description="Nội dung sẽ có sớm."
          action={
            <Link href="/my-courses" className={buttonClass("outline")}>
              Khóa học của tôi
            </Link>
          }
        />
      </div>
    );
  }

  const { completedLessons, totalLessons } = shell.progress;
  if (mode === "ENROLLED" && completedLessons === totalLessons) {
    redirect(`/learn/${courseSlug}/${lessons.at(-1)!.id}?completed=1`);
  }
  redirect(`/learn/${courseSlug}/${shell.resumeLessonId ?? lessons[0].id}`);
}
