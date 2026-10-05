"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, type ReactNode } from "react";
import { VideoPlayer } from "@/components/learning/video-player";
import { whoAmI } from "@/lib/viewer";

/**
 * `PreviewDialog` (UX_PLAN.md, `Dialog` + `VideoPlayer`): a "Học thử" video plays in a modal on the
 * course page instead of the learning player. The native modal `<dialog>`
 * traps focus, closes on Escape and hands focus back to the row.
 *
 * Still a real link: a new tab or no JavaScript opens `/learn/...`, and so
 * does a guest, since a playback token needs a session — that route sends
 * them to sign in and back.
 */
export function PreviewDialog({
  href,
  lessonId,
  title,
  className,
  children,
}: {
  href: string;
  lessonId: string;
  title: string;
  className: string;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const titleId = useId();
  // The player mounts only while open, so closing stops the video.
  const [open, setOpen] = useState(false);

  return (
    <>
      <Link
        href={href}
        className={className}
        aria-haspopup="dialog"
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
            return;
          }
          event.preventDefault();
          void whoAmI().then((user) => {
            if (!user) {
              router.push(href);
              return;
            }
            setOpen(true);
            dialog.current?.showModal();
          });
        }}
      >
        {children}
      </Link>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="m-auto w-[calc(100%-2rem)] max-w-3xl overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-[var(--shadow-modal)] backdrop:bg-overlay"
        onClose={() => setOpen(false)}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-4">
          <div className="grid gap-1">
            <p className="text-sm font-semibold text-primary-text">Học thử</p>
            <h2
              id={titleId}
              className="text-xl font-semibold [overflow-wrap:anywhere]"
            >
              {title}
            </h2>
          </div>
          <form method="dialog">
            <button
              type="submit"
              aria-label="Đóng"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md hover:bg-muted"
            >
              <X aria-hidden="true" className="size-5" strokeWidth={1.75} />
            </button>
          </form>
        </div>
        {open && (
          // The player insets itself by 2rem from `lg`; match it below.
          <div className="lg:pb-8">
            <VideoPlayer
              lessonId={lessonId}
              track={false}
              initialPosition={null}
              initiallyCompleted={false}
            />
          </div>
        )}
      </dialog>
    </>
  );
}
