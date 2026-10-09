# Trạng thái triển khai

Cập nhật: 2026-10-10. Kế hoạch việc còn lại và trạng thái từng task: [_PLAN.md](./_PLAN.md);
kết quả rà soát ngày 2026-09-30: [REVIEW_2026-09-30.md](./REVIEW_2026-09-30.md).

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
| **Vai trò giảng viên** (nhánh `feat/instructor-role`, chưa merge) | Backend: `StaffGuard` default-deny, khóa học có chủ (`Course.instructorId`), soạn nội dung và media theo chủ khóa, ghi danh kèm tiến độ, đổi vai trò có audit. Web: khu vực `/instructor` (tổng quan, khóa học của tôi, học viên; các trang soạn khóa dùng chung với `/admin`), chọn chủ khóa và đổi vai trò ở `/admin`, tên giảng viên trên trang khóa học. Đã kiểm trên trình duyệt thật ở 1440 và 375; chưa so khung Pencil (`_PLAN.md` T5.1) |
| **Phase 4 — thanh toán (driver demo)** (nhánh `feat/instructor-role`, đã commit local, chưa push) | Backend: migration `add_payment` (`Purchase`, `PaymentAttempt`, 3 enum, `enrollments.purchase_id`, unique một phần và 2 `CHECK` viết tay); `CheckoutModule` với đúng một `confirmPayment` cho callback, reconcile và nút demo; 10 route thanh toán (1 checkout, 3 đơn của học viên, 2 đối soát, 2 hoàn tiền, 1 callback, 1 xác nhận demo đăng ký có điều kiện) và `GET /admin/reports/courses`; `ZaloPayHttpClient` viết theo tài liệu công khai, **chưa chạy với sandbox thật** (A4.9). Web: 4 trang (`/checkout/[courseSlug]`, `/account/orders`, `/account/orders/[id]`, `/admin/orders`) sau cờ `NEXT_PUBLIC_CHECKOUT_ENABLED`. Demo script bước 3–11 chạy đầu-cuối trên seed thật (`test/checkout-flow.e2e-spec.ts`) và trên trình duyệt thật ở 390 và 1440 px |
| **Phase 5 — hardening (một phần)** (nhánh `feat/instructor-role`, đã commit local, chưa push) | Header bảo mật cho API và web (CSP không nonce, HSTS chỉ ở production); một định nghĩa "production" cho boot guard, cookie `Secure`, HSTS và seed; rate limit cho catalog và callback, `no-store` cho danh sách phiên; log JSON có `requestId`, `purchaseId`, `appTransId` và che dữ liệu nhạy cảm; đăng nhập giới hạn theo tài khoản, scrypt có tham số trong chuỗi băm và băm lại khi đăng nhập; lớp `omit` cho `passwordHash`; SEO (JSON-LD `Course`, Open Graph, sitemap đủ mọi trang). Kèm việc dọn của WP2: tên tệp tiếng Việt khi tải về (trước đây 500), lỗi đua slug (5/6 yêu cầu song song nhận 409), index `lesson_progress(lesson_id)`, bỏ `sleep` trong e2e. Chi tiết và bằng chứng từng việc: `_PLAN.md` WP4 |
| PostgreSQL | 4 migration replay sạch trên `elearning_ci`, `prisma migrate diff` không lệch; seed chạy hai lần; đúng 1 admin; 2 `CHECK` còn nguyên sau replay |
| **Lượt 2026-10-05/06** (commit local, chưa push) | Xong T2.6, T2.9, T2.10, T2.12, T2.13, T3.17, T4.5, T4.9, T4.10, T4.11, T4.13, T4.16, T4.17, T5.3 — chi tiết và bằng chứng từng task ở `_PLAN.md`. Lỗi thật tìm ra trong lượt: đối soát đóng nhầm attempt đã thu tiền khi xác nhận bị lỗi (T3.17); deadlock 500 khi sửa/xóa bài song song với sắp xếp lại, trùng vị trí tài liệu/danh mục khi tạo song song (T2.13); mọi request phía server của web dùng chung một bucket rate limit theo IP — 429 ở production khi có tải (T4.17, cần đặt `INTERNAL_API_SECRET` trên Railway) |
| **Lượt 2026-10-10** (commit local, chưa push) | Xong phần code của T4.12 (T4.12a SMTP thật, T4.12b URL tải lên R2 ký độ dài, T4.12c Cloudflare Stream báo lỗi đúng và chép thời lượng), T4.18 (video Cloudflare bắt buộc URL ký — lỗ hổng tìm ra trong lượt), T4.19 (thanh toán demo do người mua tự bấm, theo yêu cầu chủ sở hữu). T4.12 còn phần thử ở staging, cần tài khoản |
| Kiểm tra | Đo 2026-10-10 trên `25ea37e`: lint ✓, typecheck ✓, 613 unit test ✓ (429 api + 184 web), 367 E2E API ✓ (35 tệp), 4/4 Playwright (`corepack pnpm e2e:web`; database `elearning_e2e` phải tồn tại, README "createdb"), build ✓ khi API tắt với `NEXT_PUBLIC_CHECKOUT_ENABLED=true`, `contrast-check.py` 37/37 (đo 2026-10-06, lượt này không đổi màu). Migration: 8 |
| Design token + palette | `design/contrast-check.py` → 37/37 cặp đạt WCAG AA, exit 0 (T4.13 thêm 14 cặp; `accent-hover` đổi sang `#f59e0b`, canvas `.pen` chưa cập nhật — T5.4) |
| Design system | `DESIGN.md` + `.impeccable/design.json`, đủ 8 phần chuẩn và 8 preview component |
| **Giao diện 2026-10-10** | Lượt đánh bóng toàn bộ trang học viên, quản trị, soạn khóa và giảng viên ở 375/768/1440 (T5.1, T5.2) thay cho so khung `.pen` (chủ sở hữu: không cần bám thiết kế); token canvas khớp code (T5.4) |
| CI | **Xanh lần đầu cho `feat/instructor-role` ngày 2026-10-10** (run 37996163730 trên `b63fa59`): lint, typecheck, unit, e2e API, build, replay migration + seed hai lần, Playwright. Hai lỗi chặn đã sửa: image Postgres pull từ mirror ECR Public của image chính thức (Docker Hub lỗi pull liên tiếp); e2e `ECONNRESET` chỉ trên Linux vì supertest tự `listen`/`close` server dùng chung cho từng request song song — app e2e giờ `listen(0)` trước (lỗi này cũng làm `main` đỏ) |

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
6. **Thanh toán giả cho bản demo** (2026-10-10): với `PAYMENT_DRIVER=demo`, trang checkout hiện như
   thật và người mua bấm "Thanh toán" là được ghi danh, không cần admin (T4.19). Production vẫn
   không khởi động với driver demo, nên bản demo công khai chạy ở môi trường Railway không tên
   `production`.

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
cộng 98 màn trạng thái, hộp thoại và email bản desktop; 208 khung tổng cộng. Bổ sung 2026-09-25: 7 trang Giảng viên (desktop + mobile), 2 trạng thái rỗng và trạng thái "Đổi vai trò" ở hồ sơ người dùng admin — 225 khung.
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

Đã dựng với driver `demo` và kiểm chứng đầu-cuối. Đặc tả ở `ROADMAP.md` §8; từng task,
bằng chứng và quyết định P4-1…P4-9 ở [_PLAN.md](./_PLAN.md) (WP3).

Chưa làm hoặc chưa kiểm chứng:

- **A4.9** — gọi sandbox ZaloPay thật: cần hồ sơ merchant và URL callback HTTPS công khai.
  `ZaloPayHttpClient` được kiểm bằng `fetch` giả và hai vector MAC tính ngoài mã bằng `openssl`.
- Nhánh "không xác định" (ba lần poll lỗi) và nhánh giá đổi giữa lúc mở trang chỉ có unit test.
- DoD: D6 (replay trên DB sạch), D10, D12, D13 và cặp màu mới của bốn trang
  chưa rà riêng; D9 mới đo ở 390 và 1440 px.

## Phase 5 — Hardening và mở bán

Đang làm, thứ tự và bằng chứng ở [_PLAN.md](./_PLAN.md) (WP4).

- **Xong:** T4.1 header bảo mật, T4.2 boot guard bổ sung, T4.3 rate limit và cache theo hợp đồng,
  T4.4 log có cấu trúc, T4.6 siết đăng nhập, T4.7 SEO, T4.15 lớp `omit` cho `passwordHash`.
- **Xong thêm (2026-10-05…10):** T4.5, T4.9, T4.10, T4.11, T4.13, T4.16, T4.17, phần code T4.12 (a/b/c), T4.18, T4.19.
- **Ngoài phạm vi — bản demo (chủ sở hữu, 2026-10-10):** T4.8 (nội dung pháp lý; trang giữ banner bản nháp),
  T4.12 phần thử tay ở staging, T4.14 (staging với driver thật), A4.9 (sandbox ZaloPay). Code driver thật
  vẫn có và có test nhân giả, chỉ chưa chạy với tài khoản thật.
- **Biến môi trường mới:** `CSP_MEDIA_ORIGINS` và `NEXT_PUBLIC_SITE_URL` (web), `LOG_REQUESTS` (API);
  `PASSWORD_HASH_COST` chỉ dành cho `.env.test` và bị chặn khởi động ở production.
- **Migration mới:** `20260930010000_add_lesson_progress_lesson_index`.
- **Bản CSP còn dùng `'unsafe-inline'` cho script và style** (Next chèn payload hydrate); chuyển sang
  nonce hoặc SRI khi cần bỏ nó — xem `ponytail:` ở `apps/web/src/lib/security-headers.ts`.
