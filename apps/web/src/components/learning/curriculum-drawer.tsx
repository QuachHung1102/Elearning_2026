"use client";

import { ListVideo, X } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { buttonClass } from "@/components/ui/button";
import type { SectionOutline } from "@/lib/catalog";
import type { LearnMode } from "@/lib/learning";
import { PlayerCurriculum } from "./player-curriculum";

/**
 * The curriculum below 1024px (UX_PLAN.md §7.2): a native modal `<dialog>`,
 * so focus trapping, Escape and an inert page come from the browser. A bottom
 * sheet at 85dvh under 768px, a 360px right panel from 768px. Picking a lesson
 * closes it; the route announcer then moves focus to the new lesson title.
 */
export function CurriculumDrawer({
  sections,
  courseSlug,
  completedLessonIds,
  mode,
  progress,
}: {
  sections: SectionOutline[];
  courseSlug: string;
  completedLessonIds: string[];
  mode: LearnMode;
  progress?: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = () => dialog.current?.close();

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => {
          dialog.current?.showModal();
          dialog.current
            ?.querySelector('[aria-current="page"]')
            ?.scrollIntoView({ block: "center" });
        }}
        className={buttonClass("ghost", "sm", "lg:hidden")}
      >
        <ListVideo aria-hidden="true" className="size-5" strokeWidth={1.75} />
        <span className="sr-only md:not-sr-only">Nội dung khóa học</span>
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="curriculum-drawer-title"
        className="fixed inset-x-0 top-auto bottom-0 m-0 h-[85dvh] max-h-none w-full max-w-none overflow-hidden rounded-t-xl bg-card p-0 text-card-foreground shadow-[var(--shadow-modal)] backdrop:bg-overlay md:inset-y-0 md:right-0 md:left-auto md:h-dvh md:w-[360px] md:rounded-none lg:hidden"
      >
        <div className="flex h-full flex-col">
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
              <h2
                id="curriculum-drawer-title"
                className="text-lg font-semibold"
              >
                Nội dung khóa học
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="Đóng"
                className={buttonClass("ghost", "sm")}
              >
                <X aria-hidden="true" className="size-5" strokeWidth={1.75} />
              </button>
            </div>
            {progress && (
              <div className="border-b border-border px-4 py-3">{progress}</div>
            )}
            <div data-scroll-box className="flex-1 overflow-y-auto">
              <PlayerCurriculum
                sections={sections}
                courseSlug={courseSlug}
                completedLessonIds={completedLessonIds}
                mode={mode}
                idPrefix="drawer"
                onPick={close}
              />
            </div>
        </div>
      </dialog>
    </>
  );
}
