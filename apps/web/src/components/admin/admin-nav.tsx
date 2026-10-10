"use client";

import {
  BookOpen,
  FolderTree,
  KeyRound,
  LayoutDashboard,
  Menu,
  Receipt,
  ScrollText,
  UsersRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { CHECKOUT_ENABLED } from "@/lib/orders";

type NavItem = { href: string; label: string; icon: LucideIcon };

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/admin/courses", label: "Khóa học", icon: BookOpen },
  { href: "/admin/categories", label: "Danh mục", icon: FolderTree },
  { href: "/admin/users", label: "Người dùng", icon: Users },
  { href: "/admin/enrollments", label: "Quyền học", icon: KeyRound },
  // Payments are the owner's: not in INSTRUCTOR_NAV, and only while selling is on.
  ...(CHECKOUT_ENABLED
    ? [{ href: "/admin/orders", label: "Đơn hàng", icon: Receipt }]
    : []),
  { href: "/admin/audit-logs", label: "Nhật ký", icon: ScrollText },
];

const INSTRUCTOR_NAV: NavItem[] = [
  { href: "/instructor", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/instructor/courses", label: "Khóa học của tôi", icon: BookOpen },
  { href: "/instructor/students", label: "Học viên", icon: UsersRound },
];

// Chosen here, not passed in: icons are functions and cannot cross the
// server → client boundary as props.
const AREAS = {
  admin: { label: "Điều hướng quản trị", items: ADMIN_NAV },
  instructor: { label: "Điều hướng giảng viên", items: INSTRUCTOR_NAV },
};

export type StaffArea = keyof typeof AREAS;

/**
 * A sidebar from 1024px. Below it, a native disclosure in the top bar names
 * the current page and opens the same links over the content, so the nav no
 * longer pushes the page down by four rows of chips. Every item stays
 * reachable without sideways scrolling (UX_PLAN.md §7.3). `footer` (the
 * site link and sign-out) joins the disclosure; the shell shows it in the
 * sidebar itself.
 *
 * Keyed on the path, the disclosure closes after each navigation.
 */
export function AdminNav({
  area = "admin",
  footer,
}: {
  area?: StaffArea;
  footer?: ReactNode;
}) {
  const pathname = usePathname();
  const { label, items } = AREAS[area];
  const home = items[0].href;
  const isCurrent = (href: string) =>
    href === home
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);
  const links = items.map((item) => (
    <Link
      key={item.href}
      href={item.href}
      aria-current={isCurrent(item.href) ? "page" : undefined}
      className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium hover:bg-muted aria-[current=page]:bg-primary-subtle aria-[current=page]:text-primary-on-subtle"
    >
      <item.icon aria-hidden="true" className="size-5" strokeWidth={1.75} />
      {item.label}
    </Link>
  ));
  const current = items.find((item) => isCurrent(item.href));

  return (
    <>
      <details key={pathname} className="group lg:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md border border-input bg-card px-3 text-sm font-medium hover:bg-muted [&::-webkit-details-marker]:hidden">
          <Menu
            aria-hidden="true"
            className="size-5 group-open:hidden"
            strokeWidth={1.75}
          />
          <X
            aria-hidden="true"
            className="hidden size-5 group-open:block"
            strokeWidth={1.75}
          />
          <span className="sr-only">Menu, đang ở: </span>
          {current?.label ?? "Menu"}
        </summary>
        <div className="absolute inset-x-0 top-full z-30 grid gap-3 border-b border-border bg-card px-4 py-3 shadow-[var(--shadow-modal)]">
          <nav aria-label={label} className="grid grid-cols-2 gap-1 sm:grid-cols-3">
            {links}
          </nav>
          {footer && (
            <div className="flex flex-wrap gap-1 border-t border-border pt-3 *:w-auto">
              {footer}
            </div>
          )}
        </div>
      </details>
      <nav aria-label={label} className="hidden gap-1 lg:flex lg:flex-col">
        {links}
      </nav>
    </>
  );
}
