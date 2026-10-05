import type { Metadata } from "next";
import { CourseGrid } from "@/components/catalog/course-card";
import { CourseFilters } from "@/components/catalog/filters";
import { Pagination } from "@/components/catalog/pagination";
import { SortSelect } from "@/components/catalog/sort-select";
import {
  COURSE_QUERY_KEYS,
  firstValue,
  publicFetch,
  toQuery,
  valueList,
  type Category,
  type CourseCard,
  type Paginated,
} from "@/lib/catalog";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = {
  title: "Khóa học",
  description: "Toàn bộ khóa học đang mở, lọc theo danh mục, trình độ và giá.",
};

type Search = Record<string, string | string[] | undefined>;

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const params = await searchParams;
  const query = toQuery(params, COURSE_QUERY_KEYS);

  const [courses, categories] = await Promise.all([
    // Filtered results are shared by everyone asking the same question, but
    // they change as soon as the catalog does, so this window is short.
    publicFetch<Paginated<CourseCard>>(`/courses${query}`, 60),
    publicFetch<{ items: Category[] }>("/categories"),
  ]);

  const state = {
    q: firstValue(params.q),
    category: valueList(params.category),
    level: valueList(params.level),
    priceVndMin: firstValue(params.priceVndMin),
    priceVndMax: firstValue(params.priceVndMax),
    sort: firstValue(params.sort),
  };

  return (
    <div className="page-shell grid gap-8 py-10 lg:grid-cols-[16.5rem_minmax(0,1fr)] lg:gap-10 lg:py-14">
      <header className="lg:col-span-2">
        <h1 tabIndex={-1} className="text-4xl font-bold">
          Khóa học
        </h1>
        <p className="mt-2 text-muted-foreground">
          {formatNumber(courses.total)} khóa học đang mở
        </p>
      </header>

      <aside aria-label="Bộ lọc khóa học">
        <CourseFilters action="/courses" categories={categories.items} state={state} />
      </aside>

      <section className="grid content-start gap-6">
        {/* The cards are h3: without this level the outline skips h2 (WCAG 1.3.1). */}
        <h2 className="sr-only">
          Danh sách khóa học
        </h2>
        <div className="flex justify-end">
          <SortSelect
            value={state.sort ?? "enrollmentCount:desc"}
            basePath="/courses"
            query={params}
          />
        </div>
        <CourseGrid courses={courses.items} />
        <Pagination
          basePath="/courses"
          query={params}
          page={courses.page}
          totalPages={courses.totalPages}
          total={courses.total}
        />
      </section>
    </div>
  );
}
