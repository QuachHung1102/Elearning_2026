"use client";

import { ApiError, apiFetch } from "./api";
import type { SaveProgressResult } from "./learning";
import { mergeSave, saveDelay } from "./player";

type Body = { lastPositionSeconds: number; completed?: boolean };

export type SyncEvent =
  | { type: "saved"; lessonId: string; result: SaveProgressResult }
  | { type: "status"; unsynced: boolean; dropped?: true };

/**
 * The one writer of `PUT /lessons/{id}/progress` for the page. The player
 * queues here, so every trigger (15 s tick, pause, ended, auto-complete)
 * collapses into at most one request per 5 s (UX_PLAN.md §4.6); a hidden tab
 * flushes at once. The complete toggle sends through `saveProgressNow` and
 * falls back to the queue when that save has to wait. A failed save — 429,
 * offline, 5xx — stays queued in memory and is retried on the next 5 s tick,
 * when the tab is visible again or back online, and flushed when the tab is
 * hidden; nothing is shown but the "Chưa đồng bộ tiến độ" chip (§6.3).
 */
const pending = new Map<string, Body>();
const listeners = new Set<(event: SyncEvent) => void>();
/** Newest request number whose answer was announced, per lesson. */
const announced = new Map<string, number>();
let sent = 0;
let lastSentAt: number | null = null;
let timer: number | undefined;
let sending = false;
let unsynced = false;
let wired = false;

function emit(event: SyncEvent) {
  for (const listener of listeners) listener(event);
}

function setUnsynced(value: boolean, dropped = false) {
  if (unsynced === value) return;
  unsynced = value;
  emit({ type: "status", unsynced: value, ...(dropped ? { dropped } : {}) });
}

/**
 * Answers can arrive out of order; an older one (a tick sent before the
 * toggle) must not flip completion back, so only the newest is announced.
 */
async function put(lessonId: string, body: Body, keepalive = false) {
  const seq = ++sent;
  const result = await apiFetch<SaveProgressResult>(
    `/lessons/${lessonId}/progress`,
    { method: "PUT", body: JSON.stringify(body), keepalive },
  );
  if (seq > (announced.get(lessonId) ?? 0)) {
    announced.set(lessonId, seq);
    emit({ type: "saved", lessonId, result });
  }
  return result;
}

function schedule() {
  if (timer !== undefined || sending || pending.size === 0) return;
  timer = window.setTimeout(() => {
    timer = undefined;
    void flush();
  }, saveDelay(lastSentAt, Date.now()));
}

async function flush(keepalive = false) {
  const next = pending.entries().next();
  if (next.done) return;
  const [lessonId, body] = next.value;
  pending.delete(lessonId);
  sending = true;
  lastSentAt = Date.now();
  try {
    await put(lessonId, body, keepalive);
    if (pending.size === 0) setUnsynced(false);
  } catch (caught) {
    const status = caught instanceof ApiError ? caught.status : 0;
    // Worth retrying: rate limited, offline or an outage. Anything else (a
    // revoked enrollment, a deleted lesson, an expired session) will not
    // succeed later, so it is dropped rather than retried forever.
    if (status === 0 || status === 429 || status >= 500) {
      pending.set(lessonId, mergeSave(body, pending.get(lessonId) ?? body));
      setUnsynced(true);
    } else if (pending.size === 0) {
      setUnsynced(false, true);
    }
  } finally {
    sending = false;
  }
  // Offline waits for `online`; otherwise the next try is 5 s later.
  if (navigator.onLine) schedule();
}

function onVisibility() {
  if (document.visibilityState === "hidden") flushNow();
  else if (navigator.onLine) schedule();
}

export function queueProgress(lessonId: string, body: Body) {
  if (!wired) {
    wired = true;
    window.addEventListener("online", schedule);
    document.addEventListener("visibilitychange", onVisibility);
  }
  pending.set(lessonId, mergeSave(pending.get(lessonId), body));
  // Offline, wait for `online` (and say the save is waiting); a 429 or an
  // outage retries on the next tick, still spaced by the 5 s gap.
  if (navigator.onLine) schedule();
  else setUnsynced(true);
}

/**
 * The tab is being hidden, maybe closed: send everything now, past the 5 s
 * gap, with `keepalive` so the request outlives the page. A timer would never
 * fire during unload.
 */
export function flushNow() {
  if (!navigator.onLine) return;
  window.clearTimeout(timer);
  timer = undefined;
  // `flush` takes its entry off the queue before its first await.
  for (let left = pending.size; left > 0; left -= 1) void flush(true);
}

/**
 * A save the caller waits on (the complete toggle): sent at once, and still
 * announced to every listener, so the player learns about an un-mark and can
 * auto-complete again. Throws like `apiFetch`.
 */
export function saveProgressNow(lessonId: string, body: Body) {
  return put(lessonId, body);
}

export function onProgressSync(listener: (event: SyncEvent) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const isUnsynced = () => unsynced;
