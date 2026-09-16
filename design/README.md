# Thiết kế E-learning

Mở [elearning.pen](./elearning.pen) trong Pencil. Nguồn quy tắc thiết kế:
[UX_PLAN.md](../docs/UX_PLAN.md).

Canvas đã bao phủ toàn bộ trang trong plan: khám phá khóa học, học viên,
quản trị, xác thực và chính sách. Mỗi trang có bản desktop 1440 và mobile 375.

**[Danh sách đầy đủ các trang và ID khung](./PAGE_INVENTORY.md)**

Các cột canvas từ trái sang phải: Khám phá · Học viên · Quản trị · Xác thực ·
Chính sách · Trạng thái và biến thể. Bên dưới là 98 màn trạng thái, hộp thoại và email bản desktop. Khung “00 · Bản đồ thiết kế” nằm đầu canvas.
Dữ liệu khóa học, người dùng và giao dịch là minh họa; trang chính sách là bản nháp.

## Xem nhanh

| Nội dung | Ảnh |
|---|---|
| Bản đồ thiết kế | [Xem](./previews/o4epM.png) |
| Trang chủ desktop | [Xem](./previews/sLtMz.png) |
| Trang chủ mobile | [Xem](./previews/o4UOa.png) |
| Catalog | [Xem](./previews/bBUbC.png) |
| Chi tiết khóa học | [Xem](./previews/zs1p0.png) |
| Khóa học của tôi | [Xem](./previews/V2vkY.png) |
| Màn hình học | [Xem](./previews/rufY0.png) |
| Tổng quan quản trị | [Xem](./previews/I7td1i.png) |
| Soạn bài học | [Xem](./previews/qL8fy.png) |
| Thanh toán | [Xem](./previews/EeOua.png) |
| Nền tảng | [Xem](./previews/N25EK.png) |
| Đăng nhập desktop | [Xem](./previews/TvkYO.png) |
| Đăng ký mobile | [Xem](./previews/BoMbi.png) |
| Phiên đăng nhập desktop | [Xem](./previews/NTXYi.png) |
| Liên hệ mobile | [Xem](./previews/KhtCm.png) |

## Kiểm tra

Đối chiếu route: 36 route, trong đó 35 trang có giao diện đều có desktop/mobile;
`/learn/[courseSlug]` chỉ chuyển hướng tới bài học.

MCP đếm 208 khung gốc, không phát hiện chồng khung, clipping hoặc placeholder
còn sót. Đã kiểm tra ảnh render các nhóm màn hình và tablet.
`py -3 design/contrast-check.py` đạt 23/23 cặp. Sản phẩm chỉ có giao diện sáng.

Thiết kế sẵn sàng review; việc triển khai code vẫn theo từng phase trong roadmap.
