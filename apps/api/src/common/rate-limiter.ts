const MAX_TRACKED_KEYS = 10_000;
const SWEEP_EVERY_MS = 1_000;

type Attempt = { count: number; resetsAt: number };

/**
 * A fixed-window counter per key, shared by the route guard and the callback's
 * bad-signature count.
 *
 * ponytail: this is per-process; use shared storage before horizontal scaling.
 */
export class RateLimiter {
  private readonly attempts = new Map<string, Attempt>();
  private lastSweep = 0;

  /**
   * A full table must not be wipeable by minting keys (a /64 of IPv6 gives
   * anyone 10,000 of them): drop expired keys, then one-off keys, and only
   * then the oldest. ponytail: the single-hit scan is O(n) while the table is
   * full of repeat clients; move to shared storage or an LRU if that shows up.
   */
  private makeRoom(now: number): void {
    if (this.attempts.size < MAX_TRACKED_KEYS) return;
    if (now - this.lastSweep >= SWEEP_EVERY_MS) {
      this.lastSweep = now;
      for (const [key, attempt] of this.attempts) {
        if (attempt.resetsAt <= now) this.attempts.delete(key);
      }
      if (this.attempts.size < MAX_TRACKED_KEYS) return;
    }
    for (const [key, attempt] of this.attempts) {
      if (attempt.count === 1) {
        this.attempts.delete(key);
        return;
      }
    }
    const oldest = this.attempts.keys().next();
    if (!oldest.done) this.attempts.delete(oldest.value);
  }

  /** Forgets `key`: its next hit opens a fresh window (a login that succeeded). */
  reset(key: string): void {
    this.attempts.delete(key);
  }

  /**
   * Counts one hit for `key`. Returns `null` while the key is within `limit`
   * hits per `windowSeconds`, otherwise the whole seconds left in its window
   * (the `Retry-After`). A refused hit is not counted.
   */
  hit(
    key: string,
    limit: number,
    windowSeconds: number,
    now = Date.now(),
  ): number | null {
    const attempt = this.attempts.get(key);

    if (!attempt || attempt.resetsAt <= now) {
      this.makeRoom(now);
      this.attempts.set(key, {
        count: 1,
        resetsAt: now + windowSeconds * 1_000,
      });
      return null;
    }

    if (attempt.count >= limit) {
      return Math.ceil((attempt.resetsAt - now) / 1_000);
    }

    attempt.count += 1;
    return null;
  }
}
