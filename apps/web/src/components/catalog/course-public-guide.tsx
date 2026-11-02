import { ChevronDown } from "lucide-react";
import type { CourseGuide } from "@/lib/course-guides";
import type { Locale } from "@/lib/translations";

/** Describes the build without importing private lessons or worked examples. */
export function CoursePublicGuide({
  guide,
  locale,
  planned,
}: {
  guide: CourseGuide;
  locale: Locale;
  planned: boolean;
}) {
  const text = (vi: string, en: string) => (locale === "vi" ? vi : en);
  return (
    <div className="grid min-w-0 gap-10" data-course-guide={locale}>
      <section className="grid gap-4" aria-labelledby="course-overview-heading">
        <h2 id="course-overview-heading" className="text-2xl font-semibold">
          {text("Mô tả khóa học", "About the course")}
        </h2>
        <div className="prose-body grid max-w-[var(--container-prose)] gap-4">
          {guide.introduction.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </section>

      <section
        className="grid gap-4"
        aria-labelledby="course-purpose-heading"
        data-project-reason={locale}
      >
        <h2 id="course-purpose-heading" className="text-2xl font-semibold">
          {text("Vì sao có dự án này?", "Why this project?")}
        </h2>
        <div className="prose-body grid max-w-[var(--container-prose)] gap-4">
          {guide.whyThisProject.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </section>

      <section className="grid gap-4" aria-labelledby="course-build-heading">
        <h2 id="course-build-heading" className="text-2xl font-semibold">
          {text("Sản phẩm bạn sẽ xây dựng", "What you will build")}
        </h2>
        <p className="leading-relaxed">{guide.projectBrief}</p>
        <ul className="grid list-disc gap-2 pl-5">
          {guide.deliverables.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <div className="panel grid gap-3 p-5">
          <h3 className="font-semibold">
            {text("Một tình huống sử dụng", "A situation to design for")}
          </h3>
          <p className="leading-relaxed text-muted-foreground">
            {guide.scenario}
          </p>
        </div>
      </section>

      <section className="grid gap-4" aria-labelledby="course-roadmap-heading">
        <h2 id="course-roadmap-heading" className="text-2xl font-semibold">
          {planned
            ? text("Các phần dự kiến của dự án", "Planned project outline")
            : text("Bạn sẽ đi qua những gì?", "A closer look at the project")}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {planned
            ? text(
                "Đây là đề cương để bạn hiểu hướng làm. Các phần này chưa phải bài học đã mở trong tài khoản.",
                "This outline explains the intended build. These are not lessons already available inside an account.",
              )
            : text(
                "Mở từng phần để xem kiến thức và công việc sẽ thực hành. Danh sách bài học cụ thể nằm ở bên dưới.",
                "Open each part to see its focus and the work involved. The actual lesson list follows below.",
              )}
        </p>
        <div className="grid gap-3">
          {guide.chapters.map((chapter, index) => (
            <details
              key={chapter.title}
              className="panel p-5"
              open={index === 0}
            >
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 font-semibold">
                <span
                  aria-hidden="true"
                  className="shrink-0 font-mono text-sm text-primary-text"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="min-w-0 flex-1">{chapter.title}</h3>
                <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
              </summary>
              <div className="grid gap-3 pt-3">
                <p className="leading-relaxed text-muted-foreground">
                  {chapter.summary}
                </p>
                <ul className="grid list-disc gap-2 pl-5">
                  {chapter.topics.map((topic) => (
                    <li key={topic}>{topic}</li>
                  ))}
                </ul>
              </div>
            </details>
          ))}
        </div>
      </section>

      <section className="grid gap-4" aria-labelledby="course-thinking-heading">
        <h2 id="course-thinking-heading" className="text-2xl font-semibold">
          {text(
            "Thử nghĩ như người làm dự án",
            "Try thinking through the problem",
          )}
        </h2>
        <p className="leading-relaxed">{guide.practice.prompt}</p>
        <ul className="grid list-disc gap-2 pl-5">
          {guide.practice.questions.map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ul>
      </section>

      <section className="grid gap-4" aria-labelledby="course-scope-heading">
        <h2 id="course-scope-heading" className="text-2xl font-semibold">
          {planned
            ? text("Phạm vi dự kiến", "Intended scope")
            : text(
                "Phạm vi của phiên bản hiện có",
                "What the current version covers",
              )}
        </h2>
        <p className="leading-relaxed">{guide.scope}</p>
        <h3 className="font-semibold">
          {text("Hướng phát triển sau dự án", "Ideas to explore afterwards")}
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {text(
            "Các ý tưởng mở rộng để bạn tự chọn thử; không phải tính năng đã hoàn thành trong phiên bản hiện có.",
            "Optional directions to investigate, rather than features already completed in the current version.",
          )}
        </p>
        <ul className="grid list-disc gap-2 pl-5">
          {guide.extensions.map((idea) => (
            <li key={idea}>{idea}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
