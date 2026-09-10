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
import { SITE_OWNER } from "@/lib/site";
import { buttonClass } from "@/components/ui/button";

export function SearchHero({ courseCount }: { courseCount: number }) {
  return (
    <section className="page-shell grid gap-6 py-14 lg:py-20">
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
    <nav aria-labelledby="categories-heading" className="grid gap-4">
      <h2 id="categories-heading" className="text-2xl font-semibold">
        Danh mục
      </h2>
      <ul className="flex list-none flex-nowrap gap-3 overflow-x-auto p-0 pb-2 md:flex-wrap md:overflow-visible md:pb-0">
        {categories.map((category) => (
          <li key={category.id} className="shrink-0">
            <Link
              href={`/categories/${category.slug}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 text-sm font-medium hover:border-primary hover:text-primary-text"
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

export function InstructorCard({ variant = "compact" }: { variant?: "compact" | "full" }) {
  return (
    <section className="panel grid gap-3 p-6" aria-labelledby="owner-heading">
      <GraduationCap
        aria-hidden="true"
        className="size-10 text-primary-text"
        strokeWidth={1.75}
      />
      <h2 id="owner-heading" className="text-2xl font-semibold">
        Người đứng lớp
      </h2>
      <p className="text-muted-foreground">
        {SITE_OWNER.name} tự biên soạn và giảng toàn bộ khóa học trên nền tảng
        này. Mỗi bài học đi ra từ một tình huống làm việc thật.
      </p>
      {variant === "full" && (
        <p className="text-muted-foreground">
          Thông tin chi tiết về người dạy đang được cập nhật. Trong lúc chờ, bạn
          có thể gửi câu hỏi qua trang liên hệ.
        </p>
      )}
      <Link href="/contact" className={buttonClass("outline", "md", "w-fit")}>
        Liên hệ
      </Link>
    </section>
  );
}

const FAQ = [
  {
    question: "Tôi đăng ký học bằng cách nào",
    answer:
      "Hiện tại bạn gửi yêu cầu qua trang liên hệ. Sau khi xác nhận, quyền học được mở trong tài khoản của bạn.",
  },
  {
    question: "Học thử được không",
    answer:
      "Được. Mỗi khóa học có ít nhất một bài học thử, mở cho mọi tài khoản đã đăng nhập mà không cần trả phí.",
  },
  {
    question: "Tôi học được trong bao lâu",
    answer:
      "Quyền học không có hạn sử dụng. Tiến độ được lưu lại theo từng bài, bạn quay lại đúng chỗ đã dừng.",
  },
  {
    question: "Có xuất hóa đơn không",
    answer:
      "Có. Bạn nêu yêu cầu hóa đơn trong nội dung liên hệ, kèm thông tin đơn vị và mã số thuế.",
  },
];

export function FaqAccordion() {
  return (
    <section className="grid gap-4" aria-labelledby="faq-heading">
      <h2 id="faq-heading" className="text-2xl font-semibold">
        Câu hỏi thường gặp
      </h2>
      <div className="grid gap-2">
        {FAQ.map((entry) => (
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
      <h2 className="text-2xl font-semibold">{title}</h2>
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
