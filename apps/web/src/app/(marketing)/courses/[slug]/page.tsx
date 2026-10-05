import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Suspense } from "react";
import { CourseMeta, PriceTag, Rating } from "@/components/catalog/course-card";
import { CurriculumAccordion } from "@/components/catalog/curriculum";
import { DeniedAlert } from "@/components/catalog/denied-alert";
import { EnrollCta } from "@/components/catalog/enroll-cta";
import {
  CourseAudience,
  CourseHighlights,
  CourseRequirements,
  FaqAccordion,
  InstructorCard,
  Prose,
} from "@/components/catalog/sections";
import { publicFetch, type CourseDetail } from "@/lib/catalog";
import { OPEN_GRAPH_DEFAULTS, SITE_URL } from "@/lib/site";
import { courseJsonLd, jsonLdScript } from "@/lib/structured-data";

export const revalidate = 300;

/**
 * Nothing is prerendered, so `next build` needs no API. An empty list keeps
 * `dynamicParams` on: each course renders on its first visit, then revalidates
 * every 300 s (ISR). Listing the catalog here would bake an empty one into
 * the build whenever the API is unreachable.
 */
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const course = await publicFetch<CourseDetail>(`/courses/${slug}`);
  const path = `/courses/${course.slug}`;
  return {
    title: course.title,
    description: course.subtitle ?? undefined,
    alternates: { canonical: path },
    openGraph: {
      ...OPEN_GRAPH_DEFAULTS,
      title: course.title,
      description: course.subtitle ?? undefined,
      type: "website",
      url: path,
      // Without a cover the page inherits the site's own card.
      ...(course.coverUrl ? { images: [course.coverUrl] } : {}),
    },
  };
}

export default async function CoursePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const course = await publicFetch<CourseDetail>(`/courses/${slug}`);

  return (
    <article className="page-shell grid gap-12 py-10 lg:py-14">
      <script
        type="application/ld+json"
        // Escaped by `jsonLdScript`: a title cannot close the block.
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(courseJsonLd(course, SITE_URL)),
        }}
      />
      <nav aria-label="Đường dẫn" className="text-sm text-muted-foreground">
        <ol className="flex list-none flex-wrap items-center gap-1 p-0">
          <li>
            <Link className="inline-flex min-h-11 items-center hover:text-primary-text" href="/courses">
              Khóa học
            </Link>
          </li>
          {course.category && (
            <>
              <ChevronRight
                aria-hidden="true"
                className="size-4"
                strokeWidth={1.75}
              />
              <li>
                <Link
                  className="inline-flex min-h-11 items-center hover:text-primary-text"
                  href={`/categories/${course.category.slug}`}
                >
                  {course.category.name}
                </Link>
              </li>
            </>
          )}
        </ol>
      </nav>

      <Suspense>
        <DeniedAlert courseId={course.id} />
      </Suspense>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12">
        <div className="grid content-start gap-10">
          <header className="grid gap-4">
            <h1 tabIndex={-1} className="text-4xl font-bold">
              {course.title}
            </h1>
            {course.subtitle && (
              <p className="max-w-prose text-lg text-muted-foreground">
                {course.subtitle}
              </p>
            )}
            <div className="flex min-h-6 items-center">
              <Rating
                average={course.ratingAverage}
                count={course.ratingCount}
                demoStats={course.demoStats}
                size="md"
              />
            </div>
            <CourseMeta course={course} />
          </header>

          <CourseHighlights items={course.learningOutcomes} />

          <section className="grid gap-3">
            <h2 className="text-2xl font-semibold">Mô tả khóa học</h2>
            <Prose source={course.description} />
          </section>

          <CurriculumAccordion
            sections={course.sections}
            courseSlug={course.slug}
          />

          <CourseRequirements items={course.requirements} />
          <CourseAudience items={course.targetAudience} />
          <FaqAccordion />
        </div>

        <aside className="grid h-fit content-start gap-5 lg:sticky lg:top-24">
          <div className="panel grid gap-4 p-5">
            <PriceTag
              priceVnd={course.priceVnd}
              compareAtPriceVnd={course.compareAtPriceVnd}
              size="lg"
            />
            <EnrollCta
              courseId={course.id}
              slug={course.slug}
              priceVnd={course.priceVnd}
              archived={false}
            />
            <p className="text-sm text-muted-foreground">
              Bài học thử mở cho mọi tài khoản đã đăng nhập, không cần trả phí.
            </p>
          </div>
          <InstructorCard name={course.instructorName ?? undefined} />
        </aside>
      </div>
    </article>
  );
}
