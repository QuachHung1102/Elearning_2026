import { ProgressBar } from "@/components/learning/progress-bar";
import type { AdminEnrollment } from "@/lib/admin";
import { formatNumber } from "@/lib/format";

/** "8/12 bài · 67%" with a bar; the API sends `progress` only on the list. */
export function EnrollmentProgress({
  enrollment,
}: {
  enrollment: AdminEnrollment;
}) {
  const progress = enrollment.progress;
  if (!progress) return <span className="text-muted-foreground">—</span>;
  const text = `${formatNumber(progress.completedLessons)}/${formatNumber(progress.totalLessons)} bài · ${progress.percent}%`;
  return (
    <div className="grid min-w-32 gap-1">
      <span className="text-sm tabular-nums">{text}</span>
      <ProgressBar
        percent={progress.percent}
        label={`Tiến độ của ${enrollment.user.displayName} ở ${enrollment.course.title}`}
        valueText={text}
      />
    </div>
  );
}
