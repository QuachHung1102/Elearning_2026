import { interfaceCopy } from "./interface-copy";
export type Locale = "vi" | "en";
export const english: Record<string, string> = {
  ...interfaceCopy,
  "Khóa học": "Courses",
  "Lộ trình học": "Learning path",
  "Khóa học của tôi": "My learning",
  "Giới thiệu": "Our story",
  "Dấu ấn sẻ chia": "Our Impact",
  "Liên hệ": "Get in touch",
  "Đăng nhập": "Log in",
  "Đăng ký": "Sign up",
  "Tạo tài khoản": "Create an account",
  "Họ tên": "Your name",
  "Tên hiển thị": "Display name",
  "Mật khẩu": "Password",
  "Mật khẩu mới": "New password",
  "Xác nhận mật khẩu": "Confirm password",
  "Hiện mật khẩu": "Show password",
  "Ẩn mật khẩu": "Hide password",
  "bắt buộc": "required",
  "Quên mật khẩu": "Forgot password",
  "Đặt lại mật khẩu": "Reset password",
  "Đổi mật khẩu": "Change password",
  "Nhập email của bạn.": "Enter your email address.",
  "Email không hợp lệ.": "Enter a valid email address.",
  "Nhập mật khẩu.": "Enter your password.",
  "Nhập tên hiển thị.": "Enter your display name.",
  "Mật khẩu xác nhận không khớp.": "The passwords do not match.",
  "Chưa có tài khoản?": "New to CodingBuddy?",
  "Đã có tài khoản?": "Already have an account?",
  "Tiếp tục từ nơi bạn đã dừng lại.": "Pick up where you left off.",
  "Một tài khoản để giữ quyền học và tiến độ của bạn.":
    "Keep your lessons and progress in one place.",
  "Khi tạo tài khoản, bạn đồng ý với":
    "By creating an account, you agree to the",
  và: "and",
  "Điều khoản sử dụng": "Terms of use",
  "Chính sách bảo mật": "Privacy policy",
  "Chính sách hoàn tiền": "Refund policy",
  "Chính sách thanh toán": "Payment policy",
  "Nội dung": "Message",
  "Gửi liên hệ": "Send message",
  "Đã gửi liên hệ": "Message sent",
  "Về trang chủ": "Back to home",
  "Thử lại": "Try again",
  Đóng: "Close",
  Hủy: "Cancel",
  "Hồ sơ": "Profile",
  "Phiên đăng nhập": "Sessions",
  "Đơn hàng": "Orders",
  "Giảng viên": "Instructor",
  "Quản trị": "Administration",
  "Đăng xuất": "Log out",
  "Tài liệu": "Resources",
  "Tải xuống": "Download",
  "Tài liệu bài học": "Lesson resources",
  "Nội dung bài học": "Lesson content",
  "Bài đọc": "Reading",
  "Đã hoàn thành": "Completed",
  "Hoàn thành bài học": "Complete lesson",
  "Đánh dấu hoàn thành": "Mark as complete",
  "Bài trước": "Previous lesson",
  "Bài tiếp theo": "Next lesson",
  "Tiếp tục học": "Continue learning",
  "Bắt đầu học": "Start learning",
  "Học thử": "Preview",
  "Chương trình học": "Course outline",
  "Đang học": "In progress",
  "Đã xong": "Completed",
  "Đã đăng ký": "Enrolled",
  "Người đứng lớp": "Your tutor",
  "Bạn sẽ học được gì": "What you will learn",
  "Yêu cầu": "Before you start",
  "Khóa học dành cho ai": "Who this course is for",
  "Mô tả khóa học": "About this course",
  "Nội dung khóa học": "Course outline",
  "Câu hỏi thường gặp": "A few practical questions",
  "Đăng nhập để đăng ký học": "Log in to enroll",
  "Đăng ký học": "Enroll in this course",
  "Họ tên cần từ 2 đến 80 ký tự.": "Your name must contain 2–80 characters.",
  "Viết ít nhất 10 ký tự.": "Please write at least 10 characters.",
  "Nội dung không được quá 2.000 ký tự.":
    "Keep your message under 2,000 characters.",
  "Không gửi được liên hệ. Thử lại sau ít phút.":
    "Your message could not be sent. Please try again shortly.",
  "Nội dung bạn đã nhập vẫn được giữ nguyên.": "Your message is still here.",
  "Thông tin chưa hợp lệ.": "Please check the information you entered.",
  "Đã có lỗi từ hệ thống. Vui lòng thử lại.":
    "Something went wrong. Please try again.",
  "Không thể kết nối máy chủ. Vui lòng thử lại.":
    "Cannot reach the server. Please try again.",
};
export function translate(locale: Locale, vi: string, en?: string): string {
  if (locale !== "en") return vi;
  if (en ?? english[vi]) return en ?? english[vi];
  return vi
    .replace(/(\d+) bài học/g, "$1 lessons")
    .replace(/(\d+) bài/g, "$1 lessons")
    .replace(/(\d+) chương/g, "$1 sections")
    .replace(/(\d+) giờ/g, "$1 hr")
    .replace(/(\d+) phút/g, "$1 min")
    .replace(/Thử lại sau (\d+) giây/, "Try again in $1 seconds")
    .replace(/Gửi lại sau (\d+) giây/, "Resend in $1 seconds")
    .replace(/\/2.000 ký tự/, "/2,000 characters");
}
