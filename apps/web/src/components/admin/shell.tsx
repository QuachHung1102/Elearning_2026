import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/site-shell";
import { LogoutButton } from "@/components/logout-button";
import { formatNumber } from "@/lib/format";
import { AdminNav, type StaffArea } from "./admin-nav";

const AREA_NAME: Record<StaffArea, string> = {
  admin: "Quản trị",
  instructor: "Giảng viên",
};

export function AdminShell({
  children,
  area = "admin",
}: {
  children: ReactNode;
  area?: StaffArea;
}) {
  const footer = (
    <>
      <Link
        href="/"
        className="flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-medium hover:bg-muted"
      >
        <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.75} />
        Xem website
      </Link>
      <LogoutButton />
    </>
  );
  return (
    <div className="grid min-h-dvh grid-cols-[minmax(0,1fr)] grid-rows-[auto_1fr] lg:grid-cols-[15rem_minmax(0,1fr)] lg:grid-rows-1">
      <header className="relative border-b border-border bg-card lg:border-b-0 lg:border-r">
        {/* The sidebar stays in view while a long list scrolls (lg only). */}
        <div className="flex items-center justify-between gap-3 px-4 py-2 lg:sticky lg:top-0 lg:max-h-dvh lg:flex-col lg:items-stretch lg:gap-6 lg:overflow-y-auto lg:py-6">
          <div className="grid lg:gap-1 lg:px-3">
            <Logo />
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground-strong">
              {AREA_NAME[area]}
            </p>
          </div>
          <AdminNav area={area} footer={footer} />
          <div className="hidden lg:mt-auto lg:grid lg:gap-1 lg:border-t lg:border-border lg:pt-4">
            {footer}
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="min-w-0 px-4 py-6 sm:py-8 lg:px-8">
        <div className="mx-auto max-w-7xl">{children}</div>
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
    // Two columns on a phone wrap some labels: two lines reserved there keep
    // the values of a row on one line, with or without a hint below.
    <div className="panel grid content-start gap-1 p-4 sm:p-5">
      <p className="min-h-[2lh] text-sm text-muted-foreground sm:min-h-0">
        {label}
      </p>
      <p className="font-heading text-2xl font-bold tabular-nums sm:text-3xl">
        {typeof value === "number" ? formatNumber(value) : value}
      </p>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}
