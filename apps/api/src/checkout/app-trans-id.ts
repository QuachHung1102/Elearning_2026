import { randomBytes } from 'node:crypto';

const DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: '2-digit',
  month: '2-digit',
  day: '2-digit',
});

/**
 * `yymmdd_` + 8 hex characters, unique per merchant per day. The day is the
 * Vietnam one, spelled out with `timeZone`: `toISOString()` (UTC, as on
 * most servers) gives the previous day between 00:00 and 07:00 there, so
 * reconciliation would look in the wrong bucket (DEMO_MODE.md §5).
 * Random rather than a counter: the `unique` column catches the rest.
 */
export function newAppTransId(
  now: Date = new Date(),
  random: () => string = () => randomBytes(4).toString('hex'),
): string {
  return `${DAY.format(now).replaceAll('-', '')}_${random()}`;
}
