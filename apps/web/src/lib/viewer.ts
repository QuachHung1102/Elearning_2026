"use client";

import type { User } from "./session";

/**
 * "Who is viewing" for statically rendered pages. Several islands ask the same
 * question on one page (the header and the course CTA), so the answer is
 * fetched once per document and shared. Sign-in and sign-out do a full page
 * load (`auth-forms.tsx`, `logout-button.tsx`), which is what resets it. A
 * guest gets exactly one 401 from `GET /auth/me`, which is that endpoint's
 * documented shape.
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

let enrolled: Promise<Set<string>> | undefined;


/**
 * Ids of the courses the viewer may learn now, for every "Đã đăng ký" badge
 * on the page: one request however many cards render. Guests never call the
 * endpoint; any failure just leaves the badges off.
 * ponytail: the first 100 ACTIVE enrollments; page on when a learner has more.
 */
export function enrolledCourseIds(): Promise<Set<string>> {
  enrolled ??= whoAmI()
    .then(async (user) => {
      if (!user) return new Set<string>();
      const response = await fetch(
        "/api/v1/enrollments/me?status=ACTIVE&pageSize=100",
        { credentials: "include", cache: "no-store" },
      );
      if (!response.ok) return new Set<string>();
      const body = (await response.json()) as {
        items: { course: { id: string } }[];
      };
      return new Set(body.items.map(({ course }) => course.id));
    })
    .catch(() => new Set<string>());
  return enrolled;
}
