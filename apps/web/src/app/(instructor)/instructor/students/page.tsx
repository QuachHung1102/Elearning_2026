import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { EnrollmentProgress } from "@/components/admin/enrollment-progress";
import { AdminListRegion } from "@/components/admin/list-region";
import { Pagination } from "@/components/catalog/pagination";
import { StatusBadge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { UUID_V4, adminFetch, type AdminEnrollment } from "@/lib/admin";
import {
  firstValue,
  toQuery,
  type AdminCourseRow,
  type Paginated,
} from "@/lib/catalog";
import { formatDate, formatNumber, STATUS_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Học viên" };

const KEYS = ["courseId", "status", "page"] as const;
const ERROR_TITLE = "Không tải được danh sách học viên";

/**
 * Read-only: the API already narrows `GET /admin/enrollments` to the caller's
 * own courses, and granting or revoking stays with the admin.
 */
export default async function InstructorStudentsPage({
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

  const header = (
    <header className="grid gap-2">
      <h1 tabIndex={-1} className="text-3xl font-bold">
        Học viên
      </h1>
      <p className="text-muted-foreground">
        Học viên đã ghi danh vào các khóa học của bạn.
      </p>
    </header>
  );

  let data: [Paginated<AdminEnrollment>, Paginated<AdminCourseRow>];
  try {
    data = await Promise.all([
      adminFetch<Paginated<AdminEnrollment>>(
        `/admin/enrollments${toQuery(query, KEYS)}`,
      ),
      // ponytail: the first 100 own courses by title feed the filter.
      adminFetch<Paginated<AdminCourseRow>>(
        "/admin/courses?sort=title:asc&pageSize=100",
      ),
    ]);
  } catch (error) {
    // Redirects and 404s still happen; an outage lets the region keep the
    // rows already on screen (UX_PLAN.md §6.3).
    unstable_rethrow(error);
    console.error(error);
    return (
      <AdminListRegion failed errorTitle={ERROR_TITLE} header={header} />
    );
  }
  const [enrollments, courses] = data;
  const filtered = courseId !== "" || status !== "";

  // Keyed on the applied filter: React ignores a new `defaultValue` on a
  // mounted <select>, so a client navigation would resubmit the old one.
  const toolbar = (
    <form
      key={`${courseId}:${status}`}
      method="get"
      action="/instructor/students"
      aria-label="Lọc học viên"
      className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end lg:max-w-3xl"
    >
      <div className="grid min-w-0 gap-1">
        <label className="text-sm font-medium" htmlFor="students-course">
          Khóa học
        </label>
        <select
          id="students-course"
          name="courseId"
          defaultValue={courseId}
          className="control"
        >
          <option value="">Mọi khóa học</option>
          {courses.items.map((course) => (
            <option key={course.id} value={course.id}>
              {course.title}
            </option>
          ))}
        </select>
      </div>
      <div className="grid min-w-0 gap-1">
        <label className="text-sm font-medium" htmlFor="students-status">
          Trạng thái
        </label>
        <select
          id="students-status"
          name="status"
          defaultValue={status}
          className="control"
        >
          <option value="">Mọi trạng thái</option>
          <option value="ACTIVE">{STATUS_LABEL.ACTIVE}</option>
          <option value="REVOKED">{STATUS_LABEL.REVOKED}</option>
        </select>
      </div>
      <button
        id="students-submit"
        type="submit"
        className={buttonClass("outline", "lg")}
      >
        Lọc
      </button>
    </form>
  );

  return (
    <AdminListRegion
      failed={false}
      errorTitle={ERROR_TITLE}
      header={header}
      toolbar={toolbar}
      summary={`${formatNumber(enrollments.total)} lượt ghi danh`}
    >
      {enrollments.items.length === 0 ? (
        enrollments.total > 0 ? (
          // A stale link past the last page: the filter still matches.
          <EmptyState
            title="Trang này không có học viên nào"
            description={`Danh sách chỉ có ${formatNumber(enrollments.totalPages)} trang.`}
            action={
              <Link
                href={`/instructor/students${toQuery(filters, KEYS)}`}
                className={buttonClass("outline")}
              >
                Về trang 1
              </Link>
            }
          />
        ) : filtered ? (
          <EmptyState
            title="Không tìm thấy học viên phù hợp"
            description="Thử bỏ bớt bộ lọc."
            action={
              <Link href="/instructor/students" className={buttonClass("outline")}>
                Xóa bộ lọc
              </Link>
            }
          />
        ) : (
          <EmptyState
            title="Chưa có học viên nào"
            description="Học viên sẽ hiện ở đây khi họ được ghi danh vào khóa học của bạn."
          />
        )
      ) : (
        <>
          {/* Table from 768px, cards below (UX_PLAN.md §7.3). */}
          <div className="hidden overflow-clip rounded-lg border border-border bg-card md:block">
            <table className="w-full text-left text-sm">
              <thead className="text-muted-foreground-strong [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Học viên</th>
                  <th className="px-4 py-3 font-semibold">Khóa học</th>
                  <th className="px-4 py-3 font-semibold">Tiến độ</th>
                  <th className="hidden px-4 py-3 font-semibold lg:table-cell">
                    Ngày ghi danh
                  </th>
                  <th className="px-4 py-3 font-semibold">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {enrollments.items.map((enrollment) => (
                  <tr key={enrollment.id} className="border-t border-border">
                    <td className="px-4 py-3 [overflow-wrap:break-word]">
                      <p className="font-medium">{enrollment.user.displayName}</p>
                      <p className="text-muted-foreground">
                        {enrollment.user.email}
                      </p>
                    </td>
                    <td className="px-4 py-3 [overflow-wrap:break-word]">
                      {enrollment.course.title}
                    </td>
                    <td className="px-4 py-3">
                      <EnrollmentProgress enrollment={enrollment} />
                    </td>
                    <td className="hidden px-4 py-3 whitespace-nowrap tabular-nums lg:table-cell">
                      {formatDate(enrollment.grantedAt)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={enrollment.status} />
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
                  <div className="min-w-0">
                    <p className="font-semibold [overflow-wrap:anywhere]">
                      {enrollment.user.displayName}
                    </p>
                    <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
                      {enrollment.user.email}
                    </p>
                  </div>
                  <StatusBadge status={enrollment.status} />
                </div>
                <p className="text-sm [overflow-wrap:anywhere]">
                  {enrollment.course.title}
                </p>
                <EnrollmentProgress enrollment={enrollment} />
                <p className="text-sm text-muted-foreground">
                  Ghi danh {formatDate(enrollment.grantedAt)}
                </p>
              </li>
            ))}
          </ul>
          <Pagination
            basePath="/instructor/students"
            query={query}
            page={enrollments.page}
            totalPages={enrollments.totalPages}
            total={enrollments.total}
            noun="học viên"
          />
        </>
      )}
    </AdminListRegion>
  );
}
