"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/** A `loading.tsx` skeleton marks itself busy; buttons do too while saving. */
const LOADING = '#main [aria-busy="true"]:not(button)';
const MAX_WAIT_MS = 10_000;
const LESSON = /^\/learn\/([^/]+)\/[^/]+$/;

/**
 * Lesson to lesson in one course keeps the scroll position, so the player
 * does not jump away (UX_PLAN.md §8.3 item 4); focus still moves to the title.
 */
function sameCourseLesson(from: string | null, to: string): boolean {
  const course = LESSON.exec(to)?.[1];
  return course !== undefined && LESSON.exec(from ?? "")?.[1] === course;
}

export function RouteAnnouncer() {
  const pathname = usePathname();
  const live = useRef<HTMLParagraphElement>(null);
  const previous = useRef<string | null>(null);
  // Where the reader was when they clicked. The loading skeleton is shorter
  // than a lesson, so by the time the new page renders the browser has
  // already clamped the scroll; this is what gets restored. Back / Forward
  // clears it, so the browser's own restoration wins there.
  const scrollAtClick = useRef<number | null>(null);

  useEffect(() => {
    const remember = () => {
      scrollAtClick.current = window.scrollY;
    };
    const forget = () => {
      scrollAtClick.current = null;
    };
    document.addEventListener("click", remember, true);
    window.addEventListener("popstate", forget);
    return () => {
      document.removeEventListener("click", remember, true);
      window.removeEventListener("popstate", forget);
    };
  }, []);

  useEffect(() => {
    const started = performance.now();
    const sameCourse = sameCourseLesson(previous.current, pathname);
    const restoreTo = scrollAtClick.current;
    scrollAtClick.current = null;
    previous.current = pathname;
    let frame = 0;
    const settle = () => {
      // Focusing during the skeleton would land on #main and announce
      // "Đang tải…"; wait for the real page and its h1 instead.
      if (
        document.querySelector(LOADING) &&
        performance.now() - started < MAX_WAIT_MS
      ) {
        frame = window.requestAnimationFrame(settle);
        return;
      }
      const target =
        document.querySelector<HTMLElement>("main h1") ??
        document.querySelector<HTMLElement>("#main");
      target?.focus({ preventScroll: true });
      if (!sameCourse) window.scrollTo({ top: 0, behavior: "instant" });
      else if (restoreTo !== null) {
        window.scrollTo({ top: restoreTo, behavior: "instant" });
      }
      if (live.current) {
        live.current.textContent = `Đã tới ${target?.textContent?.trim() ?? "trang mới"}`;
      }
    };
    frame = window.requestAnimationFrame(settle);
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  return <p ref={live} className="sr-only" aria-live="assertive" />;
}
