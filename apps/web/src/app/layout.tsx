import type { Metadata } from "next";
import { Inter, Lexend } from "next/font/google";
import { RouteAnnouncer } from "@/components/route-announcer";
import { Toaster } from "@/components/ui/toast";
import "./globals.css";

const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin", "vietnamese"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "E-learning",
    template: "%s · E-learning",
  },
  description: "Nền tảng khóa học trực tuyến.",
};

const designContract = `<!--
THESIS: Learning tasks should feel direct and trustworthy, never like a generic promotional template.
OWN-WORLD: Flat slate surfaces, teal identity, amber conversion actions, compact radii, crisp borders, Lexend headings, Inter body copy.
STORY: A Vietnamese learner completes identity, account, and contact tasks with visible state and a clear next action.
FIRST VIEWPORT: One focused heading and one task panel, left aligned inside a calm responsive shell; the primary action remains immediately visible.
FORM: Operate mode, plan-pinned marketplace structure, seed operate-marketplace-flat-20260904.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
-->`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="vi"
      // Lets Next switch smooth scrolling off during route transitions.
      data-scroll-behavior="smooth"
      className={`${lexend.variable} ${inter.variable}`}
    >
      <body>
        <template dangerouslySetInnerHTML={{ __html: designContract }} />
        <a
          href="#main"
          className="fixed left-4 top-4 z-50 -translate-y-24 rounded-md bg-primary-strong px-4 py-3 font-semibold text-primary-foreground transition-transform focus:translate-y-0"
        >
          Bỏ qua và tới nội dung chính
        </a>
        {children}
        <RouteAnnouncer />
        <Toaster />
      </body>
    </html>
  );
}
