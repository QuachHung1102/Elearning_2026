import Link from "next/link";
import { BookOpen, Code2, PencilLine } from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "@/components/site-shell";
import { LanguageSwitch } from "@/components/language-provider";
import { getLocale } from "@/lib/locale";
import { translate } from "@/lib/translations";

export default async function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  const locale = await getLocale();
  const t = (vi: string, en?: string) => translate(locale, vi, en);
  return (
    <div className="auth-shell studio-auth">
      <header className="auth-top">
        <Logo />
        <LanguageSwitch />
      </header>
      <div className="auth-content">
        <aside className="auth-aside">
          <div className="auth-note-icon">
            <BookOpen size={25} aria-hidden="true" />
            <Code2 size={25} aria-hidden="true" />
            <PencilLine size={25} aria-hidden="true" />
          </div>
          <h2>
            {t(
              "Một nơi để hỏi.\nMột người cùng học.",
              "A place to ask.\nSomeone to learn with.",
            )}
          </h2>
          <p>
            {t(
              "Ghi nhớ điều bạn đã học, tiếp tục từ chỗ còn dang dở, và từng bước làm ra một dự án của riêng mình.",
              "Keep track of what you’ve learned, pick up where you left off, and build a project of your own, one step at a time.",
            )}
          </p>
          <Link href="/workshop" className="inline-link">
            {t(
              "Bạn cũng có thể thử bài thực hành mở",
              "You can also try the open practice lesson",
            )}
          </Link>
        </aside>
        <main id="main" tabIndex={-1} className="auth-panel studio-auth-panel">
          {children}
        </main>
      </div>
      <footer className="auth-legal">
        <Link href="/terms">{t("Điều khoản sử dụng")}</Link>
        <Link href="/privacy">{t("Chính sách bảo mật")}</Link>
      </footer>
    </div>
  );
}
