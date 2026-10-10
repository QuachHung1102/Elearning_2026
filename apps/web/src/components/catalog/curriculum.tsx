import { ChevronDown, CirclePlay, FileText, Lock } from "lucide-react";
import Link from "next/link";
import type { SectionOutline } from "@/lib/catalog";
import { formatDuration, formatNumber } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { PreviewDialog } from "./preview-dialog";

function lessonLabel(durationSeconds: number): string {
  return durationSeconds === 0 ? "Bài đọc" : formatDuration(durationSeconds);
}

/**
 * A locked lesson is a `<span aria-disabled>`, never a dead link — a link that
 * goes nowhere is worse than no link.
 */
function LessonRow({
  lesson,
  courseSlug,
}: {
  lesson: SectionOutline["lessons"][number];
  courseSlug: string;
}) {
  const Icon =
    lesson.type === "ARTICLE" ? FileText : lesson.isPreview ? CirclePlay : Lock;
  const body = (
    <>
      <Icon
        aria-hidden="true"
        className={`size-5 shrink-0 ${lesson.isPreview ? "text-primary-text" : "text-muted-foreground"}`}
        strokeWidth={1.75}
      />
      <span className="flex-1">{lesson.title}</span>
      {lesson.isPreview && <Badge variant="info">Học thử</Badge>}
      <span className="text-sm text-muted-foreground">
        {lessonLabel(lesson.durationSeconds)}
      </span>
    </>
  );

  const href = `/learn/${courseSlug}/${lesson.id}`;
  const linkClass =
    "flex min-h-11 items-center gap-3 rounded-md px-4 py-2 hover:bg-muted";

  return (
    <li>
      {lesson.isPreview && lesson.type === "VIDEO" ? (
        <PreviewDialog
          href={href}
          lessonId={lesson.id}
          title={lesson.title}
          className={linkClass}
        >
          {body}
        </PreviewDialog>
      ) : lesson.isPreview ? (
        <Link href={href} className={linkClass}>
          {body}
        </Link>
      ) : (
        <span
          aria-disabled="true"
          className="flex min-h-11 items-center gap-3 px-4 py-2 text-muted-foreground-strong"
        >
          {body}
        </span>
      )}
    </li>
  );
}

/** Native `<details>`: open, close and keyboard support with no accordion library. */
export function CurriculumAccordion({
  sections,
  courseSlug,
}: {
  sections: SectionOutline[];
  courseSlug: string;
}) {
  const lessons = sections.reduce(
    (total, section) => total + section.lessons.length,
    0,
  );
  return (
    <section className="grid gap-4" aria-labelledby="curriculum-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="curriculum-heading" className="text-2xl font-semibold">
          Nội dung khóa học
        </h2>
        <p className="text-sm text-muted-foreground">
          {formatNumber(sections.length)} chương · {formatNumber(lessons)} bài
          học
        </p>
      </div>
      <div className="grid gap-2">
        {sections.map((section, index) => (
          <details
            key={section.id}
            className="panel overflow-hidden"
            open={index === 0}
          >
            <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 py-3 font-semibold hover:bg-muted">
              <ChevronDown
                aria-hidden="true"
                className="size-5 shrink-0 transition-transform duration-[var(--duration-fast)] group-open:rotate-180"
                strokeWidth={1.75}
              />
              <span className="flex-1">{section.title}</span>
              <span className="text-sm font-normal text-muted-foreground">
                {formatNumber(section.lessons.length)} bài
              </span>
            </summary>
            <ul className="list-none border-t border-border p-1">
              {section.lessons.map((lesson) => (
                <LessonRow
                  key={lesson.id}
                  lesson={lesson}
                  courseSlug={courseSlug}
                />
              ))}
            </ul>
          </details>
        ))}
      </div>
    </section>
  );
}
