"use client";

import {
  ChevronDown,
  Circle,
  CircleCheck,
  CirclePlay,
  FileText,
  Lock,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { SectionOutline } from "@/lib/catalog";
import { formatDuration, formatNumber } from "@/lib/format";
import type { LearnMode } from "@/lib/learning";

const lessonLength = (seconds: number) =>
  seconds === 0 ? "Bài đọc" : formatDuration(seconds);

/**
 * `CurriculumAccordion` `player` (UX_PLAN.md §8.5): disclosure buttons over
 * nested lists, never `role="tree"`. The current lesson comes from the URL,
 * because this lives in the player layout, which stays mounted while the
 * learner moves between lessons.
 */
export function PlayerCurriculum({
  sections,
  courseSlug,
  completedLessonIds,
  mode,
  idPrefix,
  onPick,
}: {
  sections: SectionOutline[];
  courseSlug: string;
  completedLessonIds: string[];
  mode: LearnMode;
  /** The sidebar and the drawer both render one; ids must not collide. */
  idPrefix: string;
  onPick?: () => void;
}) {
  const currentId = usePathname().split("/")[3];
  const currentSection = sections.find((section) =>
    section.lessons.some((lesson) => lesson.id === currentId),
  )?.id;
  // What the learner toggled by hand; everything else follows the URL: the
  // current lesson's section is open, the rest closed.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const isOpen = (id: string) =>
    toggled[id] ?? id === (currentSection ?? sections[0]?.id);
  const current = useRef<HTMLAnchorElement>(null);
  const completed = new Set(completedLessonIds);

  // Bring the current lesson into view inside the sidebar's own scroll box —
  // never scrolling the page.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const row = current.current;
      const box = row?.closest<HTMLElement>("[data-scroll-box]");
      if (!row || !box) return;
      const offset =
        row.getBoundingClientRect().top - box.getBoundingClientRect().top;
      if (offset < 0 || offset > box.clientHeight - row.offsetHeight) {
        box.scrollTop += offset - box.clientHeight / 3;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [currentId]);

  return (
    <nav aria-label="Chương trình học">
      <ol className="grid list-none gap-1 p-0">
        {sections.map((section) => {
          const expanded = isOpen(section.id);
          const listId = `${idPrefix}-section-${section.id}`;
          const seconds = section.lessons.reduce(
            (sum, lesson) => sum + lesson.durationSeconds,
            0,
          );
          return (
            <li key={section.id} className="border-b border-border">
              <h3 className="text-base">
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={listId}
                  onClick={() =>
                    setToggled((previous) => ({
                      ...previous,
                      [section.id]: !expanded,
                    }))
                  }
                  className="flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left font-semibold hover:bg-muted"
                >
                  <span className="flex-1">
                    {section.title}
                    <span className="block text-sm font-normal text-muted-foreground">
                      {formatNumber(section.lessons.length)} bài học
                      {seconds > 0 && ` · ${formatDuration(seconds)}`}
                    </span>
                  </span>
                  <ChevronDown
                    aria-hidden="true"
                    className={`size-5 shrink-0 transition-transform duration-[var(--duration-fast)] ${expanded ? "rotate-180" : ""}`}
                    strokeWidth={1.75}
                  />
                </button>
              </h3>
              <ol
                id={listId}
                hidden={!expanded}
                className="list-none px-1 pb-2"
              >
                {section.lessons.map((lesson) => {
                  const isCurrent = lesson.id === currentId;
                  const isDone = completed.has(lesson.id);
                  const locked = mode === "PREVIEW" && !lesson.isPreview;
                  const Icon = locked
                    ? Lock
                    : isCurrent
                      ? CirclePlay
                      : isDone
                        ? CircleCheck
                        : lesson.type === "ARTICLE"
                          ? FileText
                          : Circle;
                  const body = (
                    <>
                      <Icon
                        aria-hidden="true"
                        className={`mt-0.5 size-5 shrink-0 ${isDone || isCurrent ? "text-primary-text" : "text-muted-foreground"}`}
                        strokeWidth={1.75}
                      />
                      <span className="grid flex-1 gap-0.5">
                        <span className={isCurrent ? "font-semibold" : ""}>
                          {lesson.title}
                        </span>
                        <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          {lessonLength(lesson.durationSeconds)}
                          {lesson.isPreview && (
                            <Badge variant="info">Học thử</Badge>
                          )}
                        </span>
                      </span>
                      {isDone && <span className="sr-only">Đã hoàn thành</span>}
                    </>
                  );
                  const rowClass = `flex min-h-11 items-start gap-3 rounded-md border-l-[3px] px-3 py-2 ${isCurrent ? "border-primary bg-primary-subtle/60" : "border-transparent"}`;
                  return (
                    <li key={lesson.id}>
                      {locked ? (
                        <span
                          aria-disabled="true"
                          className={`${rowClass} text-muted-foreground-strong`}
                        >
                          {body}
                          <span className="sr-only">(chưa có quyền học)</span>
                        </span>
                      ) : (
                        <Link
                          ref={isCurrent ? current : undefined}
                          href={`/learn/${courseSlug}/${lesson.id}`}
                          scroll={false}
                          aria-current={isCurrent ? "page" : undefined}
                          onClick={onPick}
                          className={`${rowClass} hover:bg-muted`}
                        >
                          {body}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ol>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
