import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/shell";
import { requireAdmin } from "@/lib/admin";
import { getSession } from "@/lib/session";

/**
 * Pages' static titles resolve even when the layout answers 404, which would
 * name the admin route in a non-admin's tab (UX_PLAN.md §2.3). A template
 * without `%s` swallows the page title, leaving what any 404 shows.
 *
 * An outage falls back to that neutral title instead of throwing: metadata
 * is resolved again on every client navigation, and its error would replace
 * a list that is keeping its old rows (UX_PLAN.md §6.3).
 */
export async function generateMetadata(): Promise<Metadata> {
  const admin = await getSession().then(
    (user) => user?.role === "ADMIN",
    () => false,
  );
  return {
    title: admin
      ? { default: "Quản trị", template: "%s · Quản trị" }
      : { default: "E-learning", template: "E-learning" },
    robots: { index: false, follow: false },
  };
}

/**
 * Reading the session forces dynamic rendering for the whole admin area. That
 * is the intended trade: nothing under /admin may ever be prerendered.
 *
 * An outage (the session cannot be read at all) renders the page bare: no
 * admin nav, since the visitor is unknown. The page then fails its own fetch
 * and shows its own error state (UX_PLAN.md §6.2) instead of the root error.
 * That leaks nothing: every admin read is still guarded by the API, whose
 * 401/404 turn into the usual redirect or not-found.
 */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  try {
    await requireAdmin();
  } catch (error) {
    unstable_rethrow(error);
    console.error(error);
    return (
      <main id="main" tabIndex={-1} className="min-w-0 px-4 py-8 lg:px-8">
        {children}
      </main>
    );
  }
  return <AdminShell>{children}</AdminShell>;
}
