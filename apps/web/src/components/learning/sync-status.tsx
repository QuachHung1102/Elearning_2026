"use client";

import { CloudOff } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/feedback";
import { showToast } from "@/components/ui/toast";
import { isUnsynced, onProgressSync } from "@/lib/progress-sync";

/**
 * "Chưa đồng bộ tiến độ" next to the progress bar while a save is waiting
 * (UX_PLAN.md §6.3), and the one "Đã đồng bộ tiến độ." toast when it lands.
 * Also the one place that refreshes the server-rendered shell when a save
 * changes completion, so the curriculum ticks and the bar stay true.
 */
export function SyncChip({
  announce = false,
  compact = false,
  completedLessons,
}: {
  /** Exactly one chip on the page toasts and refreshes. */
  announce?: boolean;
  /** Icon only below 640px, so the header keeps room for the course title. */
  compact?: boolean;
  /** What the server rendered; a save that changes it refreshes the shell. */
  completedLessons: number;
}) {
  const router = useRouter();
  const [unsynced, setUnsynced] = useState(isUnsynced);

  useEffect(
    () =>
      onProgressSync((event) => {
        if (event.type === "status") {
          setUnsynced(event.unsynced);
          // A dropped save (revoked access, expired session) clears the chip
          // but did not sync anything.
          if (announce && !event.unsynced && !event.dropped) {
            showToast("Đã đồng bộ tiến độ.", "success");
          }
        }
        if (
          announce &&
          event.type === "saved" &&
          event.result.courseProgress.completedLessons !== completedLessons
        ) {
          router.refresh();
        }
      }),
    [announce, completedLessons, router],
  );

  // The live region stays mounted so the chip appearing is announced.
  return (
    <span role="status">
      {unsynced && (
        <span className="inline-flex items-center gap-1 rounded-full bg-warning-subtle px-2 py-0.5 text-xs font-medium text-on-warning-subtle">
          <CloudOff aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
          <span className={compact ? "max-sm:sr-only" : ""}>
            Chưa đồng bộ tiến độ
          </span>
        </span>
      )}
    </span>
  );
}

/**
 * Warning while the browser is offline; buffered video keeps playing. Sticky
 * under the header only from 768px: below that the video itself is sticky,
 * and a sticky banner would cover it. The offset is the header height: 65px,
 * plus the 4px course bar a tracked learner sees from 768 to 1023px.
 */
export function OfflineBanner({ tracked }: { tracked: boolean }) {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return offline ? (
    <div
      className={`z-20 px-4 pt-2 md:sticky ${tracked ? "md:top-[69px] lg:top-[65px]" : "md:top-[65px]"}`}
    >
      <Alert
        variant="warning"
        title="Mất kết nối mạng. Tiến độ sẽ được lưu khi có mạng trở lại."
      />
    </div>
  ) : null;
}

/**
 * `/learn/{slug}` sends a learner who has finished everything to the last
 * lesson with `?completed=1`; say so once, then drop the flag from the URL so
 * a reload does not repeat it. Read inside a `<Suspense>` the page provides.
 */
export function CourseCompletedToast() {
  const router = useRouter();
  const params = useSearchParams();
  const completed = params.get("completed") === "1";
  // Development re-runs effects once more; the toast must still be one.
  const shown = useRef(false);

  useEffect(() => {
    if (!completed || shown.current) return;
    shown.current = true;
    showToast("Bạn đã hoàn thành khóa học này.", "success");
    router.replace(window.location.pathname, { scroll: false });
  }, [completed, router]);

  return null;
}
