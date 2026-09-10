"use client";

import { UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@/lib/session";
import { LogoutButton } from "./logout-button";
import { whoAmI } from "@/lib/viewer";
import { buttonClass } from "./ui/button";

/**
 * The header must not read cookies: doing so makes every marketing page
 * dynamic, and the catalog is meant to be prerendered and cached
 * (UX_PLAN.md §2.2). Who is signed in is resolved after hydration, inside a
 * slot with a reserved height so nothing shifts.
 */
export function UserMenu({ variant }: { variant: "desktop" | "mobile" }) {
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
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md px-3 text-sm font-semibold hover:bg-muted">
        <UserRound aria-hidden="true" className="size-5" strokeWidth={1.75} />
        <span className="max-w-36 truncate">{user.displayName}</span>
      </summary>
      <div className="absolute right-0 top-full z-40 mt-2 grid w-56 rounded-lg border border-border bg-card p-2 shadow-[var(--shadow-overlay)] dark:border-white/10">
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
