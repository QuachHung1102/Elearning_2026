/**
 * Pure rules of the lesson player (UX_PLAN.md §4.6, §8.4; DEMO_MODE.md §2).
 * No DOM here, so each rule is a node-environment spec.
 */

/** A lesson counts as watched past 95% of the playing file's real length. */
export const COMPLETE_THRESHOLD = 0.95;

/** While playing, a save every 15 s; never on `timeupdate`. */
export const SAVE_INTERVAL_MS = 15_000;

/** However many triggers fire, at most one progress request per 5 s. */
export const MIN_SAVE_GAP_MS = 5_000;

/** Refresh the playback URL this long before it expires. */
export const TOKEN_MARGIN_MS = 60_000;

export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;

/** `currentTime >= 0.95 × duration`, read from the `<video>` element. */
export function reachedCompletion(currentTime: number, duration: number): boolean {
  return (
    Number.isFinite(duration) &&
    duration > 0 &&
    currentTime >= COMPLETE_THRESHOLD * duration
  );
}

/**
 * Where to start: the saved position, unless it is within the last 10 s (or
 * past the end, after a video swap) — then from the start.
 */
export function resumeAt(saved: number | null | undefined, duration: number): number {
  if (!saved || saved <= 0 || !Number.isFinite(duration)) return 0;
  return saved < duration - 10 ? saved : 0;
}

export function tokenNeedsRefresh(expiresAt: string, now: number): boolean {
  return now > Date.parse(expiresAt) - TOKEN_MARGIN_MS;
}

/** Milliseconds to wait before the next save may go out; 0 = send now. */
export function saveDelay(lastSentAt: number | null, now: number): number {
  return lastSentAt === null
    ? 0
    : Math.max(0, lastSentAt + MIN_SAVE_GAP_MS - now);
}

/** Two pending saves for one lesson collapse into one request body. */
export function mergeSave(
  pending: { lastPositionSeconds: number; completed?: boolean } | undefined,
  next: { lastPositionSeconds: number; completed?: boolean },
): { lastPositionSeconds: number; completed?: boolean } {
  const completed = next.completed ?? pending?.completed;
  return {
    lastPositionSeconds: Math.max(
      pending?.lastPositionSeconds ?? 0,
      next.lastPositionSeconds,
    ),
    ...(completed === undefined ? {} : { completed }),
  };
}

/**
 * "3 phút 12 giây" — `aria-valuetext` must be words: a screen reader reads
 * "03:12" badly (UX_PLAN.md §8.4).
 */
export function spokenTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  const parts = [
    hours > 0 ? `${hours} giờ` : "",
    minutes > 0 ? `${minutes} phút` : "",
    rest > 0 || total === 0 ? `${rest} giây` : "",
  ];
  return parts.filter(Boolean).join(" ");
}

export type PlayerCommand =
  | { type: "toggle-play" }
  | { type: "seek-by"; seconds: number }
  | { type: "seek-to-fraction"; fraction: number }
  | { type: "seek-to-start" }
  | { type: "seek-to-end" }
  | { type: "volume-by"; delta: number }
  | { type: "toggle-mute" }
  | { type: "toggle-fullscreen" }
  | { type: "toggle-captions" }
  | { type: "rate-step"; step: -1 | 1 }
  | { type: "help" };

/** The §8.4 key map. `null` means "not ours": let the browser have it. */
export function commandForKey(key: string): PlayerCommand | null {
  if (/^[0-9]$/.test(key)) {
    return { type: "seek-to-fraction", fraction: Number(key) / 10 };
  }
  switch (key) {
    case " ":
    case "k":
    case "K":
      return { type: "toggle-play" };
    case "ArrowLeft":
      return { type: "seek-by", seconds: -5 };
    case "ArrowRight":
      return { type: "seek-by", seconds: 5 };
    case "j":
    case "J":
      return { type: "seek-by", seconds: -10 };
    case "l":
    case "L":
      return { type: "seek-by", seconds: 10 };
    case "ArrowUp":
      return { type: "volume-by", delta: 0.1 };
    case "ArrowDown":
      return { type: "volume-by", delta: -0.1 };
    case "m":
    case "M":
      return { type: "toggle-mute" };
    case "f":
    case "F":
      return { type: "toggle-fullscreen" };
    case "c":
    case "C":
      return { type: "toggle-captions" };
    case "<":
      return { type: "rate-step", step: -1 };
    case ">":
      return { type: "rate-step", step: 1 };
    case "Home":
      return { type: "seek-to-start" };
    case "End":
      return { type: "seek-to-end" };
    case "?":
      return { type: "help" };
    default:
      return null;
  }
}

/** The next rate in `PLAYBACK_RATES`, clamped at both ends. */
export function stepRate(current: number, step: -1 | 1): number {
  const index = PLAYBACK_RATES.findIndex((rate) => rate === current);
  const from = index === -1 ? PLAYBACK_RATES.indexOf(1) : index;
  const next = Math.min(PLAYBACK_RATES.length - 1, Math.max(0, from + step));
  return PLAYBACK_RATES[next];
}

/** `1,25x` — Vietnamese decimal comma. */
export const rateLabel = (rate: number) =>
  `${String(rate).replace(".", ",")}x`;
