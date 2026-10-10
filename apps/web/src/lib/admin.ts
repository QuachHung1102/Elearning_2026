import { headers } from "next/headers";
import { notFound, redirect, unstable_rethrow } from "next/navigation";
import { cache } from "react";
import type {
  AdminCourseDetail,
  AdminCourseRow,
  CourseStatus,
  Paginated,
} from "./catalog";
import { getSession, serverFetch, type User } from "./session";

/**
 * `/admin/*` answers 404 to everyone but an admin, so the status code alone
 * cannot tell "session expired" from "not allowed". The layout asks
 * `GET /auth/me` first and splits the two cases here.
 */
export async function requireAdmin(): Promise<User> {
  return requireRole("ADMIN", "/admin");
}

/** Staff area base path: admin and instructor share the course editor pages. */
export type StaffBase = "/admin" | "/instructor";

/** `/instructor/*` follows the same 404-for-everyone-else rule as `/admin/*`. */
export async function requireInstructor(): Promise<User> {
  return requireRole("INSTRUCTOR", "/instructor");
}

async function requireRole(role: User["role"], base: StaffBase): Promise<User> {
  // Only a real 401 means "not signed in" — `getSession` returns null for that
  // and throws for anything else. Catching everything here would turn an API
  // outage into a login screen, which sends the admin chasing the wrong
  // problem; letting it throw shows the error boundary instead.
  const user = await getSession();
  if (!user) redirect(`/login?next=${base}`);
  if (user.role !== role) notFound();
  return user;
}

/**
 * The course pages are shared by both areas, so links and the sign-in redirect
 * follow the URL. `proxy.ts` puts it in `x-elearning-path` for server components.
 */
export async function staffBase(): Promise<StaffBase> {
  const path = (await headers()).get("x-elearning-path") ?? "";
  return path.startsWith("/instructor") ? "/instructor" : "/admin";
}

/** `base` only picks where an expired session signs back in to; default: this URL's area. */
export async function adminFetch<T>(
  path: string,
  base?: StaffBase,
): Promise<T> {
  const response = await serverFetch(path);
  if (response.status === 404) notFound();
  if (response.status === 401) {
    redirect(`/login?next=${base ?? (await staffBase())}`);
  }
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

export { CHECKOUT_ENABLED } from "./orders";

/** `AdminUserRow` (API_CONTRACT.md §4). */
export type AdminUserRow = User & {
  enrollmentCount: number;
  purchaseCount: number;
  activeSessionCount: number;
};

/** Answer of `GET /admin/reports/instructor-overview` (API_CONTRACT.md §5.7). */
export type InstructorOverview = {
  publishedCourses: number;
  draftCourses: number;
  activeEnrollments: number;
  newEnrollments30d: number;
};

/** Same course, read by the layout and every tab: one request per render. */
export const getAdminCourse = cache((id: string) =>
  adminFetch<AdminCourseDetail>(`/admin/courses/${id}`),
);

export type EnrollmentProgress = {
  completedLessons: number;
  totalLessons: number;
  percent: number;
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
  /** Only the list carries it (`GET /admin/enrollments`), not a grant's answer. */
  progress?: EnrollmentProgress;
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
