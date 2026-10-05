"use client";

import {
  Captions,
  Keyboard,
  LoaderCircle,
  Maximize,
  Minimize,
  Pause,
  Play,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { ApiError, apiFetch } from "@/lib/api";
import { formatTimecode } from "@/lib/format";
import type { Playback } from "@/lib/learning";
import {
  PLAYBACK_RATES,
  SAVE_INTERVAL_MS,
  commandForKey,
  playbackEngine,
  rateLabel,
  reachedCompletion,
  resumeAt,
  spokenTime,
  stepRate,
  tokenNeedsRefresh,
  type PlayerCommand,
} from "@/lib/player";
import { flushNow, onProgressSync, queueProgress } from "@/lib/progress-sync";

type Failure = "expired" | "not-ready" | "error";

const FAILURE_COPY: Record<
  Failure,
  { title: string; description: string; action: string }
> = {
  expired: {
    title: "Phiên xem đã hết hạn",
    description: "Tải lại trang để tiếp tục.",
    action: "Tải lại trang",
  },
  "not-ready": {
    title: "Video đang được xử lý",
    description: "Bài học sẽ xem được sau vài phút.",
    action: "Kiểm tra lại",
  },
  error: {
    title: "Không phát được video",
    description: "Kiểm tra kết nối rồi thử lại.",
    action: "Thử lại",
  },
};

const SHORTCUTS: [string, string][] = [
  ["Space / K", "Phát / tạm dừng"],
  ["← / →", "Lùi / tiến 5 giây"],
  ["J / L", "Lùi / tiến 10 giây"],
  ["↑ / ↓", "Tăng / giảm âm lượng 10%"],
  ["M", "Tắt / bật tiếng"],
  ["F", "Bật / thoát toàn màn hình"],
  ["C", "Bật / tắt phụ đề"],
  ["< / >", "Giảm / tăng tốc độ"],
  ["0–9", "Nhảy tới 0%–90%"],
  ["Home / End", "Về đầu / tới cuối"],
  ["?", "Mở bảng phím tắt"],
];

const TYPING = new Set(["INPUT", "SELECT", "TEXTAREA"]);

const controlButton =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-md hover:bg-white/15 aria-pressed:text-secondary";

/**
 * `VideoPlayer` (UX_PLAN.md §4.6, §8.4): a native `<video>` with its own
 * controls. The controls sit under the picture and never hide, so a keyboard
 * or screen-reader user never has to find them again.
 *
 * `track` is false for an admin preview or a preview lesson: nothing is sent.
 */
export function VideoPlayer({
  lessonId,
  track,
  initialPosition,
  initiallyCompleted,
}: {
  lessonId: string;
  track: boolean;
  initialPosition: number | null;
  initiallyCompleted: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const region = useRef<HTMLDivElement>(null);
  const help = useRef<HTMLDialogElement>(null);
  const live = useRef<HTMLParagraphElement>(null);
  const announceTimer = useRef<number | undefined>(undefined);
  const scrubbing = useRef(false);
  // Where to seek once metadata arrives, and whether to play then.
  const resumeTo = useRef<number | null>(initialPosition);
  const playWhenReady = useRef(false);
  const retried = useRef(false);
  const loadedAt = useRef(0);
  const completed = useRef(initiallyCompleted);
  // Auto-complete fires on crossing 95%, not on being past it: an un-mark
  // while the playhead is already there must stick until it crosses again.
  const armed = useRef(!initiallyCompleted);
  // Last known position: saved on unmount and resumed by a manual retry,
  // both after the element is gone.
  const lastTime = useRef(0);
  const wasPlaying = useRef(false);

  const [playback, setPlayback] = useState<Playback | null>(null);
  // Each new URL mounts a fresh element: a retry inside the same second gets
  // a byte-identical URL, and the same `src` would not load again.
  const [attempt, setAttempt] = useState(0);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [captions, setCaptions] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  /** Polite and debounced, so holding → reads one time, not twenty. */
  const announce = useCallback((message: string) => {
    window.clearTimeout(announceTimer.current);
    announceTimer.current = window.setTimeout(() => {
      if (live.current) live.current.textContent = message;
    }, 400);
  }, []);

  const save = useCallback(
    (complete?: true) => {
      const element = video.current;
      if (!track || !element) return;
      queueProgress(lessonId, {
        lastPositionSeconds: Math.floor(element.currentTime),
        ...(complete ? { completed: true } : {}),
      });
    },
    [lessonId, track],
  );

  const apply = useCallback((result: Playback | Failure) => {
    if (typeof result === "string") setFailure(result);
    else {
      setPlayback(result);
      setAttempt((count) => count + 1);
    }
  }, []);

  const load = useCallback(
    (refresh: boolean) => {
      void requestToken(lessonId, refresh).then(apply);
    },
    [apply, lessonId],
  );

  // `playback` is only set in the browser, so `document` is there.
  const engine =
    playback &&
    playbackEngine(
      playback.kind,
      document.createElement("video").canPlayType("application/vnd.apple.mpegurl"),
    );

  // HLS where the element cannot play it: hls.js, loaded only then, feeds the
  // element of this attempt and is torn down with it.
  useEffect(() => {
    const element = video.current;
    if (engine !== "hls.js" || !playback || !element) return;
    let hls: import("hls.js").default | undefined;
    let active = true;
    void import("hls.js").then(({ default: Hls }) => {
      if (!active) return;
      if (!Hls.isSupported()) {
        setFailure("error");
        return;
      }
      hls = new Hls();
      // A fatal hls.js error takes the element's own error path: one silent
      // retry with a fresh URL, then the error state.
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) element.dispatchEvent(new Event("error"));
      });
      hls.loadSource(playback.playbackUrl);
      hls.attachMedia(element);
    });
    return () => {
      active = false;
      hls?.destroy();
    };
    // `failure` unmounts the element: the instance must not outlive it.
  }, [attempt, engine, failure, playback]);

  // Once per lesson: a server refresh after a save must not reload the video.
  useEffect(() => {
    let active = true;
    void requestToken(lessonId, false).then((result) => {
      if (active) apply(result);
    });
    return () => {
      active = false;
    };
  }, [apply, lessonId]);

  /** Swap in a new URL and carry on from the same second. */
  const reload = useCallback(
    (autoplay: boolean) => {
      resumeTo.current = video.current?.currentTime ?? null;
      playWhenReady.current = autoplay;
      setFailure(null);
      void load(true);
    },
    [load],
  );

  // The complete toggle can un-mark the lesson; then crossing 95% again must
  // complete it again, so the flag follows every saved state of this lesson.
  useEffect(
    () =>
      onProgressSync((event) => {
        if (event.type !== "saved" || event.lessonId !== lessonId) return;
        const done = event.result.progress.completedAt !== null;
        if (completed.current && !done) {
          const element = video.current;
          armed.current = !(
            element && reachedCompletion(element.currentTime, element.duration)
          );
        }
        completed.current = done;
      }),
    [lessonId],
  );

  // Leaving the lesson (Trước / Sau, the curriculum, the back link) unmounts
  // the player without a pause event; the queue outlives the component.
  useEffect(
    () => () => {
      if (track && lastTime.current > 0) {
        queueProgress(lessonId, {
          lastPositionSeconds: Math.floor(lastTime.current),
        });
      }
    },
    [lessonId, track],
  );

  // 15 s ticks while playing, never on `timeupdate`.
  useEffect(() => {
    if (!playing || !track) return;
    const timer = window.setInterval(() => save(), SAVE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [playing, save, track]);

  useEffect(() => {
    const hidden = () => {
      if (document.visibilityState === "hidden" && (video.current?.currentTime ?? 0) > 0) {
        save();
        flushNow();
      }
    };
    const fullscreenChange = () =>
      setFullscreen(document.fullscreenElement === region.current);
    document.addEventListener("visibilitychange", hidden);
    document.addEventListener("fullscreenchange", fullscreenChange);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      document.removeEventListener("fullscreenchange", fullscreenChange);
    };
  }, [save]);

  const seek = useCallback(
    (seconds: number) => {
      const element = video.current;
      if (!element || !Number.isFinite(element.duration)) return;
      element.currentTime = Math.min(Math.max(seconds, 0), element.duration);
      setCurrent(element.currentTime);
      announce(formatTimecode(element.currentTime));
    },
    [announce],
  );

  const togglePlay = useCallback(() => {
    const element = video.current;
    if (!element || !playback) return;
    if (!element.paused) {
      element.pause();
      return;
    }
    // Resuming on an almost-expired URL would fail a minute into the play.
    if (tokenNeedsRefresh(playback.expiresAt, Date.now())) {
      reload(true);
      return;
    }
    void element.play().catch(() => undefined);
  }, [playback, reload]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void region.current?.requestFullscreen().catch(() => undefined);
  }, []);

  const toggleCaptions = useCallback(() => {
    const next = !captions;
    showCaptions(video.current, next);
    setCaptions(next);
    announce(next ? "Đã bật phụ đề" : "Đã tắt phụ đề");
  }, [announce, captions]);

  const changeRate = useCallback(
    (next: number) => {
      if (video.current) video.current.playbackRate = next;
      setRate(next);
      announce(`Tốc độ ${rateLabel(next)}`);
    },
    [announce],
  );

  function run(command: PlayerCommand) {
    const element = video.current;
    if (!element) return;
    switch (command.type) {
      case "toggle-play":
        return togglePlay();
      case "seek-by":
        return seek(element.currentTime + command.seconds);
      case "seek-to-fraction":
        return seek(element.duration * command.fraction);
      case "seek-to-start":
        return seek(0);
      case "seek-to-end":
        return seek(element.duration);
      case "volume-by": {
        element.volume = Math.min(1, Math.max(0, element.volume + command.delta));
        element.muted = false;
        return announce(`Âm lượng ${Math.round(element.volume * 100)} phần trăm`);
      }
      case "toggle-mute":
        element.muted = !element.muted;
        return announce(element.muted ? "Đã tắt tiếng" : "Đã bật tiếng");
      case "toggle-fullscreen":
        return toggleFullscreen();
      case "toggle-captions":
        return toggleCaptions();
      case "rate-step":
        return changeRate(stepRate(rate, command.step));
      case "help":
        return help.current?.showModal();
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (TYPING.has(target.tagName) || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    // Space and Enter on a focused control press that control.
    if (target.tagName === "BUTTON" && (event.key === " " || event.key === "Enter")) {
      return;
    }
    const command = commandForKey(event.key);
    if (!command) return;
    event.preventDefault();
    run(command);
  }

  function scrubTo(event: PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    seek(fraction * (video.current?.duration ?? 0));
  }

  if (failure) {
    const copy = FAILURE_COPY[failure];
    return (
      <PlayerFrame>
        <div className="grid h-full place-content-center justify-items-center gap-3 p-6 text-center">
          {/* Announced, and not a heading above the lesson h1. */}
          <div role="alert" className="grid gap-3">
            <p className="text-xl font-semibold">{copy.title}</p>
            <p className="text-sm text-white/80">{copy.description}</p>
          </div>
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-md bg-card px-4 text-sm font-semibold text-card-foreground hover:bg-muted"
            onClick={() => {
              if (failure === "expired") {
                window.location.reload();
                return;
              }
              retried.current = false;
              // Carry on from where the failed element stopped, not from 0:00.
              resumeTo.current = lastTime.current || resumeTo.current;
              playWhenReady.current = wasPlaying.current;
              setFailure(null);
              void load(false);
            }}
          >
            {copy.action}
          </button>
        </div>
      </PlayerFrame>
    );
  }

  const valueText = `${spokenTime(current)} trên ${spokenTime(duration)}`;
  const percent = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div
      ref={region}
      role="region"
      aria-label="Trình phát video"
      tabIndex={0}
      onKeyDown={onKeyDown}
      className={`${track ? "top-[61px]" : "top-[57px]"} z-10 bg-foreground text-primary-foreground max-md:[@media(min-height:600px)]:sticky lg:mx-8 lg:mt-6 lg:max-w-[900px] lg:overflow-hidden lg:rounded-lg xl:max-w-[1000px] ${fullscreen ? "flex h-full flex-col" : ""}`}
    >
      <div className={`relative ${fullscreen ? "min-h-0 flex-1" : "aspect-video"}`}>
        {playback && (
          <video
            key={attempt}
            ref={video}
            src={engine === "native" ? playback.playbackUrl : undefined}
            muted={muted}
            preload="metadata"
            playsInline
            className="size-full bg-black object-contain"
            onClick={togglePlay}
            onLoadedMetadata={(event) => {
              const element = event.currentTarget;
              setDuration(element.duration);
              element.playbackRate = rate;
              const target = resumeTo.current;
              resumeTo.current = null;
              if (target) {
                element.currentTime = retried.current || playWhenReady.current
                  ? Math.min(target, element.duration)
                  : resumeAt(target, element.duration);
              }
              setCurrent(element.currentTime);
              loadedAt.current = element.currentTime;
              if (playWhenReady.current) {
                playWhenReady.current = false;
                void element.play().catch(() => undefined);
              }
            }}
            onTimeUpdate={(event) => {
              const element = event.currentTarget;
              if (!scrubbing.current) setCurrent(element.currentTime);
              lastTime.current = element.currentTime;
              // Real progress past where this URL started: the next failure
              // earns its own silent retry. Resetting on load alone would loop
              // a failure that repeats at the same frame through token requests.
              if (retried.current && element.currentTime - loadedAt.current > 3) {
                retried.current = false;
              }
              if (!reachedCompletion(element.currentTime, element.duration)) {
                armed.current = true;
              } else if (armed.current && !completed.current) {
                armed.current = false;
                completed.current = true;
                save(true);
              }
            }}
            onPlay={() => {
              wasPlaying.current = true;
              setPlaying(true);
              announce("Đang phát");
            }}
            onPause={() => {
              wasPlaying.current = false;
              setPlaying(false);
              announce("Đã tạm dừng");
              save();
            }}
            onEnded={() => {
              setPlaying(false);
              save();
            }}
            onWaiting={() => setBuffering(true)}
            onPlaying={() => setBuffering(false)}
            onCanPlay={() => setBuffering(false)}
            onVolumeChange={(event) => setMuted(event.currentTarget.muted)}
            onError={() => {
              // One silent retry with a fresh URL (it may just have expired),
              // then the error state with a manual retry.
              if (retried.current) {
                setFailure("error");
                return;
              }
              retried.current = true;
              reload(playing);
            }}
          >
            <track kind="captions" srcLang="vi" label="Tiếng Việt" />
          </video>
        )}
        {(!playback || buffering) && (
          <div
            className="absolute inset-0 grid place-content-center"
            aria-hidden="true"
          >
            <LoaderCircle className="size-8 animate-spin" strokeWidth={1.75} />
          </div>
        )}
        {!playback && (
          <div className="absolute inset-x-0 bottom-0 h-1 overflow-hidden bg-white/20">
            <div className="h-full w-1/3 animate-pulse bg-secondary" />
          </div>
        )}
      </div>

      <div className="grid gap-1 px-2 pb-1 pt-1">
        <div
          role="slider"
          tabIndex={playback ? 0 : -1}
          aria-label="Tua video"
          aria-valuemin={0}
          aria-valuemax={Math.floor(duration)}
          aria-valuenow={Math.floor(current)}
          aria-valuetext={valueText}
          aria-disabled={!playback || undefined}
          className="flex min-h-11 cursor-pointer touch-none items-center rounded-md px-1"
          onPointerDown={(event) => {
            if (!playback) return;
            scrubbing.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            scrubTo(event);
          }}
          onPointerMove={(event) => {
            if (scrubbing.current) scrubTo(event);
          }}
          onPointerUp={() => {
            scrubbing.current = false;
          }}
        >
          <div className="relative h-1.5 w-full rounded-full bg-white/30">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-secondary"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center sm:gap-1">
          <button
            type="button"
            className={controlButton}
            onClick={togglePlay}
            disabled={!playback}
            aria-label={playing ? "Tạm dừng" : "Phát"}
          >
            {playing ? (
              <Pause aria-hidden="true" className="size-5" strokeWidth={1.75} />
            ) : (
              <Play aria-hidden="true" className="size-5" strokeWidth={1.75} />
            )}
          </button>
          <span className="flex-1 whitespace-nowrap px-1 text-xs tabular-nums" aria-hidden="true">
            {formatTimecode(current)}
            {/* Only the current time on a phone, so every control fits. */}
            <span className="max-sm:hidden"> / {formatTimecode(duration)}</span>
          </span>
          <button
            type="button"
            className={controlButton}
            onClick={() => run({ type: "toggle-mute" })}
            aria-label="Tắt tiếng"
            aria-pressed={muted}
          >
            {muted ? (
              <VolumeX aria-hidden="true" className="size-5" strokeWidth={1.75} />
            ) : (
              <Volume2 aria-hidden="true" className="size-5" strokeWidth={1.75} />
            )}
          </button>
          <label className="sr-only" htmlFor={`rate-${lessonId}`}>
            Tốc độ phát
          </label>
          <select
            id={`rate-${lessonId}`}
            value={rate}
            onChange={(event) => changeRate(Number(event.target.value))}
            className="min-h-11 rounded-md border border-white/30 bg-foreground px-1 text-sm sm:px-2"
          >
            {PLAYBACK_RATES.map((option) => (
              <option key={option} value={option}>
                {rateLabel(option)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={controlButton}
            onClick={toggleCaptions}
            aria-label="Phụ đề"
            aria-pressed={captions}
          >
            <Captions aria-hidden="true" className="size-5" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            // A real button at every width, not only the "?" key (§8.4).
            className={controlButton}
            onClick={() => help.current?.showModal()}
            aria-label="Phím tắt"
            aria-haspopup="dialog"
          >
            <Keyboard aria-hidden="true" className="size-5" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className={controlButton}
            onClick={toggleFullscreen}
            aria-label={fullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
          >
            {fullscreen ? (
              <Minimize aria-hidden="true" className="size-5" strokeWidth={1.75} />
            ) : (
              <Maximize aria-hidden="true" className="size-5" strokeWidth={1.75} />
            )}
          </button>
        </div>
      </div>

      <p ref={live} className="sr-only" aria-live="polite" />

      <dialog
        ref={help}
        aria-labelledby={`shortcuts-${lessonId}`}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-border bg-card p-6 text-card-foreground shadow-[var(--shadow-modal)] backdrop:bg-overlay"
        // Keys pressed inside the help sheet are not player shortcuts.
        onKeyDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={`shortcuts-${lessonId}`} className="text-xl font-semibold">
            Phím tắt
          </h2>
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
        <table className="mt-4 w-full text-left text-sm">
          <thead className="sr-only">
            <tr>
              <th scope="col">Phím</th>
              <th scope="col">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {SHORTCUTS.map(([keys, action]) => (
              <tr key={keys} className="border-t border-border">
                <th scope="row" className="py-2 pr-4 font-mono font-medium">
                  {keys}
                </th>
                <td className="py-2">{action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </dialog>
    </div>
  );
}

/** The captions slot is the element's first text track. */
function showCaptions(element: HTMLVideoElement | null, on: boolean) {
  const textTrack = element?.textTracks[0];
  if (textTrack) textTrack.mode = on ? "showing" : "hidden";
}

/**
 * A fresh signed URL, or why there is none. `refresh` marks a retry
 * mid-lesson: then a refusal means this viewing session is over rather than a
 * broken video.
 */
async function requestToken(
  lessonId: string,
  refresh: boolean,
): Promise<Playback | Failure> {
  try {
    const token = await apiFetch<Playback>(
      `/lessons/${lessonId}/playback-token`,
      { method: "POST" },
    );
    return token;
  } catch (caught) {
    const status = caught instanceof ApiError ? caught.status : 0;
    if (status === 409) return "not-ready";
    // Only a refused session ends the viewing; a 429 is a broken retry, not
    // an expired page.
    return refresh && (status === 401 || status === 403) ? "expired" : "error";
  }
}

function PlayerFrame({ children }: { children: ReactNode }) {
  return (
    <div className="bg-foreground text-primary-foreground lg:mx-8 lg:mt-6 lg:max-w-[900px] lg:overflow-hidden lg:rounded-lg xl:max-w-[1000px]">
      <div className="aspect-video">{children}</div>
    </div>
  );
}
