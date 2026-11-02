"use client";
import { ArrowRight, BookOpen, Clock, Star } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { CourseCard as Course } from "@/lib/catalog";
import {
  LEVEL_LABEL,
  formatDuration,
  formatNumber,
  formatPrice,
  formatRating,
} from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { useLanguage } from "@/components/language-provider";
import { EnrolledBadge } from "./enrolled-badge";
import { projectCourse, projectCopy } from "@/lib/project-courses";

export function Rating({
  average,
  count,
  demoStats,
  size = "sm",
}: {
  average: number | null;
  count: number;
  demoStats: boolean;
  size?: "sm" | "md";
}) {
  const { locale } = useLanguage();
  if (demoStats || !count || average === null) return null;
  return (
    <span
      className={
        "inline-flex items-center gap-2 " +
        (size === "md" ? "text-base" : "text-sm")
      }
    >
      <Star
        aria-hidden="true"
        className="size-4 fill-accent text-on-accent-subtle"
      />
      <span>
        {locale === "vi" ? formatRating(average) : average.toFixed(1)}
      </span>
      <span className="text-muted-foreground">({formatNumber(count)})</span>
    </span>
  );
}
export function PriceTag({
  priceVnd,
  compareAtPriceVnd,
  size = "md",
}: {
  priceVnd: number;
  compareAtPriceVnd: number | null;
  size?: "sm" | "md" | "lg";
}) {
  const { locale, text } = useLanguage();
  const price = (value: number) =>
    locale === "vi"
      ? formatPrice(value)
      : new Intl.NumberFormat("en", {
          style: "currency",
          currency: "VND",
          maximumFractionDigits: 0,
        }).format(value);
  return (
    <span className="inline-flex flex-wrap items-baseline gap-2">
      <span
        className={
          "font-heading font-semibold " +
          { sm: "text-base", md: "text-lg", lg: "text-3xl" }[size]
        }
      >
        {priceVnd === 0 ? text("Miễn phí", "Free") : price(priceVnd)}
      </span>
      {compareAtPriceVnd && compareAtPriceVnd > priceVnd ? (
        <span className="text-xs text-muted-foreground line-through">
          {price(compareAtPriceVnd)}
        </span>
      ) : null}
    </span>
  );
}
export function CourseMeta({ course }: { course: Course }) {
  const { locale, text } = useLanguage();
  const planned = projectCourse(course.slug)?.availability === "planned";
  const levels = {
    BEGINNER: "Beginner",
    INTERMEDIATE: "Intermediate",
    ADVANCED: "Advanced",
    ALL_LEVELS: "All levels",
  };
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <BookOpen aria-hidden="true" size={14} />
        {planned
          ? text("Đang chuẩn bị", "In preparation")
          : `${course.lessonCount} ${text("bài học", "lessons")}`}
      </span>
      {course.totalDurationSeconds > 0 && (
        <span className="inline-flex items-center gap-1.5">
          <Clock aria-hidden="true" size={14} />
          {locale === "vi"
            ? formatDuration(course.totalDurationSeconds)
            : Math.round(course.totalDurationSeconds / 60) + " min"}
        </span>
      )}
      <Badge>
        {locale === "vi" ? LEVEL_LABEL[course.level] : levels[course.level]}
      </Badge>
    </p>
  );
}
function subject(title: string) {
  if (/python|pandas/i.test(title)) return "py";
  if (/typescript/i.test(title)) return "ts";
  if (/react|web|html/i.test(title)) return "</>";
  if (/figma|thiết kế/i.test(title)) return "Aa";
  return "{ }";
}
export function Cover({
  course,
}: {
  course: Pick<Course, "title" | "coverUrl"> &
    Partial<Pick<Course, "demoStats" | "slug">>;
}) {
  const project = projectCourse(course.slug);
  const { locale } = useLanguage();
  const symbol =
    project?.symbol ??
    (project?.theme === "slate"
      ? "{py}"
      : project?.theme === "lime"
        ? "web"
        : project?.theme === "coral"
          ? "csv"
          : subject(course.title));
  const theme =
    project?.theme ??
    (/python|typescript/i.test(course.title)
      ? "slate"
      : /web|figma/i.test(course.title)
        ? "lime"
        : "coral");
  return (
    <div className={`course-visual cover-${theme}`} aria-hidden="true">
      {course.coverUrl && !course.demoStats ? (
        // Media-provider URLs are rendered directly; dimensions prevent layout shift.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={course.coverUrl}
          alt=""
          loading="lazy"
          width={640}
          height={360}
        />
      ) : (
        <>
          <span className="cover-label">
            {project
              ? locale === "vi"
                ? project.coverLabel
                : "Python / Practical project"
              : /python/i.test(course.title)
                ? "Python"
                : /typescript/i.test(course.title)
                  ? "TypeScript"
                  : "Web / Design"}
          </span>
          {symbol === "web" ? (
            <span className="browser-drawing">
              <i>
                <b />
                <b />
                <b />
              </i>
              <span />
              <span />
            </span>
          ) : symbol === "csv" ? (
            <span className="data-drawing">
              <i />
              <i />
              <i />
              <i />
              <i />
            </span>
          ) : (
            <span className="cover-subject">{symbol}</span>
          )}
        </>
      )}
    </div>
  );
}
export function CourseCard({ course }: { course: Course }) {
  const { text, locale } = useLanguage();
  const project = projectCourse(course.slug);
  const copy = projectCopy(course.slug, locale);
  return (
    <li className="course-item">
      <Link href={"/courses/" + course.slug}>
        <Cover course={course} />
        <div className="course-copy">
          <span className="course-category">
            {project
              ? project.publicTrial
                ? text("Học thử miễn phí · 4 video", "Free trial · 4 videos")
                : project.availability === "available"
                  ? text("Đang nhận đăng ký · Bài đọc thực hành", "Enrollment open · Written project lessons")
                  : text("Dự án Python · Sắp có", "Python project · Upcoming")
              : course.demoStats
                ? text("Nội dung mẫu", "Sample content")
                : (course.category?.name ?? text("Khóa học", "Course"))}
          </span>
          <h3>{copy?.title ?? course.title}</h3>
          {(copy?.subtitle ?? course.subtitle) && (
            <p>{copy?.subtitle ?? course.subtitle}</p>
          )}
          <CourseMeta course={course} />
          <Rating
            average={course.ratingAverage}
            count={course.ratingCount}
            demoStats={course.demoStats}
          />
          <div className="course-copy-bottom">
            <PriceTag
              priceVnd={course.priceVnd}
              compareAtPriceVnd={course.compareAtPriceVnd}
            />
            <span>
              {project?.availability === "planned"
                ? text("Xem dự án", "Explore project")
                : text("Xem nội dung", "View course")}
              <ArrowRight aria-hidden="true" size={17} />
            </span>
          </div>
        </div>
        <span className="absolute left-3 top-3">
          <EnrolledBadge courseId={course.id} />
        </span>
      </Link>
    </li>
  );
}
export function CourseCardSkeleton() {
  return (
    <li className="panel grid gap-4 p-5">
      <Skeleton className="h-8 w-3/5" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-1/2" />
    </li>
  );
}
export function CourseGrid({
  courses,
  empty,
}: {
  courses: Course[];
  empty?: ReactNode;
}) {
  const { text } = useLanguage();
  if (!courses.length)
    return (
      empty ?? (
        <EmptyState
          title={text("Chưa có khóa học phù hợp", "No matching courses yet")}
          description={text(
            "Bạn có thể bắt đầu với bài thực hành mở.",
            "You can begin with the open practice lesson.",
          )}
        />
      )
    );
  return (
    <ul className="course-list">
      {courses.map((course) => (
        <CourseCard key={course.id} course={course} />
      ))}
    </ul>
  );
}
