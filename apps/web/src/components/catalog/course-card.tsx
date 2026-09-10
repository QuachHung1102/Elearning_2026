import { BookOpen, Clock, Star } from "lucide-react";
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

/** Hidden entirely when there is nothing to rate — never a row of empty stars. */
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
  if (count === 0 || average === null) return null;
  const stars = Math.round(average);
  return (
    <span
      className={`inline-flex items-center gap-2 ${size === "md" ? "text-base" : "text-sm"}`}
    >
      <span className="inline-flex items-center gap-0.5" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((index) => (
          <Star
            key={index}
            className={`size-4 ${index <= stars ? "fill-accent text-accent" : "text-border"}`}
            strokeWidth={1.75}
          />
        ))}
      </span>
      <span className="font-semibold">{formatRating(average)}</span>
      <span className="text-muted-foreground">({formatNumber(count)})</span>
      <span className="sr-only">
        Điểm đánh giá {formatRating(average)} trên 5, từ {formatNumber(count)}{" "}
        lượt
      </span>
      {demoStats && (
        <Badge aria-label="Điểm đánh giá là dữ liệu demo">Dữ liệu demo</Badge>
      )}
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
  const discount =
    compareAtPriceVnd && compareAtPriceVnd > priceVnd
      ? Math.floor(((compareAtPriceVnd - priceVnd) / compareAtPriceVnd) * 100)
      : 0;
  const scale = { sm: "text-base", md: "text-xl", lg: "text-3xl" }[size];
  return (
    <span
      className="inline-flex flex-wrap items-baseline gap-2"
      aria-label={
        discount >= 5
          ? `Giá gốc ${formatPrice(compareAtPriceVnd!)}, giá hiện tại ${formatPrice(priceVnd)}, giảm ${discount} phần trăm`
          : `Giá ${formatPrice(priceVnd)}`
      }
    >
      <span aria-hidden="true" className={`font-heading font-bold ${scale}`}>
        {formatPrice(priceVnd)}
      </span>
      {discount >= 5 && (
        <>
          <span
            aria-hidden="true"
            className="text-sm text-muted-foreground line-through"
          >
            {formatPrice(compareAtPriceVnd!)}
          </span>
          <Badge variant="accent">−{discount}%</Badge>
        </>
      )}
    </span>
  );
}

export function CourseMeta({ course }: { course: Course }) {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        <BookOpen aria-hidden="true" className="size-4" strokeWidth={1.75} />
        {formatNumber(course.lessonCount)} bài học
      </span>
      {course.totalDurationSeconds > 0 && (
        <span className="inline-flex items-center gap-1">
          <Clock aria-hidden="true" className="size-4" strokeWidth={1.75} />
          {formatDuration(course.totalDurationSeconds)} video
        </span>
      )}
      <Badge>{LEVEL_LABEL[course.level]}</Badge>
    </p>
  );
}

function Cover({ course }: { course: Course }) {
  if (!course.coverUrl) {
    return (
      <div
        aria-hidden="true"
        className="flex aspect-video items-center justify-center rounded-t-lg bg-muted font-heading text-5xl font-bold text-muted-foreground-strong"
      >
        {course.title.slice(0, 1)}
      </div>
    );
  }
  return (
    // The API returns an absolute URL from the storage seam, so this stays a
    // plain <img>: next/image would need every storage host in next.config.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={course.coverUrl}
      alt=""
      loading="lazy"
      width={640}
      height={360}
      className="aspect-video w-full rounded-t-lg object-cover"
    />
  );
}

/**
 * Fixed row structure so a grid holding both seeded courses (with ratings) and
 * hand-made ones (without) still lines up: the rating row and the badge slot
 * keep their height when empty.
 */
export function CourseCard({ course }: { course: Course }) {
  return (
    <li className="panel h-full transition-shadow duration-[var(--duration-fast)] hover:shadow-[var(--shadow-overlay)] focus-within:shadow-[var(--shadow-overlay)]">
      <Link
        href={`/courses/${course.slug}`}
        className="grid h-full grid-rows-[auto_1fr] rounded-lg"
      >
        <Cover course={course} />
        <div className="grid content-start gap-2 p-4">
          <h3 className="line-clamp-2 min-h-14 text-xl font-semibold">
            {course.title}
          </h3>
          <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">
            {course.subtitle ?? ""}
          </p>
          <div className="flex min-h-6 items-center">
            <Rating
              average={course.ratingAverage}
              count={course.ratingCount}
              demoStats={course.demoStats}
            />
          </div>
          <CourseMeta course={course} />
          <div className="mt-2 flex min-h-8 flex-wrap items-center justify-between gap-2">
            <PriceTag
              priceVnd={course.priceVnd}
              compareAtPriceVnd={course.compareAtPriceVnd}
            />
          </div>
        </div>
      </Link>
    </li>
  );
}

export function CourseCardSkeleton() {
  return (
    <li className="panel h-full p-0">
      <Skeleton className="aspect-video w-full rounded-b-none" />
      <div className="grid gap-3 p-4">
        <Skeleton className="h-6 w-4/5" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-1/2" />
      </div>
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
  if (courses.length === 0) {
    return (
      empty ?? (
        <EmptyState
          title="Không tìm thấy khóa học phù hợp"
          description="Thử bỏ bớt bộ lọc hoặc tìm bằng từ khóa khác."
        />
      )
    );
  }
  return (
    // Container driven, not viewport driven: this grid also renders inside a
    // narrow column next to the filter sidebar, where viewport breakpoints
    // would ask for three columns in the space for two.
    <ul className="grid list-none grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-6 p-0">
      {courses.map((course) => (
        <CourseCard key={course.id} course={course} />
      ))}
    </ul>
  );
}
