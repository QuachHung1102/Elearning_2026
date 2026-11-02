import type { Metadata } from "next";
import { Be_Vietnam_Pro, IBM_Plex_Mono } from "next/font/google";
import { RouteAnnouncer } from "@/components/route-announcer";
import { Toaster } from "@/components/ui/toast";
import { LanguageProvider } from "@/components/language-provider";
import { getLocale } from "@/lib/locale";
import { OPEN_GRAPH_DEFAULTS, SITE_URL } from "@/lib/site";
import "./globals.css";
const vietnam = Be_Vietnam_Pro({
  variable: "--font-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});
const mono = IBM_Plex_Mono({
  variable: "--font-code",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500"],
  display: "swap",
});
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default:
        locale === "vi"
          ? "The CodingBuddy · Cùng học, cùng làm"
          : "The CodingBuddy · Learn and make together",
      template: "%s · The CodingBuddy",
    },
    description:
      locale === "vi"
        ? "Cùng Hải Nam học lập trình qua những dự án nhỏ có thể giúp ích cho người khác. Dành cho học sinh 10–15 tuổi."
        : "Learn to code with Hải Nam through small projects that can help someone. For students aged 10–15.",
    openGraph: {
      ...OPEN_GRAPH_DEFAULTS,
      locale: locale === "vi" ? "vi_VN" : "en_US",
      type: "website",
    },
  };
}
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      data-scroll-behavior="smooth"
      className={`${vietnam.variable} ${mono.variable}`}
    >
      <body>
        <LanguageProvider initialLocale={locale}>
          <a
            href="#main"
            className="fixed left-4 top-4 z-50 -translate-y-24 rounded-md bg-primary-strong px-4 py-3 font-semibold text-primary-foreground transition-transform focus:translate-y-0"
          >
            {locale === "vi"
              ? "Bỏ qua và tới nội dung chính"
              : "Skip to main content"}
          </a>
          {children}
          <RouteAnnouncer />
          <Toaster />
        </LanguageProvider>
      </body>
    </html>
  );
}
