import { BookOpen, Menu } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { SITE_OWNER } from "@/lib/site";
import { UserMenu } from "./user-menu";

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

const LINKS = [
  ["Khóa học", "/courses"],
  ["Giới thiệu", "/about"],
  ["Liên hệ", "/contact"],
] as const;

/**
 * No cookie read anywhere in this tree: the marketing shell has to stay
 * statically renderable so the catalog can be cached for everyone. The
 * signed-in bits live in `UserMenu`, a client island.
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
          {LINKS.map(([label, href]) => (
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
            {LINKS.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className="flex min-h-12 items-center rounded-md px-3 font-medium hover:bg-muted"
              >
                {label}
              </Link>
            ))}
            <UserMenu variant="mobile" />
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

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <Footer />
    </>
  );
}

export { Logo };
