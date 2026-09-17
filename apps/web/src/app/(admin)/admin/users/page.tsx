import Link from "next/link";
import { Pagination } from "@/components/catalog/pagination";
import { StatusBadge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { adminFetch, type AdminUserRow } from "@/lib/admin";
import {
  firstValue,
  toQuery,
  valueList,
  type Paginated,
} from "@/lib/catalog";
import { formatDate, formatNumber, STATUS_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Người dùng" };

const KEYS = ["q", "status", "page"] as const;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  // Mirror the API's rules so a hand-edited URL narrows the list instead of
  // drawing a 400 that would read as a server outage.
  const q = (firstValue(params.q) ?? "").trim().slice(0, 100);
  const status =
    valueList(params.status).find(
      (value) => value === "ACTIVE" || value === "BLOCKED",
    ) ?? "";
  const query = { q, status, page: firstValue(params.page) };
  const users = await adminFetch<Paginated<AdminUserRow>>(
    `/admin/users${toQuery(query, KEYS)}`,
  );
  const filtered = q !== "" || status !== "";

  return (
    <div className="grid gap-6">
      <h1 tabIndex={-1} className="text-3xl font-bold">
        Người dùng
      </h1>

      {/* Keyed on the applied filter: a client navigation such as "Xóa bộ
          lọc" reuses this form, and React ignores a new `defaultValue` on a
          mounted <select>, so it would keep and resubmit the old status. */}
      <form
        key={`${status}:${q}`}
        method="get"
        action="/admin/users"
        role="search"
        className="flex flex-wrap items-end gap-3"
      >
        <div className="grid w-full gap-1 sm:max-w-sm">
          <label className="text-sm font-medium" htmlFor="users-q">
            Tìm theo tên hoặc email
          </label>
          <input
            id="users-q"
            name="q"
            type="search"
            defaultValue={q}
            className="control"
            maxLength={100}
          />
        </div>
        <div className="grid gap-1">
          <label className="text-sm font-medium" htmlFor="users-status">
            Trạng thái
          </label>
          <select
            id="users-status"
            name="status"
            defaultValue={status}
            className="control"
          >
            <option value="">Mọi trạng thái</option>
            <option value="ACTIVE">{STATUS_LABEL.ACTIVE}</option>
            <option value="BLOCKED">{STATUS_LABEL.BLOCKED}</option>
          </select>
        </div>
        <button type="submit" className={buttonClass("outline", "lg")}>
          Lọc
        </button>
      </form>

      {users.items.length === 0 ? (
        users.total > 0 ? (
          // A stale link past the last page: the filter still matches.
          <EmptyState
            title="Trang này không có người dùng nào"
            description={`Danh sách chỉ có ${formatNumber(users.totalPages)} trang.`}
            action={
              <Link
                href={`/admin/users${toQuery({ q, status }, KEYS)}`}
                className={buttonClass("outline")}
              >
                Về trang 1
              </Link>
            }
          />
        ) : filtered ? (
          <EmptyState
            title="Không tìm thấy người dùng phù hợp"
            description="Thử bỏ bớt bộ lọc hoặc dùng từ khóa ngắn hơn."
            action={
              <Link href="/admin/users" className={buttonClass("outline")}>
                Xóa bộ lọc
              </Link>
            }
          />
        ) : (
          <EmptyState
            title="Chưa có người dùng nào"
            description="Người dùng sẽ xuất hiện sau khi có người đăng ký."
          />
        )
      ) : (
        <>
          {/* Table from 768px, cards led by the email below (UX_PLAN.md
              §7.3). Counts join at 1024px and the sign-up date at 1280px.
              `overflow-clip` rounds the corners without becoming a scroll
              container, so the header still sticks to the top of the page. */}
          <div className="hidden overflow-clip rounded-lg border border-border bg-card md:block">
            <table className="w-full text-left text-sm">
              <thead className="text-muted-foreground-strong [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Người dùng</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="hidden px-4 py-3 font-semibold lg:table-cell">
                    Quyền học
                  </th>
                  <th className="hidden px-4 py-3 font-semibold xl:table-cell">
                    Ngày đăng ký
                  </th>
                  <th className="px-4 py-3 font-semibold">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {users.items.map((user) => (
                  <tr key={user.id} className="h-14 border-t border-border">
                    <td className="px-4 py-2 [overflow-wrap:anywhere]">
                      {/* The cap keeps an unbroken 80-character name from
                          starving the email and status columns. */}
                      <Link
                        className="inline-flex min-h-11 max-w-3xs items-center font-medium underline-offset-2 hover:underline"
                        href={`/admin/users/${user.id}`}
                      >
                        {user.displayName}
                      </Link>
                    </td>
                    <td className="px-4 py-2 [overflow-wrap:anywhere]">
                      {user.email}
                    </td>
                    <td className="hidden px-4 py-2 tabular-nums lg:table-cell">
                      {formatNumber(user.enrollmentCount)} khóa
                    </td>
                    <td className="hidden px-4 py-2 tabular-nums xl:table-cell">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge status={user.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="grid list-none gap-3 p-0 md:hidden">
            {users.items.map((user) => (
              <li key={user.id} className="panel grid gap-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    className="inline-flex min-h-11 min-w-0 items-center text-base font-semibold underline-offset-2 [overflow-wrap:anywhere] hover:underline"
                    href={`/admin/users/${user.id}`}
                  >
                    {user.email}
                  </Link>
                  <span className="shrink-0 pt-3">
                    <StatusBadge status={user.status} />
                  </span>
                </div>
                <dl className="grid gap-1 text-sm">
                  <div className="flex gap-1">
                    <dt className="text-muted-foreground">Người dùng:</dt>
                    <dd className="min-w-0 [overflow-wrap:anywhere]">
                      {user.displayName}
                    </dd>
                  </div>
                  <div className="flex gap-1">
                    <dt className="text-muted-foreground">Quyền học:</dt>
                    <dd>{formatNumber(user.enrollmentCount)} khóa</dd>
                  </div>
                  <div className="flex gap-1">
                    <dt className="text-muted-foreground">Ngày đăng ký:</dt>
                    <dd>{formatDate(user.createdAt)}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
          <Pagination
            basePath="/admin/users"
            query={query}
            page={users.page}
            totalPages={users.totalPages}
            total={users.total}
            noun="người dùng"
          />
        </>
      )}
    </div>
  );
}
