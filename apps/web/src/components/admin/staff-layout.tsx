import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import type { ReactNode } from "react";
import { requireAdmin, requireInstructor } from "@/lib/admin";
import { getSession } from "@/lib/session";
import { AdminShell } from "./shell";
import type { StaffArea } from "./admin-nav";

const AREA = {
  admin: {
    role: "ADMIN",
    require: requireAdmin,
    title: { default: "Quản trị", template: "%s · Quản trị" },
  },
  instructor: {
    role: "INSTRUCTOR",
    require: requireInstructor,
    title: { default: "Giảng viên", template: "%s · Giảng viên" },
  },
} as const;

/**
 * Pages' static titles resolve even when the layout answers 404, which would
 * name the area's route in an outsider's tab (UX_PLAN.md §2.3). A template
 * without `%s` swallows the page title, leaving what any 404 shows.
 *
 * An outage falls back to that neutral title instead of throwing: metadata
 * is resolved again on every client navigation, and its error would replace
 * a list that is keeping its old rows (UX_PLAN.md §6.3).
 */
export async function staffMetadata(area: StaffArea): Promise<Metadata> {
  const allowed = await getSession().then(
    (user) => user?.role === AREA[area].role,
    () => false,
  );
  return {
    title: allowed
      ? AREA[area].title
      : { default: "E-learning", template: "E-learning" },
    robots: { index: false, follow: false },
  };
}

/**
 * Reading the session forces dynamic rendering for the whole area. That is the
 * intended trade: nothing under /admin or /instructor may ever be prerendered.
 *
 * An outage (the session cannot be read at all) renders the page bare: no nav,
 * since the visitor is unknown. The page then fails its own fetch and shows its
 * own error state (UX_PLAN.md §6.2) instead of the root error. That leaks
 * nothing: every read is still guarded by the API, whose 401/404 turn into the
 * usual redirect or not-found.
 */
export async function StaffLayout({
  area,
  children,
}: {
  area: StaffArea;
  children: ReactNode;
}) {
  try {
    await AREA[area].require();
  } catch (error) {
    unstable_rethrow(error);
    console.error(error);
    return (
      <main id="main" tabIndex={-1} className="min-w-0 px-4 py-8 lg:px-8">
        {children}
      </main>
    );
  }
  return <AdminShell area={area}>{children}</AdminShell>;
}
