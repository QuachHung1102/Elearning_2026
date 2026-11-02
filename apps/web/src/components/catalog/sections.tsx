import {
  Check,
  Dot,
  GraduationCap,
  Search,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { Category } from "@/lib/catalog";
import { formatNumber } from "@/lib/format";
import { renderMarkdown } from "@/lib/markdown";
import { UiText } from "@/components/language-provider";
import { getLocale } from "@/lib/locale";
import { translate } from "@/lib/translations";
import { buttonClass } from "@/components/ui/button";

export function SearchHero({ courseCount }: { courseCount: number }) {
  return (
    <section className="grid content-center gap-6">
      <h1 tabIndex={-1} className="max-w-3xl text-4xl font-bold md:text-5xl">
        Học kỹ năng thực tế theo một lộ trình rõ ràng
      </h1>
      <p className="max-w-prose text-lg text-muted-foreground">
        {formatNumber(courseCount)} khóa học tiếng Việt, bài học tập trung và
        tiến độ luôn ở đúng nơi bạn dừng lại.
      </p>
      <form
        method="get"
        action="/courses"
        role="search"
        className="flex w-full max-w-2xl gap-2"
      >
        <label className="sr-only" htmlFor="hero-q">
          Tìm khóa học
        </label>
        <input
          id="hero-q"
          name="q"
          type="search"
          maxLength={100}
          placeholder="Bạn muốn học gì hôm nay"
          className="control"
        />
        <button type="submit" className={buttonClass("primary", "lg")}>
          <Search aria-hidden="true" className="size-5" strokeWidth={1.75} />
          Tìm
        </button>
      </form>
    </section>
  );
}

export function CategoryChips({ categories }: { categories: Category[] }) {
  if (categories.length === 0) return null;
  return (
    // A side panel beside the hero from lg, a chip row under it below that.
    <nav
      aria-labelledby="categories-heading"
      className="grid content-start gap-4 lg:rounded-lg lg:border lg:border-border lg:bg-card lg:p-5"
    >
      <h2 id="categories-heading" className="text-2xl font-semibold">
        Danh mục
      </h2>
      <ul className="flex list-none flex-nowrap gap-3 overflow-x-auto p-0 pb-2 md:flex-wrap md:overflow-visible md:pb-0 lg:grid lg:grid-cols-2 lg:gap-2">
        {categories.map((category) => (
          <li key={category.id} className="shrink-0">
            <Link
              href={`/categories/${category.slug}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 text-sm font-medium hover:border-primary hover:text-primary-text lg:flex lg:justify-between lg:rounded-md lg:px-3"
            >
              {category.name}
              <span className="text-muted-foreground">
                {formatNumber(category.courseCount)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function TrustStats({
  courseCount,
  lessonCount,
  studentCount,
  studentLabel = "Học viên",
}: {
  courseCount: number;
  lessonCount: number;
  studentCount: number;
  studentLabel?: string;
}) {
  const tiles = [
    { label: "Khóa học đang mở", value: courseCount },
    { label: "Bài học", value: lessonCount },
    { label: studentLabel, value: studentCount },
  ];
  return (
    <section className="grid gap-4" aria-labelledby="trust-heading">
      <h2 id="trust-heading" className="text-2xl font-semibold">
        Con số hiện tại
      </h2>
      <dl className="grid gap-4 sm:grid-cols-3">
        {tiles.map((tile) => (
          <div key={tile.label} className="panel p-5">
            <dt className="text-sm text-muted-foreground">{tile.label}</dt>
            <dd className="mt-1 font-heading text-3xl font-bold">
              {formatNumber(tile.value)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export async function InstructorCard({
  variant = "compact",
  name,
}: {
  variant?: "compact" | "full";
  /** The course's own instructor, or the site founder when absent. */
  name?: string;
}) {
  const locale = await getLocale();
  const text = (vi: string, en?: string) => translate(locale, vi, en);
  return (
    <section className="panel grid gap-3 p-6" aria-labelledby="owner-heading">
      <GraduationCap
        aria-hidden="true"
        className="size-10 text-primary-text"
        strokeWidth={1.75}
      />
      <h2 id="owner-heading" className="text-2xl font-semibold">
        {text("Người đứng lớp")}
      </h2>
      <p className="text-muted-foreground">
        {name
          ? text(`Người dạy khóa học: ${name}.`, `Course instructor: ${name}.`)
          : text(
              "Hải Nam · Người sáng lập CodingBuddy. Cùng học kiến thức nền tảng và thử làm những dự án có ích.",
              "Hải Nam · Founder of CodingBuddy. Learn the fundamentals together and try building something useful.",
            )}
      </p>
      {variant === "full" && !name && (
        <p className="text-muted-foreground">
          {text(
            "Mình đang chuẩn bị chuỗi video hướng dẫn làm dự án. Bạn có thể bắt đầu với bài thực hành mở.",
            "I’m preparing a project-building video series. You can begin with the open practice lesson.",
          )}
        </p>
      )}
      <Link href="/contact" className={buttonClass("outline", "md", "w-fit")}>
        {text("Liên hệ")}
      </Link>
    </section>
  );
}

export async function FaqAccordion({
  entries: courseEntries = [],
}: {
  entries?: { question: string; answer: string }[];
} = {}) {
  const locale = await getLocale();
  const text = (vi: string, en?: string) => translate(locale, vi, en);
  const entries = [
    ...courseEntries,
    {
      question: text(
        "Mình chưa biết code, bắt đầu ở đâu?",
        "I haven’t coded before. Where do I start?",
      ),
      answer: text(
        "Bạn có thể thử bài thực hành mở mà không cần tài khoản. Mỗi khóa học có phần yêu cầu để bạn biết nên chuẩn bị gì trước khi đăng ký.",
        "You can try the open practice lesson without an account. Each course lists its prerequisites so you know what to prepare before enrolling.",
      ),
    },
    {
      question: text(
        "Có thể học thử một khóa không?",
        "Can I preview a course?",
      ),
      answer: text(
        "Dự án tủ sách chia sẻ có bốn video và bài đọc miễn phí, không cần tài khoản. Năm khóa dự án có bài đọc đã mở đăng ký qua Zalo; bốn dự án khác sắp có.",
        "The book-sharing project has four free videos and written notes, with no account required. Five written project courses are open for enrollment through Zalo; four more projects are upcoming.",
      ),
    },
    {
      question: text(
        "Video và bài học dùng ngôn ngữ nào?",
        "What language are the lessons in?",
      ),
      answer: text(
        "Giao diện có tiếng Việt và tiếng Anh. Nội dung và âm thanh bài học giữ ngôn ngữ gốc của người dạy; giao diện tiếng Anh không có nghĩa video đã được dịch.",
        "The interface is available in Vietnamese and English. Lesson content and audio keep the instructor’s original language; an English interface does not mean a video has been translated.",
      ),
    },
  ];
  return (
    <section className="grid gap-4" aria-labelledby="faq-heading">
      <h2 id="faq-heading" className="text-2xl font-semibold">
        {text("Câu hỏi thường gặp")}
      </h2>
      <div className="grid gap-2">
        {entries.map((entry) => (
          <details key={entry.question} className="panel p-4">
            <summary className="flex min-h-11 cursor-pointer list-none items-center font-semibold">
              {entry.question}
            </summary>
            <p className="mt-2 text-muted-foreground">{entry.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function IconList({
  title,
  items,
  icon: Icon,
  columns,
}: {
  title: string;
  items: string[];
  icon: LucideIcon;
  columns?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <section className="grid gap-3">
      <h2 className="text-2xl font-semibold">
        <UiText value={title} />
      </h2>
      <ul
        className={`grid list-none gap-2 p-0 ${columns ? "md:grid-cols-2" : ""}`}
      >
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <Icon
              aria-hidden="true"
              className="mt-1 size-5 shrink-0 text-primary-text"
              strokeWidth={1.75}
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export const CourseHighlights = ({ items }: { items: string[] }) => (
  <IconList title="Bạn sẽ học được gì" items={items} icon={Check} columns />
);

export const CourseRequirements = ({ items }: { items: string[] }) => (
  <IconList title="Yêu cầu" items={items} icon={Dot} />
);

export const CourseAudience = ({ items }: { items: string[] }) => (
  <IconList title="Khóa học dành cho ai" items={items} icon={UserCheck} />
);

/** Renders Markdown that has already been through the allowlist sanitiser. */
export function Prose({ source }: { source: string }) {
  return (
    <div
      className="prose-body grid max-w-[var(--container-prose)] gap-4"
      dangerouslySetInnerHTML={{ __html: renderMarkdown(source) }}
    />
  );
}
