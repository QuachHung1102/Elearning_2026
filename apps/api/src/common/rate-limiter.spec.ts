import { RateLimiter } from './rate-limiter.js';

describe('RateLimiter', () => {
  it('lets `limit` hits through, then says how many seconds are left in the window', () => {
    const limiter = new RateLimiter();

    for (let hit = 0; hit < 3; hit += 1) {
      expect(limiter.hit('client', 3, 60, 1_000)).toBeNull();
    }
    expect(limiter.hit('client', 3, 60, 1_000)).toBe(60);
    // Half the window later: thirty seconds left, and a refused hit is not a new window.
    expect(limiter.hit('client', 3, 60, 31_000)).toBe(30);
    expect(limiter.hit('client', 3, 60, 31_001)).toBe(30);
  });

  it('rounds the wait up to whole seconds', () => {
    const limiter = new RateLimiter();
    limiter.hit('client', 1, 60, 0);

    expect(limiter.hit('client', 1, 60, 59_001)).toBe(1);
  });

  it('starts a fresh window once the old one has ended', () => {
    const limiter = new RateLimiter();
    for (let hit = 0; hit < 3; hit += 1) limiter.hit('client', 3, 60, 0);
    expect(limiter.hit('client', 3, 60, 59_999)).toBe(1);

    expect(limiter.hit('client', 3, 60, 60_000)).toBeNull();
  });

  it('counts every key on its own', () => {
    const limiter = new RateLimiter();
    limiter.hit('a', 1, 60, 0);

    expect(limiter.hit('a', 1, 60, 0)).toBe(60);
    expect(limiter.hit('b', 1, 60, 0)).toBeNull();
  });

  it('forgets a key on reset, so its next hit opens a fresh window', () => {
    const limiter = new RateLimiter();
    for (let hit = 0; hit < 3; hit += 1) limiter.hit('client', 3, 60, 0);
    expect(limiter.hit('client', 3, 60, 1)).not.toBeNull();

    limiter.reset('client');

    expect(limiter.hit('client', 3, 60, 2)).toBeNull();
    expect(limiter.hit('client', 3, 60, 2)).toBeNull();
    expect(limiter.hit('client', 3, 60, 2)).toBeNull();
    expect(limiter.hit('client', 3, 60, 2)).not.toBeNull();
  });

  it('does not mind a reset for a key it never saw', () => {
    expect(() => new RateLimiter().reset('nobody')).not.toThrow();
  });

  // REVIEW F-11: the table used to `clear()` when full, so anyone who could mint
  // 10,000 client keys (a /64 of IPv6 addresses) reset every counter.
  it('keeps the counter of a limited key when one-off keys fill the table', () => {
    const limiter = new RateLimiter();
    for (let hit = 0; hit < 3; hit += 1) limiter.hit('victim', 3, 60, 0);
    expect(limiter.hit('victim', 3, 60, 1)).not.toBeNull();

    for (let flood = 0; flood < 10_050; flood += 1) {
      limiter.hit(`flood-${flood}`, 3, 60, 2);
    }

    expect(limiter.hit('victim', 3, 60, 3)).not.toBeNull();
  });
});
