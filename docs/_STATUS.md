# Trạng thái triển khai

Cập nhật: 2026-09-09.

## Đã hoàn thành

| Hạng mục | Bằng chứng |
|---|---|
| Reconcile tài liệu | Sáu spec đã đồng nhất route, page, env và thứ tự phase |
| Phase 1 backend | Auth, token xác minh/reset, hồ sơ, phiên đăng nhập, guard admin, CSRF, rate limit, mail demo, contact, health và error envelope |
| Phase 1 frontend | 9 page mới + trang chủ nền, token light/dark, auth/account/contact, loading/error/not-found, responsive 375/768/1024/1440 |
| PostgreSQL | 2 migration replay sạch trên `elearning_ci`; seed chạy hai lần; đúng 1 admin |
| Kiểm tra | lint ✓, typecheck ✓, 20 unit test ✓, 5 E2E ✓, build ✓ |
| Design token + palette | `design/contrast-check.py` → 44/44 cặp đạt WCAG AA, exit 0 |
| Design system | `DESIGN.md` + `.impeccable/design.json`, đủ 8 phần chuẩn và 8 preview component |
| CI | Workflow Ubuntu + PostgreSQL chạy D1–D7, `prisma generate` trước D1 |

`docs/PROJECT_PLAN.md` giữ sửa đổi làm rõ ảnh bìa khóa học đọc bằng URL không ký;
chỉ `LessonResource` dùng presigned URL.

## Quyết định đã chốt

1. Khóa học kiểu Udemy về **hình thức catalog** (category, search, filter, curriculum
   accordion, bài preview) nhưng **kinh tế vẫn một chủ sở hữu** — không marketplace
   nhiều giảng viên, không chia doanh thu.
2. **Thanh toán làm sau cùng.** Enrollment phải tồn tại từ đầu; đường cấp quyền học
   ngày một là admin manual grant.
3. **Demo-first.** Chưa có ZaloPay / Cloudflare / email provider. Mọi phụ thuộc ngoài
   nằm sau một seam: 1 interface, 2 class (demo + real), chọn bằng env var.
4. Làm hết 5 phase.
5. UI tiếng Việt. File thiết kế: `design/elearning.pen`.

## Design token

Nguồn giá trị chính thức là `UX_PLAN.md` §1.2; canvas dùng cùng token light/dark.

- Nhận diện `primary`: light `#0D9488`, dark `#2DD4BF`.
- Nút có chữ dùng `primary-strong`: light `#0F766E`, dark `#2DD4BF`.
- Chữ trên CTA amber dùng `accent-foreground` `#431407`.
- Chữ phụ trên nền trang/card dùng `muted-foreground`; trên nền muted dùng
  `muted-foreground-strong`.
- Lexend cho tiêu đề, Inter cho nội dung.

Chạy kiểm tra: `py -3 design/contrast-check.py`.

## Thiết kế Phase 1

Đã dựng trên canvas đang mở `design/elearning.pen`:

- 37 khung: nền tảng light/dark, auth, hồ sơ, mật khẩu, phiên đăng nhập,
  liên hệ, các trạng thái phản hồi và biến thể responsive/theme.
- 41 biến thiết kế; có các component Button / Primary, Button / Outline,
  Field / Email.
- Các trang chính có bản desktop 1440 và mobile 375; đăng nhập có thêm 768/1024.
- Kiểm tra canvas: không chồng khung, không clipping, không placeholder còn sót.
- Ảnh xem trước: [design/README.md](../design/README.md).
- Pencil trả phản hồi `save` sau thao tác; MCP đọc lại đúng canvas có nội dung.

Đã chạy lại lint, typecheck, 20 unit test, 5 E2E, build và 44 cặp tương phản:
đều đạt. Bằng chứng replay migration/seed trong bảng trên thuộc lần kiểm tra
trước; phiên này không chạy lại thao tác đó.

## Bổ sung thiết kế toàn bộ sản phẩm

Theo yêu cầu bổ sung các trang chính, canvas đã được mở rộng từ phạm vi Phase 1
sang toàn bộ danh sách route của `UX_PLAN.md`:

- 35 trang có giao diện đều có bản desktop 1440 và mobile 375.
- Route `/learn/[courseSlug]` chỉ chuyển hướng nên không có artboard riêng.
- 119 khung tổng cộng, gồm màn hình chính, dark/tablet và các trạng thái/hộp thoại.
- Kiểm tra MCP cuối cùng: không chồng khung, không clipping, không placeholder.
- Kiểm tra tương phản chạy lại: 44/44 đạt.
- Danh sách trang, ID khung và giới hạn dữ liệu: [PAGE_INVENTORY.md](../design/PAGE_INVENTORY.md).

Review thiết kế toàn bộ sản phẩm; triển khai code tiếp từ Phase 2 theo
`ROADMAP.md`. Các màn hình mới trên Pencil không đồng nghĩa các phase code
đã hoàn thành. Chính sách vẫn là bản nháp và thông tin giảng viên cần bổ sung.
