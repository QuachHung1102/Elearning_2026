"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  ["Hồ sơ", "/account"],
  ["Đổi mật khẩu", "/account/password"],
  ["Phiên đăng nhập", "/account/sessions"],
] as const;

export function AccountNav() {
  const pathname = usePathname();

  return (
    <nav
      className="mb-8 flex gap-1 overflow-x-auto border-b border-border"
      aria-label="Tài khoản"
    >
      {items.map(([label, href]) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname === href ? "page" : undefined}
          className="min-h-11 shrink-0 border-b-2 border-transparent px-3 py-2 text-sm font-semibold hover:border-primary hover:text-primary-text aria-[current=page]:border-primary aria-[current=page]:text-primary-text"
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
