"use client";

import {
  BookOpen,
  FolderTree,
  KeyRound,
  LayoutDashboard,
  Receipt,
  ScrollText,
  UsersRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
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
 * Wraps below 1024px instead of scrolling sideways, so no item hides off
 * screen (UX_PLAN.md §7.3). ponytail: stand-in for the §7.1 drawer and
 * icon-only rail; build those when the nav outgrows two rows.
 */
export function AdminNav({ area = "admin" }: { area?: StaffArea }) {
  const pathname = usePathname();
  const { label, items } = AREAS[area];
  const home = items[0].href;
  return (
    <nav
      aria-label={label}
      className="order-last flex w-full min-w-0 flex-wrap gap-1 lg:order-none lg:w-auto lg:flex-col lg:flex-nowrap"
    >
      {items.map((item) => {
        const current =
          item.href === home
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
