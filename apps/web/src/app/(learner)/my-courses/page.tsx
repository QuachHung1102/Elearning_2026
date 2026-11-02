import { UiText } from "@/components/language-provider";
import { BookOpen, GraduationCap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CourseProgressCard } from "@/components/learning/course-progress-card";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { requireAuth } from "@/lib/api";
import { firstValue, type Paginated } from "@/lib/catalog";
import type { EnrollmentItem } from "@/lib/learning";
import { getSession, serverFetch } from "@/lib/session";
import { getLocale } from "@/lib/locale";
import { translate } from "@/lib/translations";

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
  const locale = await getLocale();
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
  // The layout's cached read; it ran before this page could render.
  const user = await getSession().catch(() => null);

  return (
    <div className="page-shell grid gap-6 py-6 lg:gap-8 lg:py-10">
      <div className="learner-welcome grid gap-2">
        <h1 tabIndex={-1} className="text-4xl font-bold">
          <UiText value="Tiếp tục học cùng CodingBuddy" />
        </h1>
        {user && (
          <p className="text-lg text-muted-foreground">
            <UiText value="Chào" /> {user.displayName}
            <UiText value=", mình cùng tiếp tục nhé." />
          </p>
        )}
      </div>

      <nav
        aria-label={translate(
          locale,
          "Lọc khóa học của tôi",
          "Filter my courses",
        )}
        className="flex flex-wrap gap-2"
      >
        {TABS.map((tab) => {
          const current = (tab.key === "done") === done;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={current ? "page" : undefined}
              className={buttonClass(
                current ? "primary" : "outline",
                "md",
                "min-w-40",
              )}
            >
              <UiText value={tab.label} />
            </Link>
          );
        })}
      </nav>

      {items.length === 0 ? (
        done ? (
          <EmptyState
            icon={GraduationCap}
            title="Bạn chưa hoàn thành khóa học nào"
            description="Hoàn thành hết bài trong một khóa để nó xuất hiện ở đây."
            action={
              <Link href="/my-courses" className={buttonClass("outline")}>
                <UiText value="Về mục Đang học" />
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon={BookOpen}
            title="Bạn chưa có khóa học nào"
            description="Khóa học bạn đăng ký hoặc được cấp quyền học sẽ xuất hiện tại đây."
            action={
              <Link href="/courses" className={buttonClass("primary")}>
                <UiText value="Xem danh sách khóa học" />
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
