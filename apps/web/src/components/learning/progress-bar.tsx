/** `ProgressBar` `bar` (UX_PLAN.md §4.6): `sm` 4px, `md` 8px. */
export function ProgressBar({
  percent,
  label,
  valueText,
  size = "sm",
}: {
  percent: number;
  /** Names the bar for assistive tech, e.g. the course title. */
  label: string;
  valueText: string;
  size?: "sm" | "md";
}) {
  const value = Math.min(100, Math.max(0, Math.round(percent)));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      aria-valuetext={valueText}
      className={`w-full overflow-hidden rounded-full bg-muted ${size === "md" ? "h-2" : "h-1"}`}
    >
      <div
        className="h-full rounded-full bg-primary-strong transition-[width] duration-[var(--duration-base)] motion-reduce:transition-none"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}
