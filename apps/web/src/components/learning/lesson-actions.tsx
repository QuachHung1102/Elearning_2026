"use client";

import { ChevronLeft, ChevronRight, CircleCheck, Circle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { showToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import type { LearnMode } from "@/lib/learning";
import {
  onProgressSync,
  queueProgress,
  saveProgressNow,
} from "@/lib/progress-sync";
import { t } from "@/messages/vi";

type NavLink = { href: string; title: string } | null;

function navItem(link: NavLink, direction: "prev" | "next") {
  const label = direction === "prev" ? "Trước" : "Sau";
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  const icon = <Icon aria-hidden="true" className="size-5" strokeWidth={1.75} />;
  const body = (
    <>
      {direction === "prev" && icon}
      {label}
      {direction === "next" && icon}
    </>
  );
  if (!link) {
    return (
      <span
        aria-disabled="true"
        className={buttonClass("outline", "lg", "flex-1 opacity-60")}
      >
        {body}
      </span>
    );
  }
  return (
    <Link
      href={link.href}
      scroll={false}
      className={buttonClass("outline", "lg", "flex-1")}
    >
      {body}
      <span className="sr-only">: {link.title}</span>
    </Link>
  );
}

/** `LessonNav` Trước / Sau; `scroll={false}` keeps the player where it is. */
export function LessonNav({
  prev,
  next,
  className = "",
}: {
  prev: NavLink;
  next: NavLink;
  className?: string;
}) {
  return (
    <nav aria-label="Chuyển bài học" className={`flex gap-3 ${className}`}>
      {navItem(prev, "prev")}
      {navItem(next, "next")}
    </nav>
  );
}

/**
 * `CompleteToggle` and the page's primary CTA (UX_PLAN.md §3.3, §7.2): in the
 * flow right under the video (or an article's title) from 1024px; under that a
 * bar fixed to the bottom, the CTA with a square toggle (or the full toggle)
 * first, Trước / Sau under it. It wraps the lesson content so the bar comes
 * after it in the DOM and in Tab order.
 *
 * The toggle is optimistic; it rolls back only on a final failure. The player's
 * auto-complete arrives through the progress queue and flips it too.
 */
export function LessonActions({
  lessonId,
  mode,
  initiallyCompleted,
  prev,
  next,
  before,
  children,
}: {
  lessonId: string;
  mode: LearnMode;
  initiallyCompleted: boolean;
  prev: NavLink;
  next: NavLink;
  /** Rendered ahead of the in-flow actions (an article's title). */
  before?: ReactNode;
  /** The lesson content; the fixed bar under 1024px comes after it. */
  children: ReactNode;
}) {
  const router = useRouter();
  const [completed, setCompleted] = useState(initiallyCompleted);
  const [pending, setPending] = useState<"toggle" | "advance" | null>(null);
  const tracked = mode === "ENROLLED";

  useEffect(
    () =>
      onProgressSync((event) => {
        if (event.type === "saved" && event.lessonId === lessonId) {
          setCompleted(event.result.progress.completedAt !== null);
        }
      }),
    [lessonId],
  );

  async function mark(value: boolean) {
    // Position 0 never lowers the stored one (the server keeps the maximum).
    return saveProgressNow(lessonId, {
      lastPositionSeconds: 0,
      completed: value,
    });
  }

  /**
   * A 429, an outage or no network is a save that has to wait, not an error
   * (UX_PLAN.md §4.6): the choice stays on screen and goes into the progress
   * queue, which shows the "Chưa đồng bộ tiến độ" chip and retries. Returns
   * false when the failure is final.
   */
  function deferred(caught: unknown, value: boolean) {
    const status = caught instanceof ApiError ? caught.status : 0;
    if (status !== 0 && status !== 429 && status < 500) return false;
    queueProgress(lessonId, { lastPositionSeconds: 0, completed: value });
    return true;
  }

  function failed(caught: unknown) {
    const code = caught instanceof ApiError ? caught.code : "INTERNAL";
    // The session-expired toast already speaks for a 401.
    if (code !== "UNAUTHENTICATED") showToast(t(code), "error");
  }

  async function toggle() {
    const value = !completed;
    setCompleted(value);
    setPending("toggle");
    try {
      await mark(value);
      router.refresh();
    } catch (caught) {
      if (deferred(caught, value)) return;
      setCompleted(!value);
      failed(caught);
    } finally {
      setPending(null);
    }
  }

  async function advance() {
    if (!next) return;
    setPending("advance");
    try {
      await mark(true);
    } catch (caught) {
      if (!deferred(caught, true)) {
        failed(caught);
        setPending(null);
        return;
      }
    }
    setCompleted(true);
    router.push(next.href, { scroll: false });
    router.refresh();
  }

  // `compact` is the square toggle beside the CTA under 1024px. It is the
  // same element as the full toggle, so marking or un-marking never unmounts
  // the focused control (UX_PLAN.md §8.3).
  const toggleButton = (compact: boolean) =>
    tracked && (
      <Button
        variant={compact ? "outline" : completed ? "outline" : "primary"}
        size="lg"
        // The name says what a press does next; the text alone would read
        // "Đã hoàn thành" and hide that pressing it un-marks the lesson.
        aria-label={
          completed
            ? "Đã hoàn thành, bấm để bỏ đánh dấu"
            : compact
              ? "Đánh dấu hoàn thành"
              : undefined
        }
        loading={pending === "toggle"}
        onClick={toggle}
        className={compact ? "w-12 px-0" : "min-w-0 flex-1 lg:flex-none"}
      >
        {compact && pending === "toggle" ? null : completed ? (
          <CircleCheck aria-hidden="true" className="size-5 text-primary-text" strokeWidth={1.75} />
        ) : (
          <Circle aria-hidden="true" className="size-5" strokeWidth={1.75} />
        )}
        {!compact && (
          <span className="truncate">
            {completed ? "Đã hoàn thành" : "Đánh dấu hoàn thành"}
          </span>
        )}
      </Button>
    );

  const advanceButton = tracked && next && !completed && (
    <Button
      variant="accent"
      size="lg"
      loading={pending === "advance"}
      onClick={advance}
      className="min-w-0 flex-1 lg:flex-none"
    >
      <span className="truncate">Đánh dấu hoàn thành và học tiếp</span>
      <ChevronRight aria-hidden="true" className="size-5" strokeWidth={1.75} />
    </Button>
  );

  return (
    <>
      {before}
      {tracked && (
        <div className="hidden flex-wrap items-center gap-3 lg:flex">
          {toggleButton(false)}
          {advanceButton}
        </div>
      )}
      {children}
      {/* After the lesson content in the DOM, so Tab reaches the text and
          resources before the bar pinned to the bottom of the screen. */}
      <div className="fixed inset-x-0 bottom-0 z-20 grid gap-2 border-t border-border bg-card p-2 lg:hidden">
        {tracked && (
          // One row: the primary CTA plus a square toggle while there is a
          // next lesson to go to, otherwise the full toggle. Both slots keep
          // their position, so the toggle is never remounted.
          <div className="flex gap-2">
            {advanceButton}
            {toggleButton(Boolean(advanceButton))}
          </div>
        )}
        <nav aria-label="Chuyển bài học" className="flex gap-2">
          {navItem(prev, "prev")}
          {navItem(next, "next")}
        </nav>
      </div>
    </>
  );
}
