import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Prose } from "@/components/catalog/sections";
import { Alert } from "@/components/ui/feedback";
import { LEGAL, type LegalPage } from "@/content/legal";

/** The four policy pages share one route: same shell, different Markdown. */
export function generateStaticParams() {
  return Object.keys(LEGAL).map((legal) => ({ legal }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ legal: string }>;
}): Promise<Metadata> {
  const page = LEGAL[(await params).legal as LegalPage["slug"]];
  if (!page) return {};
  return {
    title: page.title,
    // A draft policy must never be indexed as if it were in force.
    robots: page.isPlaceholder ? { index: false, follow: false } : undefined,
  };
}

export default async function LegalPageView({
  params,
}: {
  params: Promise<{ legal: string }>;
}) {
  const page = LEGAL[(await params).legal as LegalPage["slug"]];
  if (!page) notFound();

  return (
    <div className="page-shell grid max-w-3xl gap-6 py-12 lg:py-16">
      <h1 tabIndex={-1} className="text-4xl font-bold">
        {page.title}
      </h1>
      {page.isPlaceholder && (
        <Alert variant="warning" title="BẢN NHÁP">
          Nội dung này chưa có hiệu lực pháp lý, chỉ dùng để demo.
        </Alert>
      )}
      <Prose source={page.body} />
    </div>
  );
}
