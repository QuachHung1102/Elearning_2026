import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Suspense } from "react";
import {
  CourseMeta,
  Cover,
  PriceTag,
  Rating,
} from "@/components/catalog/course-card";
import { UiText } from "@/components/language-provider";
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
import { getLocale } from "@/lib/locale";
import { projectCourse, projectCopy } from "@/lib/project-courses";
import { courseGuide } from "@/lib/course-guides";
import { CoursePublicGuide } from "@/components/catalog/course-public-guide";

// Render the page per request for its saved language preference. Course data
// keeps the explicit shared cache configured by publicFetch.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const course = await publicFetch<CourseDetail>(`/courses/${slug}`);
  const path = `/courses/${course.slug}`;
  const copy = projectCopy(slug, await getLocale());
  return {
    title: copy?.title ?? course.title,
    description: copy?.subtitle ?? course.subtitle ?? undefined,
    alternates: { canonical: path },
    openGraph: {
      ...OPEN_GRAPH_DEFAULTS,
      title: copy?.title ?? course.title,
      description: copy?.subtitle ?? course.subtitle ?? undefined,
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
  const locale = await getLocale();
  const project = projectCourse(slug);
  const guide = courseGuide(slug, locale);
  const copy = projectCopy(slug, locale);
  const structured = courseJsonLd(course, SITE_URL);
  if (project?.availability === "planned") delete structured.offers;

  return (
    <article className="course-detail page-shell grid gap-8 py-10 lg:py-14">
      <script
        type="application/ld+json"
        // Escaped by `jsonLdScript`: a title cannot close the block.
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(structured),
        }}
      />
      <nav aria-label="Đường dẫn" className="text-sm text-muted-foreground">
        <ol className="flex list-none flex-wrap items-center gap-1 p-0">
          <li>
            <Link
              className="inline-flex min-h-11 items-center hover:text-primary-text"
              href="/courses"
            >
              <UiText value="Lộ trình học" />
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

      <div className="course-detail-main grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12">
        <div className="grid content-start gap-10">
          <header className="grid gap-4">
            <h1
              tabIndex={-1}
              className="course-detail-title text-4xl font-bold"
            >
              {copy?.title ?? course.title}
            </h1>
            {course.subtitle && (
              <p className="max-w-prose text-lg text-muted-foreground">
                {copy?.subtitle ?? course.subtitle}
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
            {project && (
              <div className="lesson-project-context">
                <p className="course-format-label">
                  <UiText
                    value={
                      project.publicTrial
                        ? "DỰ ÁN HỌC THỬ MIỄN PHÍ"
                        : project.availability === "available"
                          ? "ĐANG NHẬN ĐĂNG KÝ"
                          : "DỰ ÁN SẮP CÓ"
                    }
                    en={
                      project.publicTrial
                        ? "FREE TRIAL PROJECT"
                        : project.availability === "available"
                          ? "ENROLLMENT OPEN"
                          : "UPCOMING PROJECT"
                    }
                  />
                </p>
                <p>
                  <UiText
                    value={project.delivery.vi}
                    en={project.delivery.en}
                  />
                </p>
                {project.publicTrial && (
                  <div className="lesson-project-files mt-3">
                    {project.downloads.map((file) => (
                      <a
                        key={file}
                        href={`/downloads/projects/${file}`}
                        download
                      >
                        {file} ↓
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
            <p className="text-xs leading-relaxed text-muted-foreground">
              <UiText
                value="Nội dung bài học giữ ngôn ngữ gốc của người dạy."
                en="Lesson content keeps its original teaching language."
              />
            </p>
            {course.demoStats && (
              <p className="rounded-lg bg-accent-subtle p-4 text-sm leading-relaxed text-on-accent-subtle">
                <UiText
                  value="Đây là nội dung mẫu của hệ thống khóa học. Chuỗi video riêng của Hải Nam đang được chuẩn bị."
                  en="This is sample course content. Hải Nam’s own video series is in preparation."
                />
              </p>
            )}
          </header>

          {(guide || project?.availability !== "planned") && (
            <CourseHighlights
              items={guide?.outcomes ?? course.learningOutcomes}
            />
          )}

          {guide ? (
            <CoursePublicGuide
              guide={guide}
              locale={locale}
              planned={project?.availability === "planned"}
            />
          ) : (
            <section className="grid gap-3">
              <h2 className="text-2xl font-semibold">
                <UiText
                  value={
                    project?.availability === "planned"
                      ? "Sản phẩm bạn sẽ xây dựng"
                      : "Mô tả khóa học"
                  }
                  en={
                    project?.availability === "planned"
                      ? "What you will build"
                      : "About the course"
                  }
                />
              </h2>
              {project?.availability === "planned" ? (
                <ul className="grid gap-3 pl-5 list-disc">
                  {(project.deliverables?.[locale] ?? project.outcomes).map(
                    (item) => (
                      <li key={item}>{item}</li>
                    ),
                  )}
                </ul>
              ) : (
                <Prose source={course.description} />
              )}
            </section>
          )}

          {project?.availability === "planned" ? (
            !guide && (
              <section className="grid gap-3">
                <h2 className="text-2xl font-semibold">
                  <UiText value="Các mốc dự kiến" en="Planned milestones" />
                </h2>
                <p className="text-sm text-muted-foreground">
                  <UiText
                    value="Phạm vi có thể điều chỉnh khi biên soạn bài học. Đây chưa phải chương trình học đã hoàn thành."
                    en="The scope may evolve during lesson development. This is a project outline; lessons are not available yet."
                  />
                </p>
                <ol className="planned-milestones">
                  {project.milestones?.map((item, index) => (
                    <li key={item}>
                      <span>0{index + 1}</span>
                      {item}
                    </li>
                  ))}
                </ol>
              </section>
            )
          ) : (
            <CurriculumAccordion
              sections={course.sections}
              courseSlug={course.slug}
            />
          )}

          <CourseRequirements
            items={guide?.requirements ?? course.requirements}
          />
          <CourseAudience items={guide?.audience ?? course.targetAudience} />
          <FaqAccordion entries={guide?.faq} />
        </div>

        <aside className="grid h-fit content-start gap-5 lg:sticky lg:top-24">
          <div className="course-enrollment panel grid gap-4 overflow-hidden p-5">
            <Cover course={course} />
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
              <UiText
                value={
                  project?.publicTrial
                    ? "Dự án tủ sách mở miễn phí cho mọi người."
                    : project?.availability === "available"
                      ? "Đăng ký trực tiếp với Nam qua Zalo. Sau khi xác nhận, Nam cấp quyền cho tài khoản của bạn."
                      : "Dự án có phí đang chuẩn bị. Nhắn Nam nếu bạn muốn tìm hiểu phạm vi dự kiến."
                }
                en={
                  project?.publicTrial
                    ? "The book project is free and open to everyone."
                    : project?.availability === "available"
                      ? "Arrange enrollment with Nam through Zalo. After confirmation, Nam grants access to your account."
                      : "A paid project in preparation. Contact Nam to ask about the intended scope."
                }
              />
            </p>
          </div>
          <InstructorCard name={course.instructorName ?? undefined} />
        </aside>
      </div>
    </article>
  );
}
