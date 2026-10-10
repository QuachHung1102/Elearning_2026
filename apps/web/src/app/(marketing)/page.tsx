import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CourseGrid } from "@/components/catalog/course-card";
import {
  CategoryChips,
  FaqAccordion,
  InstructorCard,
  SearchHero,
  TrustStats,
} from "@/components/catalog/sections";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { publicFetch, type Category, type CourseCard, type Paginated } from "@/lib/catalog";

// Rendered per request so `next build` needs no API; `publicFetch` still keeps
// every API response in the Data Cache for 300 s, which `revalidate = 0` leaves
// alone.
export const revalidate = 0;

export default async function HomePage() {
  const [featured, categories, all] = await Promise.all([
    publicFetch<Paginated<CourseCard>>("/courses?pageSize=8"),
    publicFetch<{ items: Category[] }>("/categories"),
    publicFetch<Paginated<CourseCard>>("/courses?pageSize=100"),
  ]);

  const lessonCount = all.items.reduce(
    (total, course) => total + course.lessonCount,
    0,
  );

  return (
    <>
      <SearchHero courseCount={featured.total} />
      <div className="page-shell grid gap-16 pb-20">
        <CategoryChips categories={categories.items} />

        <section className="grid gap-4" aria-labelledby="featured-heading">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="featured-heading" className="text-2xl font-semibold">
              Khóa học nổi bật
            </h2>
            <Link href="/courses" className={buttonClass("ghost")}>
              Xem tất cả khóa học
              <ArrowRight
                aria-hidden="true"
                className="size-5"
                strokeWidth={1.75}
              />
            </Link>
          </div>
          <CourseGrid
            courses={featured.items}
            empty={
              <EmptyState
                title="Chưa có khóa học nào được xuất bản"
                description="Khóa học đầu tiên sẽ xuất hiện ở đây ngay khi được xuất bản."
                action={
                  <Link href="/contact" className={buttonClass("primary")}>
                    Liên hệ
                  </Link>
                }
              />
            }
          />
        </section>

        {/* Student count lands in phase 3 with the enrollment table; until then
            the third tile shows a number that is already real. */}
        <TrustStats
          courseCount={featured.total}
          lessonCount={lessonCount}
          studentCount={categories.items.length}
          studentLabel="Danh mục"
        />

        <InstructorCard />
        <FaqAccordion />
      </div>
    </>
  );
}
