import { Plus } from "lucide-react";
import Link from "next/link";
import { EnrollmentProgress } from "@/components/admin/enrollment-progress";
import { StatTile } from "@/components/admin/shell";
import { StatusBadge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import {
  adminFetch,
  type AdminEnrollment,
  type InstructorOverview,
} from "@/lib/admin";
import type { AdminCourseRow, Paginated } from "@/lib/catalog";
import { formatDate, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tổng quan" };

export default async function InstructorHomePage() {
  // All three answers are already narrowed to the caller's own courses.
  const [overview, drafts, recent] = await Promise.all([
    adminFetch<InstructorOverview>("/admin/reports/instructor-overview"),
    adminFetch<Paginated<AdminCourseRow>>(
      "/admin/courses?status=DRAFT&sort=updatedAt:desc&pageSize=5",
    ),
    adminFetch<Paginated<AdminEnrollment>>("/admin/enrollments?pageSize=5"),
  ]);
  const hasCourses = overview.publishedCourses + overview.draftCourses > 0;

  return (
    <div className="grid gap-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 tabIndex={-1} className="text-3xl font-bold">
          Tổng quan
        </h1>
        <Link
          href="/instructor/courses/new"
          className={buttonClass("primary", "md", "w-full sm:w-auto")}
        >
          <Plus aria-hidden="true" className="size-5" strokeWidth={1.75} />
          Tạo khóa học
        </Link>
      </header>

      {!hasCourses ? (
        <EmptyState
          title="Bạn chưa có khóa học nào"
          description="Tạo bản nháp đầu tiên rồi bổ sung nội dung trước khi xuất bản."
          action={
            <Link
              href="/instructor/courses/new"
              className={buttonClass("primary")}
            >
              Tạo khóa học
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            <StatTile label="Khóa học đang bán" value={overview.publishedCourses} />
            <StatTile
              label="Lượt ghi danh"
              value={overview.activeEnrollments}
              hint={`${overview.newEnrollments30d} mới trong 30 ngày`}
            />
            <StatTile label="Bản nháp" value={overview.draftCourses} />
          </div>

          <section aria-labelledby="attention-heading" className="grid gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 id="attention-heading" className="text-xl font-semibold">
                Khóa học cần chú ý
              </h2>
              <Link
                href="/instructor/courses?status=DRAFT"
                className="inline-flex min-h-11 items-center text-sm text-primary-text hover:underline"
              >
                Xem tất cả bản nháp
              </Link>
            </div>
            {drafts.items.length === 0 ? (
              <p className="text-muted-foreground">
                Không có bản nháp nào đang chờ xuất bản.
              </p>
            ) : (
              <ul className="grid list-none gap-2 p-0">
                {drafts.items.map((course) => (
                  <li
                    key={course.id}
                    className="panel flex flex-wrap items-center justify-between gap-3 p-4"
                  >
                    <Link
                      className="inline-flex min-h-11 min-w-0 items-center font-medium underline-offset-2 [overflow-wrap:anywhere] hover:underline"
                      href={`/instructor/courses/${course.id}`}
                    >
                      {course.title}
                    </Link>
                    <span className="flex items-center gap-3 text-sm text-muted-foreground">
                      <StatusBadge status={course.status} />
                      Cập nhật {formatDateTime(course.updatedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="recent-heading" className="grid gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 id="recent-heading" className="text-xl font-semibold">
                Ghi danh gần đây
              </h2>
              <Link
                href="/instructor/students"
                className="inline-flex min-h-11 items-center text-sm text-primary-text hover:underline"
              >
                Xem tất cả học viên
              </Link>
            </div>
            {recent.items.length === 0 ? (
              <p className="text-muted-foreground">
                Chưa có học viên nào ghi danh.
              </p>
            ) : (
              <ul className="grid list-none gap-2 p-0">
                {recent.items.map((enrollment) => (
                  <li
                    key={enrollment.id}
                    className="panel grid gap-2 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="font-medium [overflow-wrap:anywhere]">
                        {enrollment.user.displayName}
                      </p>
                      <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
                        {enrollment.course.title}
                      </p>
                    </div>
                    <EnrollmentProgress enrollment={enrollment} />
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {formatDate(enrollment.grantedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
