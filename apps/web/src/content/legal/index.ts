/**
 * Placeholder policy text. `isPlaceholder` drives the draft banner and the
 * noindex tag, so nothing here is ever mistaken for a policy in force.
 */
export type LegalPage = {
  slug: "terms" | "privacy" | "refund" | "payment";
  title: string;
  isPlaceholder: boolean;
  body: string;
};

const OWNER = "chủ sở hữu website";

export const LEGAL: Record<LegalPage["slug"], LegalPage> = {
  terms: {
    slug: "terms",
    title: "Điều khoản sử dụng",
    isPlaceholder: true,
    body: `## Phạm vi

Tài liệu này mô tả cách sử dụng nền tảng học trực tuyến. Khi tạo tài khoản, bạn đồng ý với các điều khoản ở đây.

## Tài khoản

- Mỗi người dùng một tài khoản, không chia sẻ thông tin đăng nhập.
- Bạn chịu trách nhiệm cho mọi hoạt động diễn ra dưới tài khoản của mình.
- ${OWNER} có thể khóa tài khoản vi phạm điều khoản.

## Nội dung khóa học

Toàn bộ video, tài liệu và bài viết thuộc bản quyền của ${OWNER}. Bạn được quyền học và tải tài liệu cho mục đích cá nhân, không được phát tán lại.`,
  },
  privacy: {
    slug: "privacy",
    title: "Chính sách bảo mật",
    isPlaceholder: true,
    body: `## Dữ liệu thu thập

- Email và tên hiển thị, để định danh tài khoản.
- Tiến độ học, để bạn quay lại đúng chỗ đã dừng.
- Nhật ký đăng nhập, để bạn thu hồi được phiên lạ.

## Cách dùng dữ liệu

Dữ liệu chỉ dùng để vận hành nền tảng. Không bán, không chia sẻ cho bên thứ ba ngoài các nhà cung cấp hạ tầng cần thiết.

## Quyền của bạn

Bạn có thể yêu cầu xem, sửa hoặc ẩn danh hóa dữ liệu cá nhân qua trang liên hệ.`,
  },
  refund: {
    slug: "refund",
    title: "Chính sách hoàn tiền",
    isPlaceholder: true,
    body: `## Điều kiện

Yêu cầu hoàn tiền được xem xét trong vòng 7 ngày kể từ khi mở quyền học, nếu bạn đã học dưới 20% số bài.

## Cách yêu cầu

Gửi yêu cầu qua trang liên hệ, kèm địa chỉ email đã dùng để đăng ký. Kết quả được trả lời trong 3 ngày làm việc.`,
  },
  payment: {
    slug: "payment",
    title: "Phương thức thanh toán",
    isPlaceholder: true,
    body: `## Hiện tại

Tính năng thanh toán trực tuyến chưa mở. Để đăng ký học, bạn gửi yêu cầu qua trang liên hệ và quyền học được mở thủ công sau khi xác nhận.

## Sắp tới

Thanh toán qua ZaloPay bằng mã QR. Hóa đơn điện tử cấp theo yêu cầu ghi trong nội dung liên hệ.`,
  },
};
