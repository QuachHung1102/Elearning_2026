/** Where a signed-in learner lands, and what the account menu points at. */
export const LEARNER_HOME = "/my-courses";

/** Where a sign-in without `?next=` lands: an instructor works in their own area. */
export function homeFor(role: string): string {
  return role === "INSTRUCTOR" ? "/instructor" : LEARNER_HOME;
}

/**
 * The `?next=` target after sign-in or sign-up, kept on this origin. Parsed the
 * way the browser will resolve it, so `/\evil.com` (a backslash counts as a
 * slash) or `//evil.com` fall back to `LEARNER_HOME` instead of leaving.
 */
export function safeNext(value: string | string[] | undefined): string {
  // A repeated `?next=a&next=b` arrives as an array; only the first counts.
  const target = Array.isArray(value) ? value[0] : value;
  if (!target?.startsWith("/")) return LEARNER_HOME;
  const base = "http://same.origin";
  try {
    const url = new URL(target, base);
    // Dot segments can normalize "/.//evil.com" into a protocol-relative
    // "//evil.com" that still passes the origin check here.
    return url.origin === base && !url.pathname.startsWith("//")
      ? `${url.pathname}${url.search}${url.hash}`
      : LEARNER_HOME;
  } catch {
    return LEARNER_HOME;
  }
}
