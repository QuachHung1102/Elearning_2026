# Danh sách trang và bản thiết kế

Đối chiếu với `docs/UX_PLAN.md` §2.3. Mở [elearning.pen](./elearning.pen) trong Pencil và tìm khung theo tên hoặc ID bên dưới.

Có **36 route**: **35 trang có giao diện**, mỗi trang có bản desktop 1440 và mobile 375; một route chỉ chuyển hướng.

| Trang | Route | Desktop 1440 | Mobile 375 |
|---|---|---|---|
| Trang chủ | `/` | `sLtMz` | `o4UOa` |
| Khám phá khóa học | `/courses` | `bBUbC` | `HDEkl` |
| Chi tiết khóa học | `/courses/[slug]` | `zs1p0` | `DYSpU` |
| Lập trình web | `/categories/[slug]` | `g7X7TA` | `d1iJX` |
| Giới thiệu | `/about` | `w4YVuJ` | `eoiXT` |
| Liên hệ | `/contact` | `L8adCM` | `KhtCm` |
| Điều khoản sử dụng | `/terms` | `g7HE2j` | `YJ57D` |
| Chính sách bảo mật | `/privacy` | `iOChM` | `CdV76` |
| Chính sách hoàn tiền | `/refund` | `AptIq` | `EEx9e` |
| Chính sách thanh toán | `/payment` | `Btdhi` | `dro7N` |
| Đăng nhập | `/login` | `TvkYO` | `wSwgr` |
| Tạo tài khoản | `/register` | `K5J0zE` | `BoMbi` |
| Quên mật khẩu | `/forgot-password` | `WMVPs` | `sTNju` |
| Đặt mật khẩu mới | `/reset-password` | `YssGP` | `lbUnq` |
| Xác minh email | `/verify-email` | `ViZFH` | `NR7g7` |
| Khóa học của tôi | `/my-courses` | `V2vkY` | `GoK4Q` |
| Hồ sơ cá nhân | `/account` | `wbTrj` | `Fhgvc` |
| Đổi mật khẩu | `/account/password` | `z9Ed8` | `ZUzHX` |
| Phiên đăng nhập | `/account/sessions` | `NTXYi` | `wlWso` |
| Lịch sử đơn hàng | `/account/orders` | `zAlfr` | `KutWd` |
| Chi tiết đơn hàng | `/account/orders/[id]` | `xWLk3` | `Cqbmn` |
| Chuyển tới bài học gần nhất | `/learn/[courseSlug]` | Chuyển hướng | Không có màn hình riêng |
| Màn hình học | `/learn/[courseSlug]/[lessonId]` | `rufY0` | `TZTFh` |
| Thanh toán khóa học | `/checkout/[courseSlug]` | `EeOua` | `lr3AW` |
| Tổng quan · Quản trị | `/admin` | `I7td1i` | `ILI7x` |
| Danh mục · Quản trị | `/admin/categories` | `NUlZ8` | `V7BvGO` |
| Khóa học · Quản trị | `/admin/courses` | `V3sve2` | `GEQBM` |
| Tạo khóa học · Quản trị | `/admin/courses/new` | `RchB6` | `kM0nE` |
| Thông tin khóa học · Quản trị | `/admin/courses/[id]` | `I00GWA` | `iYJsD` |
| Chương trình học · Quản trị | `/admin/courses/[id]/curriculum` | `I0Yk4n` | `wERs5` |
| Soạn bài học · Quản trị | `/admin/courses/[id]/lessons/[lessonId]` | `qL8fy` | `u2eEg` |
| Người dùng · Quản trị | `/admin/users` | `u3GYDL` | `h59Grp` |
| Hồ sơ người dùng · Quản trị | `/admin/users/[id]` | `EpImB` | `QP3ZD` |
| Quyền học · Quản trị | `/admin/enrollments` | `al4qG` | `Q8zLax` |
| Đơn hàng · Quản trị | `/admin/orders` | `RjpXK` | `cgVuK` |
| Nhật ký · Quản trị | `/admin/audit-logs` | `e0pQTr` | `y1DfV` |

## Các biến thể và trạng thái bổ sung

- Dark: trang chủ, catalog, chi tiết khóa học, màn hình học, tổng quan quản trị và các trang nền tảng đã có.
- Tablet: catalog, màn hình học, quản trị và đăng nhập.
- Drawer bộ lọc, drawer chương trình học, modal học thử.
- Không có kết quả tìm kiếm, chưa có khóa học, mất kết nối khi học.
- Thanh toán thành công, hết hạn, chưa xác định kết quả.
- Tạo danh mục/chương/bài học, cấp/thu hồi quyền, khóa tài khoản, xuất bản/lưu trữ, xóa bài học.
- Yêu cầu hoàn tiền và xác nhận hoàn tiền sau khi chuyển tiền thủ công.

## Phạm vi dữ liệu

Tên người dùng, giao dịch và dữ liệu khóa học là nội dung minh họa. Đánh giá từ seed có nhãn “Dữ liệu demo”. Ảnh bìa dùng ảnh stock minh họa.

Trang chính sách thể hiện cấu trúc và bản nháp, không phải nội dung pháp lý đã duyệt. Thông tin giảng viên thực tế cần chủ sở hữu bổ sung. Các trang thanh toán mô tả giai đoạn bật checkout; luồng demo hiện tại vẫn dùng liên hệ để đăng ký.

Đây là thiết kế giao diện, không đồng nghĩa các route backend/frontend đã được triển khai.

