import { Menu, ArrowUpRight, CodeXml } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { getLocale } from "@/lib/locale";
import { translate } from "@/lib/translations";
import { LanguageSwitch } from "./language-provider";
import { MainNav, UserMenu } from "./user-menu";
export function Logo() {
  return (
    <Link href="/" className="buddy-logo" aria-label="The CodingBuddy — Home">
      <span className="course-brand-mark" aria-hidden="true">
        <CodeXml size={29} strokeWidth={2.2} />
      </span>
      <span className="brand-type">
        <small>THE</small>
        <span>
          CodingBuddy<span className="logo-period">.</span>
        </span>
      </span>
    </Link>
  );
}
async function Header() {
  const locale = await getLocale();
  return (
    <header className="site-header">
      <div className="brand-ribbon">
        {translate(
          locale,
          "Học công nghệ để giúp ích.",
          "Learn technology. Make it useful.",
        )}
      </div>
      <div className="page-shell header-inner">
        <Logo />
        <nav
          className="desktop-navigation"
          aria-label={translate(locale, "Điều hướng chính", "Main navigation")}
        >
          <MainNav className="header-link" />
        </nav>
        <div className="header-account">
          <LanguageSwitch />
          <div className="desktop-user">
            <UserMenu variant="desktop" />
          </div>
        </div>
        <details className="mobile-navigation">
          <summary
            aria-label={translate(locale, "Mở điều hướng", "Open navigation")}
          >
            <Menu aria-hidden="true" size={23} />
          </summary>
          <nav
            aria-label={translate(
              locale,
              "Điều hướng di động",
              "Mobile navigation",
            )}
          >
            <MainNav className="header-link" />
            <UserMenu variant="mobile" />
          </nav>
        </details>
      </div>
    </header>
  );
}
async function Footer() {
  const locale = await getLocale();
  const text = (vi: string, en?: string) => translate(locale, vi, en);
  return (
    <footer className="site-footer">
      <div className="page-shell">
        <div className="footer-top">
          <div>
            <Logo />
            <p>
              {text(
                "Một nơi nhỏ để học và làm điều có ích.",
                "A small place to learn and make something useful.",
              )}
            </p>
          </div>
          <Link className="footer-contact" href="/contact">
            {text(
              "Cùng bắt đầu một cuộc trò chuyện",
              "Let’s start a conversation",
            )}{" "}
            <ArrowUpRight aria-hidden="true" size={22} />
          </Link>
        </div>
        <div className="footer-bottom">
          <p>
            © {new Date().getFullYear()} The CodingBuddy <span>·</span>{" "}
            {text("Một dự án của Hải Nam", "A project by Hải Nam")}
          </p>
          <nav aria-label={text("Liên kết cuối trang", "Footer links")}>
            {[
              ["Điều khoản sử dụng", "/terms"],
              ["Chính sách bảo mật", "/privacy"],
              ["Liên hệ", "/contact"],
              ["Dấu ấn sẻ chia", "/impact"],

            ].map(([label, href]) => (
              <Link key={href} href={href}>
                {text(label)}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="site-frame">
      <Header />
      <main id="main" tabIndex={-1} className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
