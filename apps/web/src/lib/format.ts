const TIME_ZONE = "Asia/Ho_Chi_Minh";

const currency = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});
const integer = new Intl.NumberFormat("vi-VN");
const rating = new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 1 });
const date = new Intl.DateTimeFormat("vi-VN", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const dateTime = new Intl.DateTimeFormat("vi-VN", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** `499.000 ₫`. Never abbreviated: `notation: "compact"` gives "13 N" in vi-VN. */
export const formatPrice = (value: number) => currency.format(value);

export const formatNumber = (value: number) => integer.format(value);

/** `4,8` — comma as the decimal mark. */
export const formatRating = (value: number) => rating.format(value);

export const formatDate = (value: string | Date) => date.format(new Date(value));

/** `14:05 01/09/2026` — time first, 24 hour. */
export function formatDateTime(value: string | Date): string {
  const parts = dateTime.formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("hour")}:${get("minute")} ${get("day")}/${get("month")}/${get("year")}`;
}

/** `12 phút`, `1 giờ 30 phút`. Zero units are dropped, never printed as `0 giờ`. */
export function formatDuration(seconds: number): string {
  // Round the total once: rounding the remainder after splitting off hours
  // turned 7199 s into "1 giờ 60 phút".
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0 && minutes === 0) return "dưới 1 phút";
  return [hours > 0 ? `${hours} giờ` : "", minutes > 0 ? `${minutes} phút` : ""]
    .filter(Boolean)
    .join(" ");
}

/** `03:12` under an hour, `1:04:30` from an hour. */
export function formatTimecode(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = Math.floor(seconds % 60);
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(rest)}`
    : `${pad(minutes)}:${pad(rest)}`;
}

export const LEVEL_LABEL = {
  BEGINNER: "Cơ bản",
  INTERMEDIATE: "Trung cấp",
  ADVANCED: "Nâng cao",
  ALL_LEVELS: "Mọi trình độ",
} as const;

export const ROLE_LABEL = {
  STUDENT: "Học viên",
  INSTRUCTOR: "Giảng viên",
  ADMIN: "Quản trị viên",
} as const;

export const STATUS_LABEL = {
  DRAFT: "Bản nháp",
  PUBLISHED: "Đã xuất bản",
  ARCHIVED: "Đã lưu trữ",
  ACTIVE: "Đang hiệu lực",
  REVOKED: "Đã thu hồi",
  PENDING: "Đang chờ",
  PROCESSING: "Đang xử lý",
  READY: "Sẵn sàng",
  ERRORED: "Lỗi",
  PAID: "Đã thanh toán",
  SUCCEEDED: "Thành công",
  REFUND_REQUESTED: "Đang chờ hoàn tiền",
  REFUNDED: "Đã hoàn tiền",
  CANCELLED: "Đã hủy",
  FAILED: "Thất bại",
  EXPIRED: "Đã hết hạn",
  BLOCKED: "Đã khóa",
} as const;
