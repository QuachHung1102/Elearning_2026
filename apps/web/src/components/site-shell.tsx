import { BookOpen, Menu } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { SITE_OWNER } from "@/lib/site";
import { MainNav, UserMenu } from "./user-menu";

function Logo() {
  return (
    <Link
      href="/"
      className="inline-flex min-h-11 items-center gap-2 rounded-md font-heading text-2xl font-semibold text-primary-text"
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

/**
 * No cookie read anywhere in this tree: the marketing shell has to stay
 * statically renderable so the catalog can be cached for everyone. The
 * signed-in bits live in `MainNav` and `UserMenu`, client islands.
 */
function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card text-card-foreground">
      <div className="page-shell flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav
          className="hidden items-center gap-1 md:flex"
          aria-label="Điều hướng chính"
        >
          <MainNav className="inline-flex min-h-11 items-center rounded-md px-4 text-sm text-primary-text hover:bg-muted" />
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <UserMenu variant="desktop" />
        </div>
        <details className="relative md:hidden">
          <summary
            className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-md hover:bg-muted"
            aria-label="Mở điều hướng"
          >
            <Menu aria-hidden="true" className="size-6" strokeWidth={1.75} />
          </summary>
          <nav
            className="absolute right-0 top-full z-40 mt-2 grid w-[calc(100vw-2rem)] max-w-sm rounded-lg border border-border bg-card p-3 shadow-[var(--shadow-overlay)]"
            aria-label="Điều hướng di động"
          >
            <MainNav className="flex min-h-12 items-center rounded-md px-3 font-medium text-primary-text hover:bg-muted" />
            <UserMenu variant="mobile" />
          </nav>
        </details>
      </div>
    </header>
  );
}

const FOOTER_LINKS = [
  [
    ["Khóa học", "/courses"],
    ["Giới thiệu", "/about"],
    ["Liên hệ", "/contact"],
  ],
  [
    ["Điều khoản sử dụng", "/terms"],
    ["Chính sách bảo mật", "/privacy"],
  ],
  [
    ["Chính sách hoàn tiền", "/refund"],
    ["Chính sách thanh toán", "/payment"],
  ],
] as const;

function Footer() {
  return (
    <footer className="mt-20 bg-muted py-12">
      <div className="page-shell grid gap-6">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="grid content-start gap-4">
            <Logo />
            <p className="text-sm text-muted-foreground-strong">
              Học thực tế. Tiến bộ từng ngày.
            </p>
          </div>
          <nav className="grid gap-2 text-sm" aria-label="Liên kết cuối trang">
            {FOOTER_LINKS.map((group) => (
              <p key={group[0][1]} className="flex flex-wrap items-center gap-x-2">
                {group.map(([label, href], index) => (
                  <span key={href} className="inline-flex items-center gap-x-2">
                    {index > 0 && <span aria-hidden="true">·</span>}
                    <Link
                      className="inline-flex min-h-11 items-center text-primary-text hover:underline"
                      href={href}
                    >
                      {label}
                    </Link>
                  </span>
                ))}
              </p>
            ))}
          </nav>
        </div>
        <p className="text-xs text-muted-foreground-strong">
          © {new Date().getFullYear()} {SITE_OWNER.name}. Bảo lưu mọi quyền.
        </p>
      </div>
    </footer>
  );
}

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    // A column at least as tall as the screen, so a short page keeps its
    // footer at the bottom instead of floating above an empty band.
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main id="main" tabIndex={-1} className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}

export { Logo };
