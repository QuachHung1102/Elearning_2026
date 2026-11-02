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
import { usePathname } from "next/navigation";
import { useLanguage } from "./language-provider";

/**
 * Resolve the viewer after hydration, inside a reserved header slot.
 * Public page content is rendered in the visitor's chosen language.
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
  ["Lộ trình học", "/courses"],
  ["Bài thực hành", "/workshop"],
  ["Giới thiệu", "/about"],
  ["Dấu ấn sẻ chia", "/impact"],

] as const;

const LEARNER_LINKS = [
  ["Khóa học", "/courses"],
  ["Khóa học của tôi", LEARNER_HOME],
  ["Bài thực hành", "/workshop"],
  ["Dấu ấn sẻ chia", "/impact"],

  ...(CHECKOUT_ENABLED ? ([["Đơn hàng", "/account/orders"]] as const) : []),
] as const;

/**
 * The header's links: a guest's until the viewer is known, then a signed-in
 * learner's (the design's "Điều hướng học viên"). Same count, so the swap
 * barely moves anything.
 */
export function MainNav({ className }: { className: string }) {
  const user = useViewer();
  const { text } = useLanguage();
  const pathname = usePathname();
  return (user ? LEARNER_LINKS : GUEST_LINKS).map(([label, href]) => (
    <Link
      key={href}
      href={href}
      className={className}
      aria-current={pathname === href ? "page" : undefined}
      onClick={(event) =>
        event.currentTarget.closest("details")?.removeAttribute("open")
      }
    >
      {text(label, label === "Bài thực hành" ? "Practice lesson" : undefined)}
    </Link>
  ));
}

export function UserMenu({ variant }: { variant: "desktop" | "mobile" }) {
  const user = useViewer();
  const { text } = useLanguage();

  if (user === undefined) {
    return <div className="min-h-11 min-w-24" aria-hidden="true" />;
  }

  if (!user) {
    return variant === "desktop" ? (
      <Link href="/login" className={buttonClass("outline")}>
        {text("Đăng nhập")}
      </Link>
    ) : (
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Link href="/login" className={buttonClass("outline")}>
          {text("Đăng nhập")}
        </Link>
        <Link href="/register" className={buttonClass("primary")}>
          {text("Đăng ký")}
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
          {text("Hồ sơ")}
        </Link>
        <Link
          className="flex min-h-11 items-center rounded-md px-3 text-sm hover:bg-muted"
          href="/account/password"
        >
          {text("Đổi mật khẩu")}
        </Link>
        <Link
          className="flex min-h-11 items-center rounded-md px-3 text-sm hover:bg-muted"
          href="/account/sessions"
        >
          {text("Phiên đăng nhập")}
        </Link>
        {CHECKOUT_ENABLED && (
          <Link
            className="flex min-h-11 items-center rounded-md px-3 text-sm hover:bg-muted"
            href="/account/orders"
          >
            {text("Đơn hàng")}
          </Link>
        )}
        {user.role === "INSTRUCTOR" && (
          <Link
            className="flex min-h-11 items-center rounded-md px-3 text-sm hover:bg-muted"
            href="/instructor"
          >
            {text("Giảng viên")}
          </Link>
        )}
        {user.role === "ADMIN" && (
          <Link
            className="flex min-h-11 items-center rounded-md px-3 text-sm hover:bg-muted"
            href="/admin"
          >
            {text("Quản trị")}
          </Link>
        )}
        <div className="my-1 border-t border-border" />
        <LogoutButton />
      </div>
    </details>
  );
}
