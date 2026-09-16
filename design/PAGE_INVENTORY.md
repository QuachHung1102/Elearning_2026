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

- Tablet: catalog, màn hình học, quản trị và đăng nhập.
- Drawer bộ lọc, drawer chương trình học, modal học thử.
- Không có kết quả tìm kiếm, chưa có khóa học, mất kết nối khi học.
- Thanh toán thành công, hết hạn, chưa xác định kết quả.
- Tạo danh mục/chương/bài học, cấp/thu hồi quyền, khóa tài khoản, xuất bản/lưu trữ, xóa bài học.
- Yêu cầu hoàn tiền và xác nhận hoàn tiền sau khi chuyển tiền thủ công.

Các trạng thái trên có bản mobile 375; bản desktop nằm ở bảng dưới (trừ drawer bộ lọc và drawer chương trình học, vốn chỉ có trên mobile).

## Trạng thái bổ sung · desktop 1440

98 màn trạng thái, hộp thoại và email, chỉ vẽ bản desktop 1440. Nằm bên dưới canvas, mỗi nhóm một hàng.

| Nhóm | Màn | ID |
|---|---|---|
| Lỗi toàn cục | Không tìm thấy trang | `S0sCD` |
| Lỗi toàn cục | Khóa học không tồn tại | `o7p0yc` |
| Lỗi toàn cục | Đã xảy ra lỗi (`error.tsx`) | `dTK65` |
| Lỗi toàn cục | Lỗi nghiêm trọng (`global-error.tsx`) | `xrGHQ` |
| Xác thực | Xác minh email · Đang xác minh | `AfyPC` |
| Xác thực | Xác minh email · Liên kết không hợp lệ | `OSVqY` |
| Xác thực | Xác minh email · Liên kết hết hạn | `P1cWzo` |
| Xác thực | Đặt mật khẩu mới · Thành công | `h62E7` |
| Xác thực | Đặt mật khẩu mới · Liên kết không hợp lệ | `RGQsl` |
| Xác thực | Đặt mật khẩu mới · Liên kết hết hạn | `L4I7V1` |
| Xác thực | Tạo tài khoản · Email đã được đăng ký | `Roale` |
| Xác thực | Tạo tài khoản · Nhiều lỗi | `EPN67` |
| Xác thực | Đăng nhập · Thử quá nhiều lần | `RV0o8` |
| Khám phá | Chi tiết khóa học · Chưa có quyền học | `TBzLr` |
| Khám phá | Chi tiết khóa học · Giá đã thay đổi | `tTsoE` |
| Khám phá | Khám phá khóa học · Chưa có khóa học | `aYGkF` |
| Khám phá | Khám phá khóa học · Lỗi tải | `PmKrP` |
| Khám phá | Khám phá khóa học · Tìm kiếm không có kết quả | `X35Yqx` |
| Khám phá | Học thử · Không phát được video | `YIOmV` |
| Học viên | Menu tài khoản đang mở | `K2B45A` |
| Học viên | Khóa học của tôi · Đã xong rỗng | `YqORF` |
| Học viên | Khóa học của tôi · Chưa xác minh email và khóa ngừng bán | `WwJKy` |
| Học viên | Lịch sử đơn hàng · Rỗng | `I3wrL` |
| Học viên | Chi tiết đơn hàng · Thất bại | `M18so` |
| Học viên | Chi tiết đơn hàng · Đã hủy | `XyRa4` |
| Học viên | Chi tiết đơn hàng · Chờ hoàn tiền | `WQZfT` |
| Học viên | Chi tiết đơn hàng · Đã hoàn tiền | `Pw9A0` |
| Màn hình học | Phiên xem hết hạn | `JI01K` |
| Màn hình học | Video đang xử lý | `QH1bk` |
| Màn hình học | Không phát được video | `g2uPbd` |
| Màn hình học | Bài đọc | `o3qD2b` |
| Màn hình học | Admin xem trước | `a0CTEL` |
| Màn hình học | Hoàn thành khóa học | `i3KJZM` |
| Thanh toán | Thất bại | `Dd50b` |
| Thanh toán | Đã hủy | `rsLKr` |
| Thanh toán | Không tạo được mã QR | `c3F9a` |
| Thanh toán | Thông tin xuất hóa đơn | `JfDSS` |
| Thanh toán | Chưa xác minh email khi đăng ký học | `EKTU2` |
| Quản trị | Tổng quan · Đã bật thanh toán (5 ô số liệu) | `qAGju` |
| Quản trị | Danh mục · Rỗng | `lKX74` |
| Quản trị | Khóa học · Rỗng | `jFHvK` |
| Quản trị | Chương trình học · Rỗng | `HVA4C` |
| Quản trị | Người dùng · Rỗng | `r7QfH` |
| Quản trị | Quyền học · Rỗng | `VGm43` |
| Quản trị | Nhật ký · Rỗng | `TOsmg` |
| Quản trị | Khóa học · Lỗi tải | `W5b3z5` |
| Quản trị | Khóa học · Dữ liệu cũ | `p9wH0p` |
| Quản trị | Khóa học · Phiên hết hạn | `mQeli` |
| Quản trị | Tạo khóa học · Đường dẫn trùng | `xLS6Q` |
| Quản trị | Thông tin khóa học · Lỗi tải ảnh bìa | `FhY3d` |
| Quản trị | Soạn bài học · Mã video sai | `eE1LM` |
| Quản trị | Thông tin khóa học · Đã lưu trữ | `t2B3s` |
| Quản trị | Hồ sơ người dùng · Đã khóa | `JIxT9` |
| Quản trị | Đơn hàng · Yêu cầu hoàn tiền | `wSSTC` |
| Hộp thoại quản trị | Xóa chương · Chương còn bài | `r998s` |
| Hộp thoại quản trị | Xóa khóa học · Đã có học viên | `L7lGk` |
| Hộp thoại quản trị | Sửa danh mục | `uqG5r` |
| Hộp thoại quản trị | Xóa danh mục · Còn khóa học | `F3748` |
| Hộp thoại quản trị | Khóa tài khoản · Không thể khóa chính mình | `N3tGSt` |
| Hộp thoại quản trị | Cấp quyền học · Không tìm thấy email | `Z3TgIk` |
| Hộp thoại quản trị | Cấp quyền học · Đã có quyền học | `Nbo4S` |
| Hộp thoại quản trị | Duyệt hoàn tiền | `w7nBDw` |
| Hộp thoại quản trị | Từ chối hoàn tiền | `EA2sv` |
| Hộp thoại quản trị | Xuất CSV hóa đơn | `ohs3v` |
| Hộp thoại quản trị | Xuất bản · Server từ chối | `JeMVC` |
| Email | Xác minh email | `PLb1i` |
| Email | Đặt lại mật khẩu | `SrRYc` |
| Email | Biên nhận mua hàng | `y7CUx` |
| Email | Hoàn tiền được duyệt | `noBpk` |
| Email | Hoàn tiền bị từ chối | `tFpjM` |
| Email | Liên hệ mới (gửi chủ sở hữu) | `zAdH9` |
| Xác thực | Đăng nhập · Sai thông tin | `oUMIg` |
| Xác thực | Quên mật khẩu · Đã gửi | `pkQOr` |
| Xác thực | Xác minh email · Chờ xác minh | `C2Inhs` |
| Xác thực | Quên mật khẩu · Đã gửi · Chế độ demo | `gqRVS` |
| Khám phá | Liên hệ · Đã gửi | `CNO2B` |
| Khám phá | Liên hệ · Lỗi gửi | `h8lrGp` |
| Khám phá | Trang chủ · Banner chế độ demo | `t1gmc` |
| Khám phá | Khám phá khóa học · Đang tải | `r93kU4` |
| Học viên | Phiên đăng nhập · Hộp thoại thu hồi | `vMzmN` |
| Học viên | Khóa học của tôi · Rỗng | `xduYq` |
| Khám phá | Chi tiết khóa học · Các trạng thái đăng ký | `iuPIf` |
| Thanh toán | Mã QR hết hạn | `XuKqN` |
| Thanh toán | Thành công | `X6jWX7` |
| Thanh toán | Chưa xác định | `cAGTa` |
| Màn hình học | Mất kết nối | `JNFHr` |
| Khám phá | Học thử · Đang phát | `qdXOs` |
| Học viên | Chi tiết đơn hàng · Hộp thoại yêu cầu hoàn tiền | `kGvxp` |
| Hộp thoại quản trị | Cấp quyền học | `xOUBc` |
| Hộp thoại quản trị | Thu hồi quyền học | `jQhkp` |
| Hộp thoại quản trị | Thêm danh mục | `Y5vuaN` |
| Hộp thoại quản trị | Thêm chương | `oqyYi` |
| Hộp thoại quản trị | Thêm bài học | `mQu5p` |
| Hộp thoại quản trị | Xuất bản | `p78UVw` |
| Hộp thoại quản trị | Lưu trữ khóa học | `vXClw` |
| Hộp thoại quản trị | Khóa tài khoản | `MchGJ` |
| Hộp thoại quản trị | Xóa bài học | `SqHOy` |
| Hộp thoại quản trị | Xác nhận đã hoàn tiền | `g42Z7r` |

Sản phẩm chỉ có giao diện sáng. Không có biến thể dark.

## Phạm vi dữ liệu

Tên người dùng, giao dịch và dữ liệu khóa học là nội dung minh họa. Đánh giá từ seed có nhãn “Dữ liệu demo”. Ảnh bìa dùng ảnh stock minh họa.

Trang chính sách thể hiện cấu trúc và bản nháp, không phải nội dung pháp lý đã duyệt. Thông tin giảng viên thực tế cần chủ sở hữu bổ sung. Các trang thanh toán mô tả giai đoạn bật checkout; luồng demo hiện tại vẫn dùng liên hệ để đăng ký.

Đây là thiết kế giao diện, không đồng nghĩa các route backend/frontend đã được triển khai.

