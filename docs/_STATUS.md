# Trạng thái triển khai

Cập nhật: 2026-09-22.

## Đã hoàn thành

| Hạng mục | Bằng chứng |
|---|---|
| Reconcile tài liệu | Sáu spec đã đồng nhất route, page, env và thứ tự phase |
| Phase 1 backend | Auth, token xác minh/reset, hồ sơ, phiên đăng nhập, guard admin, CSRF, rate limit, mail demo, contact, health và error envelope |
| Phase 1 frontend | 9 page mới + trang chủ nền, token giao diện sáng, auth/account/contact, loading/error/not-found, responsive 375/768/1024/1440 |
| **Phase 2 backend** | Migration `add_catalog` (6 bảng, 6 enum, 2 `CHECK` viết tay), 37 route catalog/media/reporting, seam `ObjectStorage` và `StreamClient` mỗi seam 2 lớp, `LocalFileController` đăng ký có điều kiện |
| **Phase 2 frontend** | 17 trang (5 công khai, 4 pháp lý, 6 quản trị, sitemap, robots), 20 component catalog và quản trị, sanitize Markdown allowlist |
| **Phase 2 seed** | 8 danh mục, 6 khóa, 17 chương, 68 bài, 58 video asset, 12 tài liệu, ảnh bìa PNG sinh xác định — chạy lại hai lần cho cùng kết quả |
| **Phase 3 backend** | Migration `add_learning` (3 bảng, 2 enum), 13 route người dùng/quyền học/nhật ký/trình học, `AuditLog` cho mọi mutation admin, video demo qua URL ký gắn người xem |
| **Phase 3 frontend** | 7 trang (`/my-courses`, 2 trang trình học, 4 trang quản trị), 16 file component mới |
| PostgreSQL | 4 migration replay sạch trên `elearning_ci`, `prisma migrate diff` không lệch; seed chạy hai lần; đúng 1 admin; 2 `CHECK` còn nguyên sau replay |
| Kiểm tra | lint ✓, typecheck ✓, 216 unit test ✓ (162 api + 54 web), 65 E2E ✓, build ✓ (cần API đang chạy ở :3001) |
| Design token + palette | `design/contrast-check.py` → 23/23 cặp đạt WCAG AA, exit 0 |
| Design system | `DESIGN.md` + `.impeccable/design.json`, đủ 8 phần chuẩn và 8 preview component |
| CI | Workflow Ubuntu + PostgreSQL chạy D1–D7, `prisma generate` trước D1. Chưa chạy cho nhánh Phase 3 (chưa push); bước build dự kiến fail vì `web build` cần API đang chạy (`PHASE_3_REPORT.md` §6) |

`docs/PROJECT_PLAN.md` giữ sửa đổi làm rõ ảnh bìa khóa học đọc bằng URL không ký;
chỉ `LessonResource` dùng presigned URL.

## Quyết định đã chốt

1. Có vai trò INSTRUCTOR (2026-09-23): giảng viên tự soạn và xuất bản khóa của mình;
   admin cấp vai trò và gán chủ khóa. Vẫn không chia doanh thu.
2. **Thanh toán làm sau cùng.** Enrollment phải tồn tại từ đầu; đường cấp quyền học
   ngày một là admin manual grant.
3. **Demo-first.** Chưa có ZaloPay / Cloudflare / email provider. Mọi phụ thuộc ngoài
   nằm sau một seam: 1 interface, 2 class (demo + real), chọn bằng env var.
4. Làm hết 5 phase.
5. UI tiếng Việt. File thiết kế: `design/elearning.pen`.

## Design token

Nguồn giá trị chính thức là `UX_PLAN.md` §1.2; canvas dùng cùng token. Sản phẩm chỉ có giao diện sáng.

- Nhận diện `primary`: `#0D9488`.
- Nút có chữ dùng `primary-strong`: `#0F766E`.
- Chữ trên CTA amber dùng `accent-foreground` `#431407`.
- Chữ trên nền `accent-subtle` dùng `on-accent-subtle`: `#431407`
  (token mới của Phase 2 — badge `−n%`).
- Chữ phụ trên nền trang/card dùng `muted-foreground`; trên nền muted dùng
  `muted-foreground-strong`.
- Lexend cho tiêu đề, Inter cho nội dung.

Chạy kiểm tra: `py -3 design/contrast-check.py`.

## Thiết kế Phase 1

Đã dựng trên canvas `design/elearning.pen`:

- 37 khung: nền tảng thiết kế, auth, hồ sơ, mật khẩu, phiên đăng nhập,
  liên hệ, các trạng thái phản hồi và biến thể responsive.
- 41 biến thiết kế; có các component Button / Primary, Button / Outline,
  Field / Email.
- Các trang chính có bản desktop 1440 và mobile 375; đăng nhập có thêm 768/1024.
- Ảnh xem trước: [design/README.md](../design/README.md).

## Bổ sung thiết kế toàn bộ sản phẩm

Canvas đã được mở rộng từ phạm vi Phase 1 sang toàn bộ danh sách route của
`UX_PLAN.md`: 35 trang có giao diện đều có bản desktop 1440 và mobile 375,
cộng 98 màn trạng thái, hộp thoại và email bản desktop; 208 khung tổng cộng.
Sản phẩm chỉ có giao diện sáng. Danh sách trang, ID khung và giới hạn dữ liệu:
[PAGE_INVENTORY.md](../design/PAGE_INVENTORY.md).

Các màn hình trên Pencil **không** đồng nghĩa các phase code đã hoàn thành.

## Phase 2 — Catalog và soạn nội dung

Đã dựng và kiểm chứng. Chi tiết từng hạng mục, sai lệch so với spec và bằng chứng
kiểm tra: [PHASE_2_REPORT.md](./PHASE_2_REPORT.md).

Điểm cần biết trước khi đọc code (trạng thái lúc hết Phase 2 — ba mục cuối đã đóng ở
Phase 3, trừ `/checkout/*` thuộc Phase 4):

- `GET /admin/lessons/{id}` là route thứ 36, thêm ngoài 35 route của hợp đồng:
  không có nó thì editor bài học không đọc lại được `content` để đổ vào form.
- `AuditLog` chưa ghi. Bảng `audit_logs` thuộc migration `add_learning` của
  Phase 3; mọi mutation của Phase 2 sẽ được nối vào audit ở phase đó.
- `enrollmentCount` luôn bằng 0 cho tới khi có bảng `enrollments`.
- Ba khóa `/my-courses`, `/learn/*`, `/checkout/*` vẫn chưa có trang. Link tới
  `/my-courses` đã được trỏ tạm về `/courses` qua `src/lib/routes.ts`.

## Phase 3 — Trải nghiệm học

Đã dựng và kiểm chứng trên nhánh `feat/phase-3-learning`. Chi tiết, sai lệch so với
spec và bằng chứng: [PHASE_3_REPORT.md](./PHASE_3_REPORT.md).

| Hạng mục | Bằng chứng |
|---|---|
| Backend | Migration `add_learning` (3 bảng, 2 enum), 13 route mới (người dùng, quyền học, nhật ký, trình học, playback token, tải tài liệu), `AuditLog` nối vào mọi mutation admin của Phase 2 |
| Frontend | 7 trang (`/my-courses`, `/learn/[courseSlug]`, `/learn/[courseSlug]/[lessonId]`, `/admin/users`, `/admin/users/[id]`, `/admin/enrollments`, `/admin/audit-logs`), 16 file component mới, không thêm dependency |
| Seed | 3 enrollment, 9 `LessonProgress` cho `student1`; chạy hai lần trên `elearning_ci` cho cùng kết quả |
| PostgreSQL | 4 migration replay sạch trên `elearning_ci`, `migrate diff` không lệch schema |
| Kiểm tra | lint ✓, typecheck ✓, 195 unit test ✓ (141 api + 54 web), 55 E2E ✓, build ✓ (cần API chạy) |
| Acceptance | 14/14 mục dương, 17/17 mục âm có bằng chứng |
| Demo script | 17 bước trên trình duyệt thật: 16 đạt, bước 11 đạt một phần (API đúng, web không in số học viên) |

Điểm cần biết trước khi đọc code:

- Video demo là `apps/api/assets/demo/sample.mp4`, phục vụ qua URL đã ký gắn với người
  xem trên `/api/v1/media/local/videos/*.mp4`; không còn file nào trong `apps/web/public`.
- Tài khoản bị khóa đăng nhập thấy đúng câu sai mật khẩu, không có câu "Tài khoản đã bị
  khóa" (N3.14).
- Bài "Học thử" mở ngay trong trình học; chưa có `PreviewDialog`.
- So khung Pencil chưa làm: không có file `.pen` nào đang mở trong Pencil.

Vấn đề mở, cần quyết (`PHASE_3_REPORT.md` §6): `web build` cần API đang chạy nên bước
build của CI sẽ fail; `enrollmentCount` chưa hiển thị ở web công khai và `TrustStats`
vẫn in số danh mục; PostgreSQL local chạy `Asia/Bangkok` làm mốc thời gian lưu lệch
7 giờ.

## Phase 4 — Thanh toán

Chưa bắt đầu. Đọc `ROADMAP.md` §8.
