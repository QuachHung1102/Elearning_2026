/**
 * `@prisma/adapter-pg` writes a `Date` as UTC wall-clock text with no offset
 * and relabels whatever offset comes back as `+00:00`. Postgres reads the text
 * in the session TimeZone, so any non-UTC server default stored instants early
 * (7 hours on `Asia/Bangkok`) while Prisma reads still looked right. Forcing
 * UTC per connection makes stored instants true on every server (REVIEW F-01).
 */
export const PG_SESSION_OPTIONS = { options: '-c TimeZone=UTC' } as const;
