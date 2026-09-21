"use client";

import {
  BookOpen,
  FolderTree,
  KeyRound,
  LayoutDashboard,
  ScrollText,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/admin", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/admin/courses", label: "Khóa học", icon: BookOpen },
  { href: "/admin/categories", label: "Danh mục", icon: FolderTree },
  { href: "/admin/users", label: "Người dùng", icon: Users },
  { href: "/admin/enrollments", label: "Quyền học", icon: KeyRound },
  { href: "/admin/audit-logs", label: "Nhật ký", icon: ScrollText },
];

/**
 * Wraps below 1024px instead of scrolling sideways, so no item hides off
 * screen (UX_PLAN.md §7.3). ponytail: stand-in for the §7.1 drawer and
 * icon-only rail; build those when the nav outgrows two rows.
 */
export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Điều hướng quản trị"
      className="order-last flex w-full min-w-0 flex-wrap gap-1 lg:order-none lg:w-auto lg:flex-col lg:flex-nowrap"
    >
      {NAV.map((item) => {
        const current =
          item.href === "/admin"
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium hover:bg-muted aria-[current=page]:bg-primary-subtle aria-[current=page]:text-primary-on-subtle"
          >
            <item.icon aria-hidden="true" className="size-5" strokeWidth={1.75} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
