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
        <Link href={`${base}/courses/new`} className={buttonClass("primary")}>
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
        className="flex flex-wrap gap-3"
      >
        <label className="sr-only" htmlFor="admin-q">
          Tìm khóa học
        </label>
        <input
          id="admin-q"
          name="q"
          type="search"
          defaultValue={firstValue(params.q) ?? ""}
          placeholder="Tìm theo tiêu đề"
          className="control max-w-xs"
          maxLength={100}
        />
        <label className="sr-only" htmlFor="admin-status">
          Trạng thái
        </label>
        <select
          id="admin-status"
          name="status"
          defaultValue={status[0] ?? ""}
          className="control max-w-44"
        >
          <option value="">Mọi trạng thái</option>
          <option value="DRAFT">Bản nháp</option>
          <option value="PUBLISHED">Đã xuất bản</option>
          <option value="ARCHIVED">Đã lưu trữ</option>
        </select>
        <button type="submit" className={buttonClass("outline")}>
          Lọc
        </button>
      </form>

      {courses.items.length === 0 ? (
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
              375px is a horizontal scroll nobody uses. */}
          <div className="table-scroll hidden md:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="p-3 font-semibold">Tiêu đề</th>
                  <th className="p-3 font-semibold">Trạng thái</th>
                  <th className="p-3 font-semibold">Giá</th>
                  <th className="p-3 font-semibold">Bài học</th>
                  <th className="p-3 font-semibold">Cập nhật</th>
                </tr>
              </thead>
              <tbody>
                {courses.items.map((course) => (
                  <tr key={course.id} className="border-b border-border">
                    <td className="p-3">
                      <Link
                        className="font-medium underline-offset-2 hover:underline"
                        href={`${base}/courses/${course.id}`}
                      >
                        {course.title}
                      </Link>
                    </td>
                    <td className="p-3">
                      <StatusBadge status={course.status} />
                    </td>
                    <td className="p-3">{formatPrice(course.priceVnd)}</td>
                    <td className="p-3">{formatNumber(course.lessonCount)}</td>
                    <td className="p-3">{formatDateTime(course.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="grid list-none gap-3 p-0 md:hidden">
            {courses.items.map((course) => (
              <li key={course.id} className="panel grid gap-2 p-4">
                <Link
                  className="font-semibold"
                  href={`${base}/courses/${course.id}`}
                >
                  {course.title}
                </Link>
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <StatusBadge status={course.status} />
                  <span>{formatPrice(course.priceVnd)}</span>
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
