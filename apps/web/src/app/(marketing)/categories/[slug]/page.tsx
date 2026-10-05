import type { Metadata } from "next";
import { CourseGrid } from "@/components/catalog/course-card";
import { Pagination } from "@/components/catalog/pagination";
import { SortSelect } from "@/components/catalog/sort-select";
import {
  COURSE_QUERY_KEYS,
  firstValue,
  publicFetch,
  toQuery,
  type Category,
  type CourseCard,
  type Paginated,
} from "@/lib/catalog";
import { formatNumber } from "@/lib/format";

// The page reads `searchParams`, so it is only ever rendered per request.
// Saying so here matters: with no prerendered params Next never discovers it at
// build, and the first visit would fail with DYNAMIC_SERVER_USAGE. It also
// keeps `next build` off the API. `publicFetch` still caches each response.
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = await publicFetch<Category>(`/categories/${slug}`);
  return {
    title: category.name,
    description: category.description ?? undefined,
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, search] = await Promise.all([params, searchParams]);
  const query = toQuery(
    { ...search, category: slug },
    COURSE_QUERY_KEYS,
  );

  const [category, courses] = await Promise.all([
    publicFetch<Category>(`/categories/${slug}`),
    publicFetch<Paginated<CourseCard>>(`/courses${query}`, 60),
  ]);

  return (
    <div className="page-shell grid gap-8 py-10 lg:py-14">
      <header className="grid gap-2">
        <h1 tabIndex={-1} className="text-4xl font-bold">
          {category.name}
        </h1>
        {category.description && (
          <p className="max-w-prose text-lg text-muted-foreground">
            {category.description}
          </p>
        )}
        <p className="text-muted-foreground">
          {formatNumber(courses.total)} khóa học
        </p>
      </header>
      <div className="flex justify-end">
        <SortSelect
          value={firstValue(search.sort) ?? "enrollmentCount:desc"}
          basePath={`/categories/${slug}`}
          query={search}
        />
      </div>
      {/* The cards are h3: without this level the outline skips h2 (WCAG 1.3.1). */}
      <h2 className="sr-only">Danh sách khóa học</h2>
      <CourseGrid courses={courses.items} />
      <Pagination
        basePath={`/categories/${slug}`}
        query={search}
        page={courses.page}
        totalPages={courses.totalPages}
        total={courses.total}
      />
    </div>
  );
}
