export const messages = {
  VALIDATION_FAILED: "Thông tin chưa hợp lệ.",
  TOKEN_INVALID: "Liên kết đã hết hạn hoặc đã được dùng.",
  ORDER_MISMATCH: "Danh sách đã thay đổi. Tải lại rồi sắp xếp lại.",
  UNAUTHENTICATED: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  INVALID_CREDENTIALS: "Email hoặc mật khẩu không đúng.",
  CSRF_INVALID: "Không thực hiện được thao tác. Tải lại trang rồi thử lại.",
  NOT_ENROLLED: "Bạn chưa có quyền học khóa này.",
  EMAIL_NOT_VERIFIED: "Xác minh email trước khi thanh toán.",
  SIGNATURE_INVALID: "Liên kết tải xuống đã hết hạn.",
  NOT_FOUND: "Không tìm thấy nội dung.",
  EMAIL_TAKEN: "Email này đã được đăng ký.",
  ALREADY_ENROLLED: "Bạn đã có quyền học khóa này.",
  COURSE_HAS_ENROLLMENTS: "Không xóa được: khóa học đã có học viên.",
  SECTION_NOT_EMPTY: "Xóa hết bài học trong chương trước đã.",
  CATEGORY_NOT_EMPTY: "Danh mục còn khóa học, không xóa được.",
  SLUG_TAKEN: "Đường dẫn này đã được dùng.",
  EXTERNAL_ID_TAKEN: "Video này đã được thêm trước đó.",
  VIDEO_ALREADY_ATTACHED: "Video này đang gắn ở một bài học khác.",
  VIDEO_NOT_READY: "Video đang được xử lý.",
  PAYMENT_EXPIRED: "Mã QR đã hết hạn.",
  PURCHASE_NOT_REFUNDABLE: "Đơn này ngoài chính sách hoàn tiền.",
  SELF_ACTION_FORBIDDEN: "Bạn không thể khóa tài khoản của chính mình.",
  PAYLOAD_TOO_LARGE: "Tệp vượt quá dung lượng cho phép.",
  UNSUPPORTED_MEDIA_TYPE: "Định dạng tệp không được hỗ trợ.",
  COURSE_NOT_PURCHASABLE: "Khóa học này hiện không bán.",
  COURSE_NOT_PUBLISHABLE: "Khóa học chưa đủ điều kiện xuất bản.",
  RATE_LIMITED: "Bạn đã thử quá nhiều lần. Vui lòng đợi rồi thử lại.",
  INTERNAL: "Đã có lỗi từ hệ thống. Vui lòng thử lại.",
  NETWORK_ERROR: "Không thể kết nối máy chủ. Vui lòng thử lại.",
} as const;

/** Codes whose §2.5b row words a second screen differently. */
export const contextMessages = {
  COURSE_HAS_ENROLLMENTS_UNPUBLISH:
    "Không gỡ về bản nháp được: khóa học đang có học viên.",
  /** Course PATCH: a bare CONFLICT there means the published slug is locked. */
  SLUG_LOCKED: "Đường dẫn đã khóa sau lần xuất bản đầu tiên.",
} as const;

export type MessageCode = keyof typeof messages;

export function t(code: string): string {
  return messages[code as MessageCode] ?? messages.INTERNAL;
}
