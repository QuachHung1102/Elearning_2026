import Link from "next/link";
import { notFound } from "next/navigation";
import { BlockUserDialog } from "@/components/admin/block-user-dialog";
import { ManualGrantDialog } from "@/components/admin/manual-grant-dialog";
import { RevokeEnrollmentDialog } from "@/components/admin/revoke-enrollment-dialog";
import { RoleDialog } from "@/components/admin/role-dialog";
import { StatTile } from "@/components/admin/shell";
import { RoleBadge, StatusBadge } from "@/components/ui/badge";
import {
  adminFetch,
  grantableCourses,
  SOURCE_LABEL,
  UUID_V4,
  type AdminUserDetail,
} from "@/lib/admin";
import { formatDate } from "@/lib/format";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Hồ sơ người dùng" };

export default async function AdminUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // The API answers a malformed id with 400; to a reader it is simply absent.
  if (!UUID_V4.test(id)) notFound();
  const [{ user, enrollments }, courses, viewer] = await Promise.all([
    adminFetch<AdminUserDetail>(`/admin/users/${id}`),
    grantableCourses(),
    getSession(),
  ]);

  return (
    <div className="grid gap-8">
      <header className="grid gap-3">
        <Link
          href="/admin/users"
          className="inline-flex min-h-11 w-fit items-center text-sm text-muted-foreground hover:text-primary-text"
        >
          ← Danh sách người dùng
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid min-w-0 gap-2">
            <h1
              tabIndex={-1}
              className="text-3xl font-bold [overflow-wrap:anywhere]"
            >
              {user.displayName}
            </h1>
            <div className="flex flex-wrap gap-2">
              <RoleBadge role={user.role} />
              <StatusBadge status={user.status} />
            </div>
            <p className="text-muted-foreground [overflow-wrap:anywhere]">
              {user.email}
            </p>
            <p className="text-sm text-muted-foreground">
              Ngày đăng ký: {formatDate(user.createdAt)}
            </p>
          </div>
          {/* Full-width buttons on a phone rather than three ragged widths;
              the confirm dialogs wrap their trigger in a span. */}
          <div className="grid w-full gap-3 sm:flex sm:w-auto sm:flex-wrap [&>span>button]:w-full sm:[&>span>button]:w-auto">
            {courses && <ManualGrantDialog user={user} courses={courses} />}
            {user.id !== viewer?.id && <RoleDialog user={user} />}
            <BlockUserDialog user={user} />
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatTile label="Quyền học đang hiệu lực" value={user.enrollmentCount} />
        <StatTile
          label="Phiên đăng nhập đang mở"
          value={user.activeSessionCount}
        />
      </div>

      <section aria-labelledby="user-enrollments" className="grid gap-4">
        <h2 id="user-enrollments" className="text-2xl font-semibold">
          Khóa học được cấp quyền
        </h2>
        {enrollments.length === 0 ? (
          <p className="rounded-lg bg-muted p-6 text-muted-foreground-strong">
            Người dùng này chưa có quyền học khóa nào.
          </p>
        ) : (
          <>
            <div className="hidden overflow-clip rounded-lg border border-border bg-card md:block">
              <table className="w-full text-left text-sm">
                <thead className="text-muted-foreground-strong [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Khóa học</th>
                    <th className="px-4 py-3 font-semibold">Nguồn</th>
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
                  {enrollments.map((enrollment) => (
                    <tr
                      key={enrollment.id}
                      className="h-14 border-t border-border"
                    >
                      <td className="px-4 py-2 [overflow-wrap:anywhere]">
                        <Link
                          className="inline-flex min-h-11 items-center font-medium underline-offset-2 hover:underline"
                          href={`/admin/courses/${enrollment.course.id}`}
                        >
                          {enrollment.course.title}
                        </Link>
                      </td>
                      <td className="px-4 py-2">
                        {SOURCE_LABEL[enrollment.source]}
                      </td>
                      <td className="hidden px-4 py-2 tabular-nums xl:table-cell">
                        {formatDate(enrollment.grantedAt)}
                      </td>
                      <td className="px-4 py-2">
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
              {enrollments.map((enrollment) => (
                <li key={enrollment.id} className="panel grid gap-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      className="inline-flex min-h-11 min-w-0 items-center text-base font-semibold underline-offset-2 [overflow-wrap:anywhere] hover:underline"
                      href={`/admin/courses/${enrollment.course.id}`}
                    >
                      {enrollment.course.title}
                    </Link>
                    <span className="shrink-0 pt-3">
                      <StatusBadge status={enrollment.status} />
                    </span>
                  </div>
                  <dl className="grid gap-1 text-sm">
                    <div className="flex gap-1">
                      <dt className="text-muted-foreground">Nguồn:</dt>
                      <dd>{SOURCE_LABEL[enrollment.source]}</dd>
                    </div>
                    <div className="flex gap-1">
                      <dt className="text-muted-foreground">Ngày cấp:</dt>
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
          </>
        )}
      </section>
    </div>
  );
}
