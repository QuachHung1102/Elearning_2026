import Link from "next/link";
import type { ReactNode } from "react";
import { unstable_rethrow } from "next/navigation";
import { AdminListRegion } from "@/components/admin/list-region";
import { ManualGrantDialog } from "@/components/admin/manual-grant-dialog";
import { RevokeEnrollmentDialog } from "@/components/admin/revoke-enrollment-dialog";
import { Pagination } from "@/components/catalog/pagination";
import { StatusBadge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import {
  adminEmails,
  adminFetch,
  grantableCourses,
  SOURCE_LABEL,
  UUID_V4,
  type AdminEnrollment,
} from "@/lib/admin";
import {
  firstValue,
  toQuery,
  type AdminCourseRow,
  type Paginated,
} from "@/lib/catalog";
import { formatDate, formatNumber, STATUS_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Quyền học" };

const KEYS = ["courseId", "status", "page"] as const;
const ERROR_TITLE = "Không tải được danh sách quyền học";

export default async function AdminEnrollmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  // Mirror the API's rules so a hand-edited URL widens the list instead of
  // drawing a 400 that would read as an outage.
  const rawCourse = firstValue(params.courseId) ?? "";
  const courseId = UUID_V4.test(rawCourse) ? rawCourse : "";
  const rawStatus = firstValue(params.status);
  const status =
    rawStatus === "ACTIVE" || rawStatus === "REVOKED" ? rawStatus : "";
  const filters = { courseId, status };
  const query = { ...filters, page: firstValue(params.page) };

  let data: [
    Paginated<AdminEnrollment>,
    Paginated<AdminCourseRow>,
    Map<string, string>,
    Awaited<ReturnType<typeof grantableCourses>>,
  ];
  const header = (action?: ReactNode) => (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="grid gap-2">
        <h1 tabIndex={-1} className="text-3xl font-bold">
          Quyền học
        </h1>
        <p className="text-muted-foreground">
          Cấp một quyền học và thu hồi một quyền học.
        </p>
      </div>
      {action}
    </header>
  );
  try {
    data = await Promise.all([
      adminFetch<Paginated<AdminEnrollment>>(
        `/admin/enrollments${toQuery(query, KEYS)}`,
      ),
      // ponytail: the first 100 courses by title feed the filter; a
      // searchable picker replaces it past that.
      adminFetch<Paginated<AdminCourseRow>>(
        "/admin/courses?sort=title:asc&pageSize=100",
      ),
      adminEmails(),
      grantableCourses(),
    ]);
  } catch (error) {
    // Redirects and 404s still happen; an outage lets the region keep the
    // rows already on screen (UX_PLAN.md §6.3).
    unstable_rethrow(error);
    console.error(error);
    return (
      <AdminListRegion
        failed
        errorTitle={ERROR_TITLE}
        header={header()}
      />
    );
  }
  const [enrollments, courses, granters, grantable] = data;
  const grantDialog = grantable && <ManualGrantDialog courses={grantable} />;
  const filtered = courseId !== "" || status !== "";

  // Keyed on the applied filter: React ignores a new `defaultValue` on a
  // mounted <select>, so a client navigation would resubmit the old one.
  const toolbar = (
    <form
      key={`${courseId}:${status}`}
      method="get"
      action="/admin/enrollments"
      aria-label="Lọc quyền học"
      className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end lg:max-w-3xl"
    >
      <div className="grid min-w-0 gap-1">
        <label className="text-sm font-medium" htmlFor="enrollments-course">
          Khóa học
        </label>
        <select
          id="enrollments-course"
          name="courseId"
          defaultValue={courseId}
          className="control"
        >
          <option value="">Tất cả</option>
          {courses.items.map((course) => (
            <option key={course.id} value={course.id}>
              {course.title}
            </option>
          ))}
        </select>
      </div>
      <div className="grid min-w-0 gap-1">
        <label className="text-sm font-medium" htmlFor="enrollments-status">
          Trạng thái
        </label>
        <select
          id="enrollments-status"
          name="status"
          defaultValue={status}
          className="control"
        >
          <option value="">Tất cả</option>
          <option value="ACTIVE">{STATUS_LABEL.ACTIVE}</option>
          <option value="REVOKED">{STATUS_LABEL.REVOKED}</option>
        </select>
      </div>
      <button
        id="enrollments-submit"
        type="submit"
        className={buttonClass("outline", "lg")}
      >
        Lọc
      </button>
    </form>
  );

  const granterOf = (enrollment: AdminEnrollment) =>
    (enrollment.grantedById && granters.get(enrollment.grantedById)) || "—";

  return (
    <AdminListRegion
      failed={false}
      errorTitle={ERROR_TITLE}
      header={header(grantDialog)}
      toolbar={toolbar}
      summary={`${formatNumber(enrollments.total)} quyền học`}
    >
      {enrollments.items.length === 0 ? (
        enrollments.total > 0 ? (
          // A stale link past the last page: the filter still matches.
          <EmptyState
            title="Trang này không có quyền học nào"
            description={`Danh sách chỉ có ${formatNumber(enrollments.totalPages)} trang.`}
            action={
              <Link
                href={`/admin/enrollments${toQuery(filters, KEYS)}`}
                className={buttonClass("outline")}
              >
                Về trang 1
              </Link>
            }
          />
        ) : filtered ? (
          <EmptyState
            title="Không tìm thấy quyền học phù hợp"
            description="Thử bỏ bớt bộ lọc."
            action={
              <Link href="/admin/enrollments" className={buttonClass("outline")}>
                Xóa bộ lọc
              </Link>
            }
          />
        ) : (
          <EmptyState
            title="Chưa cấp quyền học cho ai"
            description="Cấp quyền thủ công để học viên vào học ngay."
            action={grantDialog}
          />
        )
      ) : (
        <>
          {/* Table from 768px, cards below (UX_PLAN.md §7.3). Source joins
              at 1024px, granter and date at 1280px. `break-word`, not
              `anywhere`: it keeps an email whole unless it cannot fit at all,
              where `anywhere` lets the table squeeze it mid-word. */}
          <div className="hidden overflow-clip rounded-lg border border-border bg-card md:block">
            <table className="w-full text-left text-sm">
              <thead className="text-muted-foreground-strong [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Học viên</th>
                  <th className="px-4 py-3 font-semibold">Khóa học</th>
                  <th className="hidden px-4 py-3 font-semibold lg:table-cell">
                    Nguồn
                  </th>
                  <th className="hidden px-4 py-3 font-semibold xl:table-cell">
                    Người cấp
                  </th>
                  <th className="hidden px-4 py-3 font-semibold xl:table-cell">
                    Ngày cấp
                  </th>
                  <th className="px-4 py-3 font-semibold">Trạng thái</th>
                  <th className="px-4 py-3 font-semibold">
                    <span className="sr-only">Thao tác</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {enrollments.items.map((enrollment) => (
                  <tr key={enrollment.id} className="h-14 border-t border-border">
                    <td className="px-4 py-1 [overflow-wrap:break-word]">
                      <Link
                        className="inline-flex min-h-11 max-w-3xs items-center font-medium underline-offset-2 hover:underline"
                        href={`/admin/users/${enrollment.user.id}`}
                      >
                        {enrollment.user.email}
                      </Link>
                    </td>
                    <td className="px-4 py-2 [overflow-wrap:break-word]">
                      {enrollment.course.title}
                    </td>
                    <td className="hidden px-4 py-2 whitespace-nowrap lg:table-cell">
                      {SOURCE_LABEL[enrollment.source]}
                    </td>
                    <td className="hidden px-4 py-2 [overflow-wrap:break-word] xl:table-cell">
                      {granterOf(enrollment)}
                    </td>
                    <td className="hidden px-4 py-2 whitespace-nowrap tabular-nums xl:table-cell">
                      {formatDate(enrollment.grantedAt)}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <StatusBadge status={enrollment.status} />
                    </td>
                    <td className="px-4 py-1 text-right">
                      {enrollment.status === "ACTIVE" && (
                        <RevokeEnrollmentDialog enrollment={enrollment} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="grid list-none gap-3 p-0 md:hidden">
            {enrollments.items.map((enrollment) => (
              <li key={enrollment.id} className="panel grid gap-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    className="inline-flex min-h-11 min-w-0 items-center text-base font-semibold underline-offset-2 [overflow-wrap:anywhere] hover:underline"
                    href={`/admin/users/${enrollment.user.id}`}
                  >
                    {enrollment.user.email}
                  </Link>
                  <span className="shrink-0 pt-3">
                    <StatusBadge status={enrollment.status} />
                  </span>
                </div>
                <dl className="grid gap-1 text-sm">
                  <div className="flex items-baseline gap-1">
                    <dt className="shrink-0 text-muted-foreground">Khóa học:</dt>
                    <dd className="min-w-0 [overflow-wrap:anywhere]">
                      {enrollment.course.title}
                    </dd>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <dt className="shrink-0 text-muted-foreground">Nguồn:</dt>
                    <dd>{SOURCE_LABEL[enrollment.source]}</dd>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <dt className="shrink-0 text-muted-foreground">Người cấp:</dt>
                    <dd className="min-w-0 [overflow-wrap:anywhere]">
                      {granterOf(enrollment)}
                    </dd>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <dt className="shrink-0 text-muted-foreground">Ngày cấp:</dt>
                    <dd>{formatDate(enrollment.grantedAt)}</dd>
                  </div>
                </dl>
                {enrollment.status === "ACTIVE" && (
                  <div>
                    <RevokeEnrollmentDialog enrollment={enrollment} />
                  </div>
                )}
              </li>
            ))}
          </ul>
          <Pagination
            basePath="/admin/enrollments"
            query={query}
            page={enrollments.page}
            totalPages={enrollments.totalPages}
            total={enrollments.total}
            noun="quyền học"
          />
        </>
      )}
    </AdminListRegion>
  );
}
