/**
 * The closed audit vocabulary with its Vietnamese labels, verbatim from
 * DATA_MODEL.md §AuditLog and in that table's order. The API rejects any
 * other `action` with a 400, so this list is also the filter's whitelist.
 */
export const AUDIT_ACTION_LABEL = {
  "course.created": "Tạo khóa học",
  "course.updated": "Sửa khóa học",
  "course.published": "Xuất bản khóa học",
  "course.unpublished": "Gỡ xuất bản",
  "course.archived": "Lưu trữ khóa học",
  "course.deleted": "Xóa khóa học",
  "course.demo_stats_cleared": "Xóa nhãn dữ liệu demo",
  "category.created": "Tạo danh mục",
  "category.updated": "Sửa danh mục",
  "category.deleted": "Xóa danh mục",
  "category.reordered": "Sắp xếp danh mục",
  "section.created": "Thêm chương",
  "section.updated": "Sửa chương",
  "section.deleted": "Xóa chương",
  "section.reordered": "Sắp xếp chương",
  "lesson.created": "Thêm bài học",
  "lesson.updated": "Sửa bài học",
  "lesson.deleted": "Xóa bài học",
  "lesson.reordered": "Sắp xếp bài học",
  "resource.created": "Thêm tài liệu",
  "resource.deleted": "Xóa tài liệu",
  "video.attached": "Gắn video",
  "video.detached": "Gỡ video",
  "enrollment.granted": "Cấp quyền học",
  "enrollment.revoked": "Thu hồi quyền học",
  "user.blocked": "Khóa tài khoản",
  "user.unblocked": "Mở khóa tài khoản",
  "user.role_changed": "Đổi vai trò người dùng",
  "purchase.paid": "Đơn hàng đã thanh toán",
  "purchase.refund_requested": "Yêu cầu hoàn tiền",
  "purchase.refund_approved": "Duyệt hoàn tiền",
  "purchase.refund_rejected": "Từ chối hoàn tiền",
  "purchase.refunded": "Hoàn tiền đơn hàng",
  "purchase.cancelled": "Hủy đơn hàng",
  "payment.reconciled": "Đối soát thanh toán",
  "payment.callback_rejected": "Từ chối callback",
  "payment.duplicate_paid": "Thanh toán trùng",
} as const;

/** UX_PLAN.md §9.5 vocabulary; `USER` takes the admin nav label. */
export const AUDIT_ENTITY_LABEL = {
  COURSE: "Khóa học",
  SECTION: "Chương",
  LESSON: "Bài học",
  RESOURCE: "Tài liệu",
  CATEGORY: "Danh mục",
  ENROLLMENT: "Quyền học",
  USER: "Người dùng",
  PURCHASE: "Đơn hàng",
  PAYMENT_ATTEMPT: "Lần thanh toán",
  VIDEO_ASSET: "Video",
} as const;

/** `AuditLogRow` (API_CONTRACT.md §4). */
export type AuditLogRow = {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
};

export type AuditFilters = {
  actorId: string;
  action: string;
  entityType: string;
  /** Calendar days `YYYY-MM-DD` in Vietnam time, as `<input type="date">` sends them. */
  from: string;
  to: string;
};

type SearchParams = Record<string, string | string[] | undefined>;

/** Version 4 only, like the API's `@IsUUID('4')`; any other id is a 400 there. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value)?.trim() ?? "";

/**
 * A real calendar day: `2026-02-30` would be a 400 from the API, and so
 * would a year below 1000, which a half-typed date input submits as `0202`.
 */
function isDay(value: string): boolean {
  if (!/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/**
 * Mirrors the API's rules so a hand-edited URL drops the bad filter instead
 * of drawing a 400 that would read as a server outage. A reversed date pair
 * is swapped: it can only mean the same window, and the inputs then show it.
 */
export function auditFilters(params: SearchParams): AuditFilters {
  const actorId = first(params.actorId);
  const action = first(params.action);
  const entityType = first(params.entityType);
  const days = [first(params.from), first(params.to)].map((day) =>
    isDay(day) ? day : "",
  );
  const [from, to] = days[0] && days[1] && days[0] > days[1] ? days.reverse() : days;
  return {
    actorId: UUID.test(actorId) ? actorId : "",
    action: Object.hasOwn(AUDIT_ACTION_LABEL, action) ? action : "",
    entityType: Object.hasOwn(AUDIT_ENTITY_LABEL, entityType) ? entityType : "",
    from,
    to,
  };
}

/**
 * The API takes instants; a picked day covers the whole day in
 * Asia/Ho_Chi_Minh (UTC+7 all year, no daylight saving), both ends inclusive.
 */
export function auditApiQuery(filters: AuditFilters, page?: string): string {
  const query = new URLSearchParams();
  const entries: [string, string | undefined][] = [
    ["actorId", filters.actorId],
    ["action", filters.action],
    ["entityType", filters.entityType],
    ["from", filters.from && `${filters.from}T00:00:00+07:00`],
    ["to", filters.to && `${filters.to}T23:59:59.999+07:00`],
    ["page", page],
  ];
  for (const [key, value] of entries) if (value) query.set(key, value);
  const serialised = query.toString();
  return serialised ? `?${serialised}` : "";
}

/**
 * The admin page that answers "who was affected": the user's page, for a
 * block or an access change (it lists that user's courses). Other rows carry
 * no id an admin page is keyed by.
 */
export function auditEntityHref(row: AuditLogRow): string | null {
  const userId =
    row.entityType === "USER"
      ? row.entityId
      : row.entityType === "ENROLLMENT"
        ? row.metadata?.userId
        : null;
  return typeof userId === "string" && UUID.test(userId)
    ? `/admin/users/${userId}`
    : null;
}

export function auditActionLabel(action: string): string {
  return (AUDIT_ACTION_LABEL as Record<string, string>)[action] ?? action;
}

/**
 * "Bài học · Cài đặt môi trường". The name comes from the metadata the row
 * already carries (title, slug or filename); rows without one, such as a
 * block or a grant, fall back to the start of the entity id.
 */
export function auditEntity(row: AuditLogRow): string {
  const type =
    (AUDIT_ENTITY_LABEL as Record<string, string>)[row.entityType] ??
    row.entityType;
  const name = ["title", "filename", "slug"]
    .map((key) => row.metadata?.[key])
    .find((value): value is string => typeof value === "string" && value !== "");
  const label = name ?? row.entityId?.slice(0, 8);
  return label ? `${type} · ${label}` : type;
}
