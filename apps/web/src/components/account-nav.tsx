"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CHECKOUT_ENABLED } from "@/lib/orders";

const items = [
  ["Hồ sơ", "/account", "Hồ sơ cá nhân", "Cập nhật tên hiển thị trong tài khoản của bạn."],
  ["Mật khẩu", "/account/password", "Đổi mật khẩu", "Chọn mật khẩu mới, rồi đăng nhập lại trên các thiết bị của bạn."],
  ["Phiên đăng nhập", "/account/sessions", "Phiên đăng nhập", "Xem các thiết bị đang đăng nhập và đăng xuất những phiên bạn không còn dùng."],
  ...(CHECKOUT_ENABLED
    ? ([["Đơn hàng", "/account/orders", "Đơn hàng của tôi", "Lịch sử mua khóa học và trạng thái thanh toán của bạn."]] as const)
    : []),
] as const;

/**
 * The section's title and tabs, above every tab's content as in the design.
 * Here rather than in each page so the loading and error states keep them. A
 * detail page (`/account/orders/[id]`) has its own title and a back link
 * instead.
 */
export function AccountNav() {
  const pathname = usePathname();
  const current = items.find(([, href]) => pathname === href);
  if (!current) return null;

  return (
    <div className="mb-8 grid gap-6">
      <div className="grid gap-2">
        <h1 tabIndex={-1} className="text-4xl font-bold">
          {current[2]}
        </h1>
        <p className="text-lg text-muted-foreground">{current[3]}</p>
      </div>
      <nav
        className="grid auto-cols-fr grid-flow-col border-b border-border"
        aria-label="Tài khoản"
      >
        {items.map(([label, href]) => (
          <Link
            key={href}
            href={href}
            aria-current={pathname === href ? "page" : undefined}
            className="-mb-px flex min-h-11 items-center justify-center border-b-2 border-transparent px-1 py-2 text-center text-sm text-muted-foreground hover:border-primary hover:text-primary-text aria-[current=page]:border-primary aria-[current=page]:text-primary-text"
          >
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
