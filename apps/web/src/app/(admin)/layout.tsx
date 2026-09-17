import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/shell";
import { requireAdmin } from "@/lib/admin";
import { getSession } from "@/lib/session";

/**
 * Pages' static titles resolve even when the layout answers 404, which would
 * name the admin route in a non-admin's tab (UX_PLAN.md §2.3). A template
 * without `%s` swallows the page title, leaving what any 404 shows.
 */
export async function generateMetadata(): Promise<Metadata> {
  const admin = (await getSession())?.role === "ADMIN";
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
 */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAdmin();
  return <AdminShell>{children}</AdminShell>;
}
