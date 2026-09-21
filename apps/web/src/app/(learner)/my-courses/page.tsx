import type { Metadata } from "next";
import Link from "next/link";
import {
  CourseProgressCard,
} from "@/components/learning/course-progress-card";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { requireAuth } from "@/lib/api";
import { firstValue, type Paginated } from "@/lib/catalog";
import type { EnrollmentItem } from "@/lib/learning";
import { serverFetch } from "@/lib/session";

export const metadata: Metadata = { title: "Khóa học của tôi" };

const TABS = [
  { key: "learning", label: "Đang học", href: "/my-courses" },
  { key: "done", label: "Đã xong", href: "/my-courses?tab=done" },
] as const;

export default async function MyCoursesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const done = firstValue((await searchParams).tab) === "done";
  // ponytail: one page of 100 and no pager; a learner with more than 100
  // active courses is far past a one-owner catalog. Add `?page=` then.
  const response = await requireAuth(
    await serverFetch(
      `/enrollments/me?status=ACTIVE&completed=${done}&sort=lastActivityAt:desc&pageSize=100`,
    ),
    done ? "/my-courses?tab=done" : "/my-courses",
  );
  if (!response.ok) {
    throw new Error(`GET /enrollments/me answered ${response.status}`);
  }
  const { items } = (await response.json()) as Paginated<EnrollmentItem>;

  return (
    <div className="page-shell grid gap-6 py-6 lg:gap-8 lg:py-10">
      <h1 tabIndex={-1} className="text-4xl font-bold">
        Khóa học của tôi
      </h1>

      <nav aria-label="Lọc khóa học của tôi" className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const current = (tab.key === "done") === done;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={current ? "page" : undefined}
              className={buttonClass(current ? "primary" : "outline", "md", "min-w-40")}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {items.length === 0 ? (
        done ? (
          <EmptyState
            title="Bạn chưa hoàn thành khóa học nào"
            description="Hoàn thành hết bài trong một khóa để nó xuất hiện ở đây."
            action={
              <Link href="/my-courses" className={buttonClass("outline")}>
                Về mục Đang học
              </Link>
            }
          />
        ) : (
          <EmptyState
            title="Bạn chưa có khóa học nào"
            description="Khi bạn được cấp quyền học, khóa học sẽ xuất hiện tại đây."
            action={
              <Link href="/courses" className={buttonClass("primary")}>
                Xem danh sách khóa học
              </Link>
            }
          />
        )
      ) : (
        <ul className="grid list-none gap-6 p-0 md:grid-cols-2 lg:grid-cols-3">
          {items.map((enrollment, index) => (
            <CourseProgressCard
              key={enrollment.id}
              enrollment={enrollment}
              primary={index === 0}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
