import { notFound, redirect, unstable_rethrow } from "next/navigation";
import type { AdminCourseRow, CourseStatus, Paginated } from "./catalog";
import { getSession, serverFetch, type User } from "./session";

/**
 * `/admin/*` answers 404 to everyone but an admin, so the status code alone
 * cannot tell "session expired" from "not allowed". The layout asks
 * `GET /auth/me` first and splits the two cases here.
 */
export async function requireAdmin(): Promise<User> {
  // Only a real 401 means "not signed in" — `getSession` returns null for that
  // and throws for anything else. Catching everything here would turn an API
  // outage into a login screen, which sends the admin chasing the wrong
  // problem; letting it throw shows the error boundary instead.
  const user = await getSession();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "ADMIN") notFound();
  return user;
}

export async function adminFetch<T>(path: string): Promise<T> {
  const response = await serverFetch(path);
  if (response.status === 404) notFound();
  if (response.status === 401) redirect("/login?next=/admin");
  if (!response.ok) {
    throw new Error(`API ${path} answered ${response.status}`);
  }
  return (await response.json()) as T;
}

export type ReportOverview = {
  revenueVnd: number;
  paidPurchases: number;
  newStudents: number;
  activeEnrollments: number;
  draftCourses: number;
  pendingPaymentAttempts: number;
  videoAssetsNotReady: number;
  series: { date: string; revenueVnd: number; purchases: number }[];
};

export const CHECKOUT_ENABLED =
  process.env.NEXT_PUBLIC_CHECKOUT_ENABLED === "true";

/** `AdminUserRow` (API_CONTRACT.md §4). */
export type AdminUserRow = User & {
  enrollmentCount: number;
  purchaseCount: number;
  activeSessionCount: number;
};

export type EnrollmentSource = "PURCHASE" | "MANUAL_GRANT";

export type AdminEnrollment = {
  id: string;
  user: { id: string; email: string; displayName: string };
  course: { id: string; title: string };
  status: "ACTIVE" | "REVOKED";
  source: EnrollmentSource;
  grantedAt: string;
  revokedAt: string | null;
  grantedById: string | null;
};

export type AdminUserDetail = {
  user: AdminUserRow;
  enrollments: AdminEnrollment[];
  /** Always empty until checkout exists. */
  purchases: unknown[];
};

export const SOURCE_LABEL: Record<EnrollmentSource, string> = {
  MANUAL_GRANT: "Cấp thủ công",
  PURCHASE: "Mua",
};

/** Version 4 only, like the API's `@IsUUID('4')`; any other id is a 400 there. */
export const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Grant/revoke rows name the granting admin only by id: resolve it to an email. */
export async function adminEmails(): Promise<Map<string, string>> {
  // ponytail: every granter is an admin, and 100 admins is far past a
  // one-owner site. Optional: on failure the column shows "—".
  const admins = await adminFetch<{ items: AdminUserRow[] }>(
    "/admin/users?role=ADMIN&sort=email:asc&pageSize=100",
  ).catch((error: unknown) => {
    unstable_rethrow(error);
    console.error(error);
    return { items: [] };
  });
  return new Map(admins.items.map(({ id, email }) => [id, email]));
}

export type GrantableCourse = { id: string; title: string; status: CourseStatus };

/**
 * The course select of `ManualGrantDialog`: PUBLISHED and ARCHIVED only (a
 * DRAFT course cannot be granted). `null` when the list failed, so the page
 * hides the grant button and keeps everything else working (UX_PLAN.md §6.3).
 * ponytail: the first 100 by title; a searchable picker replaces it past that.
 */
export async function grantableCourses(): Promise<GrantableCourse[] | null> {
  try {
    const { items } = await adminFetch<Paginated<AdminCourseRow>>(
      "/admin/courses?status=PUBLISHED,ARCHIVED&sort=title:asc&pageSize=100",
    );
    return items.map(({ id, title, status }) => ({ id, title, status }));
  } catch (error) {
    unstable_rethrow(error);
    console.error(error);
    return null;
  }
}
