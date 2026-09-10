import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/site-shell";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-shell">
      <header className="mx-auto w-full max-w-[calc(var(--spacing)*100)]">
        <Logo />
      </header>
      <main id="main" tabIndex={-1} className="auth-panel">
        {children}
      </main>
      <footer className="mx-auto flex min-h-11 w-full max-w-[calc(var(--spacing)*100)] flex-wrap items-center gap-x-4 text-sm text-muted-foreground">
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
      </footer>
    </div>
  );
}
