import { BookOpen, Menu, UserRound } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { getSession, type User } from "@/lib/session";
import { SITE_OWNER } from "@/lib/site";
import { LogoutButton } from "./logout-button";
import { ThemeToggle } from "./theme-toggle";
import { buttonClass } from "./ui/button";

function Logo() {
  return (
    <Link
      href="/"
      className="inline-flex min-h-11 items-center gap-2 rounded-md font-heading text-lg font-bold"
    >
      <BookOpen
        aria-hidden="true"
        className="size-6 text-primary-text"
        strokeWidth={1.75}
      />
      E-learning
    </Link>
  );
}

function UserNavigation({ user }: { user: User }) {
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

function Header({ user }: { user: User | null }) {
  const links = user
    ? [
        ["Khóa học", "/courses"],
        ["Khóa học của tôi", "/my-courses"],
      ]
    : [
        ["Khóa học", "/courses"],
        ["Danh mục", "/courses#danh-muc"],
        ["Giới thiệu", "/about"],
        ["Liên hệ", "/contact"],
      ];

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card text-card-foreground">
      <div className="page-shell flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav
          className="hidden items-center gap-1 md:flex"
          aria-label="Điều hướng chính"
        >
          {links.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium hover:bg-muted"
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          {user ? (
            <UserNavigation user={user} />
          ) : (
            <>
              <Link href="/login" className={buttonClass("ghost")}>
                Đăng nhập
              </Link>
              <Link href="/register" className={buttonClass("primary")}>
                Đăng ký
              </Link>
            </>
          )}
        </div>
        <details className="relative md:hidden">
          <summary
            className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-md hover:bg-muted"
            aria-label="Mở điều hướng"
          >
            <Menu aria-hidden="true" className="size-6" strokeWidth={1.75} />
          </summary>
          <nav
            className="absolute right-0 top-full z-40 mt-2 grid w-[calc(100vw-2rem)] max-w-sm rounded-lg border border-border bg-card p-3 shadow-[var(--shadow-overlay)] dark:border-white/10"
            aria-label="Điều hướng di động"
          >
            {links.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className="flex min-h-12 items-center rounded-md px-3 font-medium hover:bg-muted"
              >
                {label}
              </Link>
            ))}
            {user ? (
              <UserNavigation user={user} />
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Link href="/login" className={buttonClass("outline")}>
                  Đăng nhập
                </Link>
                <Link href="/register" className={buttonClass("primary")}>
                  Đăng ký
                </Link>
              </div>
            )}
            <div className="mt-2 border-t border-border pt-2">
              <ThemeToggle />
            </div>
          </nav>
        </details>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-20 border-t border-border bg-card py-8 text-card-foreground">
      <div className="page-shell flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-heading font-semibold">{SITE_OWNER.name}</p>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Bảo lưu mọi quyền.
          </p>
        </div>
        <nav
          className="flex flex-wrap gap-x-5 gap-y-2 text-sm"
          aria-label="Pháp lý"
        >
          <Link
            className="inline-flex min-h-11 items-center py-2 hover:text-primary-text"
            href="/terms"
          >
            Điều khoản sử dụng
          </Link>
          <Link
            className="inline-flex min-h-11 items-center py-2 hover:text-primary-text"
            href="/privacy"
          >
            Chính sách bảo mật
          </Link>
        </nav>
      </div>
    </footer>
  );
}

export async function SiteShell({ children }: { children: ReactNode }) {
  let user: User | null = null;
  try {
    user = await getSession();
  } catch {
    user = null;
  }
  return (
    <>
      <Header user={user} />
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <Footer />
    </>
  );
}

export { Logo };
