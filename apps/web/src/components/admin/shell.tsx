import type { ReactNode } from "react";
import { Logo } from "@/components/site-shell";
import { LogoutButton } from "@/components/logout-button";
import { Skeleton } from "@/components/ui/feedback";
import { formatNumber } from "@/lib/format";
import { AdminNav } from "./admin-nav";

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh grid-cols-[minmax(0,1fr)] grid-rows-[auto_1fr] lg:grid-cols-[15rem_minmax(0,1fr)] lg:grid-rows-1">
      <header className="border-b border-border bg-card lg:border-b-0 lg:border-r">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 lg:flex-col lg:flex-nowrap lg:items-stretch lg:gap-6 lg:py-6">
          <Logo />
          <AdminNav />
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
