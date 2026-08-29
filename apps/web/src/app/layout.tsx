import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "E-learning",
  description: "Nền tảng khóa học trực tuyến.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
