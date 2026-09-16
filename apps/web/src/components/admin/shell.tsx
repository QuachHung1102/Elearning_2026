import {
  BookOpen,
  FolderTree,
  LayoutDashboard,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/site-shell";
import { LogoutButton } from "@/components/logout-button";
import { Skeleton } from "@/components/ui/feedback";
import { formatNumber } from "@/lib/format";

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/admin", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/admin/categories", label: "Danh mục", icon: FolderTree },
  { href: "/admin/courses", label: "Khóa học", icon: BookOpen },
];

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh grid-rows-[auto_1fr] lg:grid-cols-[15rem_minmax(0,1fr)] lg:grid-rows-1">
      <header className="border-b border-border bg-card lg:border-b-0 lg:border-r">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 lg:flex-col lg:flex-nowrap lg:items-stretch lg:gap-6 lg:py-6">
          <Logo />
          <nav
            aria-label="Điều hướng quản trị"
            className="order-last flex w-full min-w-0 gap-1 overflow-x-auto lg:order-none lg:w-auto lg:flex-col lg:overflow-visible"
          >
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium hover:bg-muted"
              >
                <item.icon
                  aria-hidden="true"
                  className="size-5"
                  strokeWidth={1.75}
                />
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2 lg:mt-auto lg:flex-col lg:items-stretch">
            <LogoutButton />
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="min-w-0 px-4 py-8 lg:px-8">
        {children}
      </main>
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="panel grid gap-1 p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-heading text-3xl font-bold">
        {typeof value === "number" ? formatNumber(value) : value}
      </p>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="grid gap-3" aria-busy="true">
      <span className="sr-only">Đang tải…</span>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-14 w-full" />
      ))}
    </div>
  );
}
