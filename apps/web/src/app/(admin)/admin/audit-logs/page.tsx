import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { AdminListRegion } from "@/components/admin/list-region";
import { Pagination } from "@/components/catalog/pagination";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { adminFetch, type AdminUserRow } from "@/lib/admin";
import {
  AUDIT_ACTION_LABEL,
  AUDIT_ENTITY_LABEL,
  auditActionLabel,
  auditApiQuery,
  auditEntity,
  auditEntityHref,
  auditFilters,
  type AuditLogRow,
} from "@/lib/audit";
import { firstValue, type Paginated } from "@/lib/catalog";
import { formatDateTime, formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nhật ký" };

/** The actor with no user row: payment callbacks and scheduled jobs. */
const SYSTEM_ACTOR = "Hệ thống";

const ERROR_TITLE = "Không tải được nhật ký";

/** Block and grant rows carry no name in their metadata; the user's page answers "who". */
function Entity({ row }: { row: AuditLogRow }) {
  const href = auditEntityHref(row);
  if (!href) return auditEntity(row);
  return (
    <Link
      className="inline-flex min-h-11 items-center underline underline-offset-2"
      href={href}
    >
      {auditEntity(row)}
    </Link>
  );
}

export default async function AdminAuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = auditFilters(params);
  const header = (
    <header className="grid gap-2">
      <h1 tabIndex={-1} className="text-3xl font-bold">
        Nhật ký
      </h1>
      <p className="text-muted-foreground">
        Theo dõi thay đổi về tài khoản, nội dung và quyền học.
      </p>
    </header>
  );

  let data: [Paginated<AuditLogRow>, Paginated<AdminUserRow> | null];
  try {
    data = await Promise.all([
      adminFetch<Paginated<AuditLogRow>>(
        `/admin/audit-logs${auditApiQuery(filters, firstValue(params.page))}`,
      ),
      // ponytail: every actor today is an admin (or the system); learners join
      // with refund requests in phase 4, and 100 admins is far past a
      // one-owner site. Swap for an email search box when either changes.
      // Optional extra: if it fails the select keeps "Tất cả" and the applied
      // actor, and the log itself still shows (UX_PLAN.md §6.3).
      adminFetch<Paginated<AdminUserRow>>(
        "/admin/users?role=ADMIN&sort=email:asc&pageSize=100",
      ).catch((error: unknown) => {
        unstable_rethrow(error);
        console.error(error);
        return null;
      }),
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
  const [logs, admins] = data;
  const actors = (admins?.items ?? []).map(({ id, email }) => ({ id, email }));
  if (filters.actorId && !actors.some(({ id }) => id === filters.actorId)) {
    // A link filtered on someone no longer listed must still show the filter.
    actors.push({
      id: filters.actorId,
      email: logs.items[0]?.actorEmail ?? "Người dùng khác",
    });
  }
  const filtered = Object.values(filters).some(Boolean);
  const query = { ...filters, page: firstValue(params.page) };

  // Keyed on the applied filter: React ignores a new `defaultValue` on a
  // mounted <select>, so a client navigation would resubmit the old one.
  const toolbar = (
    <form
      key={JSON.stringify(filters)}
      method="get"
      action="/admin/audit-logs"
      aria-label="Lọc nhật ký"
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:flex xl:flex-wrap xl:items-end"
    >
      <div className="grid min-w-0 gap-1">
        <label className="text-sm font-medium" htmlFor="audit-actor">
          Người thực hiện
        </label>
        <select
          id="audit-actor"
          name="actorId"
          defaultValue={filters.actorId}
          className="control"
        >
          <option value="">Tất cả</option>
          {actors.map((actor) => (
            <option key={actor.id} value={actor.id}>
              {actor.email}
            </option>
          ))}
        </select>
      </div>
      <div className="grid min-w-0 gap-1">
        <label className="text-sm font-medium" htmlFor="audit-action">
          Hành động
        </label>
        <select
          id="audit-action"
          name="action"
          defaultValue={filters.action}
          className="control"
        >
          <option value="">Tất cả</option>
          {Object.entries(AUDIT_ACTION_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid min-w-0 gap-1">
        <label className="text-sm font-medium" htmlFor="audit-entity">
          Đối tượng
        </label>
        <select
          id="audit-entity"
          name="entityType"
          defaultValue={filters.entityType}
          className="control"
        >
          <option value="">Tất cả</option>
          {Object.entries(AUDIT_ENTITY_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid min-w-0 gap-1">
        <label className="text-sm font-medium" htmlFor="audit-from">
          Từ ngày
        </label>
        <input
          id="audit-from"
          name="from"
          type="date"
          defaultValue={filters.from}
          className="control"
        />
      </div>
      <div className="grid min-w-0 gap-1">
        <label className="text-sm font-medium" htmlFor="audit-to">
          Đến ngày
        </label>
        <input
          id="audit-to"
          name="to"
          type="date"
          defaultValue={filters.to}
          className="control"
        />
      </div>
      <div className="flex items-end">
        <button id="audit-submit" type="submit" className={buttonClass("outline", "lg")}>
          Lọc
        </button>
      </div>
    </form>
  );

  return (
    <AdminListRegion
      failed={false}
      errorTitle={ERROR_TITLE}
      header={header}
      toolbar={toolbar}
      summary={
        logs.totalPages > 1 && logs.items.length > 0
          ? `Trang ${formatNumber(logs.page)} trên ${formatNumber(logs.totalPages)} · ${formatNumber(logs.total)} hoạt động`
          : `${formatNumber(logs.total)} hoạt động`
      }
    >
      {logs.items.length === 0 ? (
        logs.total > 0 ? (
          // A stale link past the last page: the filter still matches.
          <EmptyState
            title="Trang này không có hoạt động nào"
            description={`Nhật ký chỉ có ${formatNumber(logs.totalPages)} trang.`}
            action={
              <Link
                href={`/admin/audit-logs?${new URLSearchParams(
                  Object.entries(filters).filter(([, value]) => value),
                )}`}
                className={buttonClass("outline")}
              >
                Về trang 1
              </Link>
            }
          />
        ) : filtered ? (
          <EmptyState
            title="Không tìm thấy hoạt động phù hợp"
            description="Thử bỏ bớt bộ lọc hoặc chọn khoảng thời gian rộng hơn."
            action={
              <Link href="/admin/audit-logs" className={buttonClass("outline")}>
                Xóa bộ lọc
              </Link>
            }
          />
        ) : (
          <EmptyState title="Chưa có hoạt động nào được ghi lại" />
        )
      ) : (
        <>
          {/* Table from 768px, cards below (UX_PLAN.md §7.3); the IP is a
              secondary column and joins at 1280px. */}
          <div className="hidden overflow-clip rounded-lg border border-border bg-card md:block">
            <table className="w-full text-left text-sm">
              <thead className="text-muted-foreground-strong [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Thời gian</th>
                  <th className="px-4 py-3 font-semibold">Người thực hiện</th>
                  <th className="px-4 py-3 font-semibold">Hành động</th>
                  <th className="px-4 py-3 font-semibold">Đối tượng</th>
                  <th className="hidden px-4 py-3 font-semibold xl:table-cell">
                    Địa chỉ IP
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs.items.map((row) => (
                  <tr key={row.id} className="h-14 border-t border-border">
                    <td className="px-4 py-1 whitespace-nowrap tabular-nums">
                      <time dateTime={row.createdAt}>
                        {formatDateTime(row.createdAt)}
                      </time>
                    </td>
                    <td className="px-4 py-1 [overflow-wrap:anywhere]">
                      {row.actorEmail ?? SYSTEM_ACTOR}
                    </td>
                    <td className="px-4 py-1">{auditActionLabel(row.action)}</td>
                    <td className="px-4 py-1 [overflow-wrap:anywhere]">
                      <Entity row={row} />
                    </td>
                    <td className="hidden px-4 py-2 tabular-nums [overflow-wrap:anywhere] xl:table-cell">
                      {row.ipAddress ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="grid list-none gap-3 p-0 md:hidden">
            {logs.items.map((row) => (
              <li key={row.id} className="panel grid gap-2 p-4">
                <p className="text-base font-semibold">
                  {auditActionLabel(row.action)}
                </p>
                <dl className="grid gap-1 text-sm">
                  <div className="flex items-baseline gap-1">
                    <dt className="shrink-0 text-muted-foreground">Thời gian:</dt>
                    <dd>
                      <time dateTime={row.createdAt}>
                        {formatDateTime(row.createdAt)}
                      </time>
                    </dd>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <dt className="shrink-0 text-muted-foreground">
                      Người thực hiện:
                    </dt>
                    <dd className="min-w-0 [overflow-wrap:anywhere]">
                      {row.actorEmail ?? SYSTEM_ACTOR}
                    </dd>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <dt className="shrink-0 text-muted-foreground">Đối tượng:</dt>
                    <dd className="min-w-0 [overflow-wrap:anywhere]">
                      <Entity row={row} />
                    </dd>
                  </div>
                  {row.ipAddress && (
                    <div className="flex items-baseline gap-1">
                      <dt className="shrink-0 text-muted-foreground">
                        Địa chỉ IP:
                      </dt>
                      <dd className="min-w-0 [overflow-wrap:anywhere]">
                        {row.ipAddress}
                      </dd>
                    </div>
                  )}
                </dl>
              </li>
            ))}
          </ul>
          <Pagination
            basePath="/admin/audit-logs"
            query={query}
            page={logs.page}
            totalPages={logs.totalPages}
            total={logs.total}
            noun="hoạt động"
          />
        </>
      )}

      <p className="text-sm text-muted-foreground">Nhật ký chỉ đọc.</p>
    </AdminListRegion>
  );
}
