import { notFound, redirect } from "next/navigation";
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
