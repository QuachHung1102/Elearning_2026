"use client";

import type { User } from "./session";

/**
 * "Who is viewing" for statically rendered pages. Several islands ask the same
 * question on one page (the header and the course CTA), so the answer is
 * fetched once per page load and shared. A guest gets exactly one 401 from
 * `GET /auth/me`, which is that endpoint's documented shape.
 */
let pending: Promise<User | null> | undefined;

export function whoAmI(): Promise<User | null> {
  pending ??= fetch("/api/v1/auth/me", {
    credentials: "include",
    cache: "no-store",
  })
    .then(async (response) =>
      response.ok ? ((await response.json()) as { user: User }).user : null,
    )
    .catch(() => null);
  return pending;
}
