"use client";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { translate, type Locale } from "@/lib/translations";

type LanguageContext = {
  locale: Locale;
  text: (vi: string, en?: string) => string;
  setLocale: (locale: Locale) => void;
};
const Language = createContext<LanguageContext | null>(null);
export function LanguageProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const [locale, updateLocale] = useState(initialLocale);
  const router = useRouter();
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const value = useMemo<LanguageContext>(
    () => ({
      locale,
      text: (vi, en) => translate(locale, vi, en),
      setLocale: (next) => {
        updateLocale(next);
        document.cookie = `codingbuddy-language=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
        router.refresh();
      },
    }),
    [locale, router],
  );
  return <Language.Provider value={value}>{children}</Language.Provider>;
}
export function useLanguage() {
  const context = useContext(Language);
  return (
    context ?? {
      locale: "vi" as const,
      text: (vi: string, en?: string) => translate("vi", vi, en),
      setLocale: () => {},
    }
  );
}
export function LanguageSwitch() {
  const { locale, setLocale } = useLanguage();
  return (
    <div
      className="language-switch"
      role="group"
      aria-label="Language / Ngôn ngữ"
    >
      {(["vi", "en"] as const).map((language) => (
        <button
          key={language}
          type="button"
          lang={language}
          aria-label={language === "vi" ? "Tiếng Việt" : "English"}
          aria-pressed={locale === language}
          onClick={() => setLocale(language)}
        >
          {language.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

/** Keeps shared, server-rendered interface copy in sync with the language switch. */
export function UiText({ value, en }: { value: string; en?: string }) {
  const { text } = useLanguage();
  return <>{text(value, en)}</>;
}
