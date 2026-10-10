import Link from "next/link";
import { Plus } from "lucide-react";
import { Pagination } from "@/components/catalog/pagination";
import { StatusBadge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { adminFetch, staffBase } from "@/lib/admin";
import {
  firstValue,
  toQuery,
  valueList,
  type AdminCourseRow,
  type Paginated,
} from "@/lib/catalog";
import { formatDateTime, formatNumber, formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Khóa học" };

const KEYS = ["q", "status", "sort", "page", "pageSize"] as const;

export default async function AdminCoursesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const base = await staffBase();
  const mine = base === "/instructor";
  const courses = await adminFetch<Paginated<AdminCourseRow>>(
    `/admin/courses${toQuery(params, KEYS)}`,
  );
  const status = valueList(params.status);

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 tabIndex={-1} className="text-3xl font-bold">
          {mine ? "Khóa học của tôi" : "Khóa học"}
        </h1>
        <Link
          href={`${base}/courses/new`}
          className={buttonClass("primary", "md", "w-full sm:w-auto")}
        >
          <Plus aria-hidden="true" className="size-5" strokeWidth={1.75} />
          Tạo khóa học
        </Link>
      </header>

      {/* Keyed on the applied filter: the nav link back to /admin/courses is a
          client navigation that keeps this form, and React ignores a new
          `defaultValue` on a mounted <select>. */}
      <form
        key={`${status.join(",")}:${firstValue(params.q) ?? ""}`}
        method="get"
        action={`${base}/courses`}
        role="search"
        className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end sm:gap-6"
      >
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="admin-q">
            Tìm kiếm
          </label>
          <input
            id="admin-q"
            name="q"
            type="search"
            defaultValue={firstValue(params.q) ?? ""}
            placeholder="Tên khóa học…"
            className="control"
            maxLength={100}
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="admin-status">
            Trạng thái
          </label>
          <select
            id="admin-status"
            name="status"
            defaultValue={status[0] ?? ""}
            className="control"
          >
            <option value="">Mọi trạng thái</option>
            <option value="DRAFT">Bản nháp</option>
            <option value="PUBLISHED">Đã xuất bản</option>
            <option value="ARCHIVED">Đã lưu trữ</option>
          </select>
        </div>
        {/* No-JS GET form: a changed <select> needs a submit button. */}
        <button type="submit" className={buttonClass("outline", "lg")}>
          Lọc
        </button>
      </form>

      {courses.items.length === 0 && courses.total > 0 ? (
        // A stale link past the last page: the filter still matches.
        <EmptyState
          title="Trang này không có khóa học nào"
          description={`Danh sách chỉ có ${formatNumber(courses.totalPages)} trang.`}
          action={
            <Link
              href={`${base}/courses${toQuery({ ...params, page: undefined }, KEYS)}`}
              className={buttonClass("outline")}
            >
              Về trang 1
            </Link>
          }
        />
      ) : courses.items.length === 0 && (status.length > 0 || firstValue(params.q)) ? (
        <EmptyState
          title="Không tìm thấy khóa học phù hợp"
          description="Thử bỏ bớt bộ lọc hoặc dùng từ khóa ngắn hơn."
          action={
            <Link href={`${base}/courses`} className={buttonClass("outline")}>
              Xóa bộ lọc
            </Link>
          }
        />
      ) : courses.items.length === 0 ? (
        <EmptyState
          title={mine ? "Bạn chưa có khóa học nào" : "Chưa có khóa học nào"}
          description="Tạo bản nháp đầu tiên rồi bổ sung nội dung trước khi xuất bản."
          action={
            <Link href={`${base}/courses/new`} className={buttonClass("primary")}>
              Tạo khóa học
            </Link>
          }
        />
      ) : (
        <>
          {/* Table from 768px, stacked cards below: a five-column table at
              375px is a horizontal scroll nobody uses. The update time joins
              at 1280px, where it no longer squeezes the title. */}
          <div className="hidden overflow-clip rounded-lg border border-border bg-card md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-muted-foreground-strong">
                <tr>
                  <th className="px-4 py-3 font-semibold">Khóa học</th>
                  <th className="px-4 py-3 font-semibold">Trạng thái</th>
                  <th className="px-4 py-3 text-right font-semibold">Giá</th>
                  <th className="px-4 py-3 text-right font-semibold">Học viên</th>
                  <th className="px-4 py-3 text-right font-semibold">Bài học</th>
                  <th className="hidden px-4 py-3 font-semibold xl:table-cell">
                    Cập nhật
                  </th>
                </tr>
              </thead>
              <tbody>
                {courses.items.map((course) => (
                  <tr key={course.id} className="border-t border-border">
                    <td className="px-4 py-2 [overflow-wrap:anywhere]">
                      <Link
                        className="inline-flex min-h-11 items-center font-medium underline-offset-2 hover:underline"
                        href={`${base}/courses/${course.id}`}
                      >
                        {course.title}
                      </Link>
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge status={course.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">
                      {formatPrice(course.priceVnd)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatNumber(course.enrollmentCount)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatNumber(course.lessonCount)}
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-2 tabular-nums text-muted-foreground-strong xl:table-cell">
                      {formatDateTime(course.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="grid list-none gap-3 p-0 md:hidden">
            {courses.items.map((course) => (
              <li key={course.id} className="panel grid gap-1 p-4">
                <Link
                  className="inline-flex min-h-11 items-center font-semibold underline-offset-2 [overflow-wrap:anywhere] hover:underline"
                  href={`${base}/courses/${course.id}`}
                >
                  {course.title}
                </Link>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground-strong">
                  <StatusBadge status={course.status} />
                  <span className="tabular-nums">{formatPrice(course.priceVnd)}</span>
                  <span>{formatNumber(course.enrollmentCount)} học viên</span>
                  <span>{formatNumber(course.lessonCount)} bài học</span>
                </div>
              </li>
            ))}
          </ul>
          <Pagination
            basePath={`${base}/courses`}
            query={params}
            page={courses.page}
            totalPages={courses.totalPages}
            total={courses.total}
          />
        </>
      )}
    </div>
  );
}
