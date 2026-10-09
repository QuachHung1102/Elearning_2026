"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@/lib/session";
import { LEARNER_HOME } from "@/lib/routes";
import { CHECKOUT_ENABLED } from "@/lib/orders";
import { LogoutButton } from "./logout-button";
import { whoAmI } from "@/lib/viewer";
import { buttonClass } from "./ui/button";

/**
 * The header must not read cookies: doing so makes every marketing page
 * dynamic, and the catalog is meant to be prerendered and cached
 * (UX_PLAN.md §2.2). Who is signed in is resolved after hydration, inside a
 * slot with a reserved height so nothing shifts.
 */
function useViewer() {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    whoAmI().then((result) => {
      if (active) setUser(result);
    });
    return () => {
      active = false;
    };
  }, []);

  return user;
}

const GUEST_LINKS = [
  ["Khóa học", "/courses"],
  ["Giới thiệu", "/about"],
  ["Liên hệ", "/contact"],
] as const;

const LEARNER_LINKS = [
  ["Khóa học", "/courses"],
  ["Khóa học của tôi", LEARNER_HOME],
  ...(CHECKOUT_ENABLED ? ([["Đơn hàng", "/account/orders"]] as const) : []),
] as const;

/**
 * The header's links: a guest's until the viewer is known, then a signed-in
 * learner's (the design's "Điều hướng học viên"). Same count, so the swap
 * barely moves anything.
 */
export function MainNav({ className }: { className: string }) {
  const user = useViewer();
  return (user ? LEARNER_LINKS : GUEST_LINKS).map(([label, href]) => (
    <Link key={href} href={href} className={className}>
      {label}
    </Link>
  ));
}

export function UserMenu({ variant }: { variant: "desktop" | "mobile" }) {
  const user = useViewer();

  if (user === undefined) {
    return <div className="min-h-11 min-w-40" aria-hidden="true" />;
  }

  if (!user) {
    return variant === "desktop" ? (
      <div className="flex items-center gap-2">
        <Link href="/login" className={buttonClass("ghost")}>
          Đăng nhập
        </Link>
        <Link href="/register" className={buttonClass("primary")}>
          Đăng ký
        </Link>
      </div>
    ) : (
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Link href="/login" className={buttonClass("outline")}>
          Đăng nhập
        </Link>
        <Link href="/register" className={buttonClass("primary")}>
          Đăng ký
        </Link>
      </div>
    );
  }

  return (
    <details className="relative">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md border border-input bg-card px-4 text-sm font-semibold hover:border-primary">
        <span className="max-w-36 truncate">{user.displayName}</span>
        <ChevronDown aria-hidden="true" className="size-4" strokeWidth={1.75} />
      </summary>
      <div className="absolute right-0 top-full z-40 mt-2 grid w-56 rounded-lg border border-border bg-card p-2 shadow-[var(--shadow-overlay)]">
        <Link
          className="flex min-h-11 items-center rounded-md px-3 text-sm hover:bg-muted"
          href="/account"
        >
          Hồ sơ
        </Link>
        <Link
          className="flex min-h-11 items-center rounded-md px-3 text-sm hover:bg-muted"
          href="/account/password"
        >
          Đổi mật khẩu
        </Link>
        <Link
          className="flex min-h-11 items-center rounded-md px-3 text-sm hover:bg-muted"
          href="/account/sessions"
        >
          Phiên đăng nhập
        </Link>
        {CHECKOUT_ENABLED && (
          <Link
            className="flex min-h-11 items-center rounded-md px-3 text-sm hover:bg-muted"
            href="/account/orders"
          >
            Đơn hàng
          </Link>
        )}
        {user.role === "INSTRUCTOR" && (
          <Link
            className="flex min-h-11 items-center rounded-md px-3 text-sm hover:bg-muted"
            href="/instructor"
          >
            Giảng viên
          </Link>
        )}
        {user.role === "ADMIN" && (
          <Link
            className="flex min-h-11 items-center rounded-md px-3 text-sm hover:bg-muted"
            href="/admin"
          >
            Quản trị
          </Link>
        )}
        <div className="my-1 border-t border-border" />
        <LogoutButton />
      </div>
    </details>
  );
}
