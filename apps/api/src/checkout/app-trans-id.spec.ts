import { newAppTransId } from './app-trans-id.js';

// DEMO_MODE.md §5: the day prefix is Vietnam time. Building it from
// `toISOString()` gives the previous day between 00:00 and 07:00 there.
describe('newAppTransId', () => {
  const fixed = () => 'ab12cd34';

  it('prefixes the Vietnam calendar day, not the UTC one', () => {
    // 20:00Z on 1 Sep is 03:00 on 2 Sep in Vietnam.
    expect(newAppTransId(new Date('2026-09-01T20:00:00Z'), fixed)).toBe(
      '260902_ab12cd34',
    );
    // 16:59Z is still 23:59 on 1 Sep in Vietnam.
    expect(newAppTransId(new Date('2026-09-01T16:59:00Z'), fixed)).toBe(
      '260901_ab12cd34',
    );
  });

  it('is yymmdd_ plus eight random hex characters, and differs call to call', () => {
    const ids = new Set(
      Array.from({ length: 50 }, () => newAppTransId(new Date('2026-09-30T00:00:00Z'))),
    );
    for (const id of ids) expect(id).toMatch(/^\d{6}_[0-9a-f]{8}$/);
    expect(ids.size).toBe(50);
  });
});
