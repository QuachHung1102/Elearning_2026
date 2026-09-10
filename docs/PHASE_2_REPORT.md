# Phase 2 — Catalog và soạn nội dung: báo cáo hoàn thành

Ngày: 2026-09-10. Nhánh: `feat/phase-2-catalog`.

Tài liệu này ghi lại **những gì đã dựng, những chỗ lệch so với spec và lý do**, cùng
bằng chứng của từng mục kiểm tra. Nó không lặp lại nội dung `ROADMAP.md` §6.

---

## 1. Kết quả kiểm tra

### Definition of Done (`ROADMAP.md` §4)

| # | Kiểm tra | Kết quả |
|---|---|---|
| D1 | `pnpm lint` | exit 0, không warning |
| D2 | `pnpm typecheck` | exit 0 |
| D3 | `pnpm test` | 103 test đạt (84 api + 19 web), không test bị skip |
| D4 | `pnpm --filter api test:e2e` | 25 test đạt |
| D5 | `pnpm build` | exit 0 cả hai app |
| D6 | Replay migration trên DB sạch | 3 migration chạy trên `elearning_ci` mới tạo; sau replay `courses_price_vnd_check` và `courses_compare_price_check` vẫn còn |
| D7 | Seed chạy lại | chạy hai lần trên DB ở D6, lần hai exit 0, có in log, đúng 1 admin |
| D8 | Console sạch | 14 trang: 0 lỗi ứng dụng, 0 React warning. Duy nhất một `401` của `GET /auth/me` — đúng hình dạng hợp đồng cho khách chưa đăng nhập, trình duyệt tự ghi mọi response khác 2xx |
| D9 | Responsive 375/768/1024/1440 | 11 trang × 4 khung: không tràn ngang, không target dưới 44px |
| D10 | Bàn phím | mọi control nhìn thấy được đều tới bằng `Tab` và đều có focus ring; mục trong `<details>` đóng và radio chưa chọn được tính đúng theo hành vi native |
| D11 | Tương phản | `design/contrast-check.py` → **46/46** đạt (44 cũ + 2 cặp `on-accent-subtle` mới), exit 0 |
| D12 | `prefers-reduced-motion: reduce` | `--duration-fast` và `--duration-base` về `1ms`, 0 phần tử còn animation |
| D13 | Ngôn ngữ | 14 trang: 100% tiếng Việt, không emoji, `lang="vi"` |
| D14 | CI | workflow đã có từ Phase 1, chạy D1–D7 |
| D15 | Trạng thái tải và lỗi | tắt API: trang có cache phục vụ dữ liệu cũ (đúng ý đồ ISR); trang chưa có cache và toàn bộ `/admin/*` hiện `error.tsx` tiếng Việt, không trang trắng, không stack trace |

D8–D13 và D15 được đo bằng script Playwright chạy một lần trên máy build, **không
commit vào repo**: chúng trỏ tới bản Playwright trong cache npx của máy này và mang
sẵn id của khoá học dùng để thử. Bộ kiểm tra trình duyệt chính thức thuộc Phase 5
(`ROADMAP.md` §4). Kết quả các script đó đo được ghi nguyên trong bảng trên.

### Acceptance của phase (`ROADMAP.md` §6)

15 mục dương và 14 mục âm đều đã chạy. Phân bố bằng chứng:

| Nguồn bằng chứng | Mục |
|---|---|
| `apps/api/test/catalog.e2e-spec.ts` (25 test) | A2.4, A2.5, A2.6, A2.9, A2.10, A2.12, A2.13, A2.14, A2.15, N2.1, N2.3, N2.4, N2.5, N2.6, N2.7, N2.9, N2.12, N2.13, N2.14 |
| Script acceptance chạy trên server thật (xem ghi chú trên) | A2.1, A2.2, A2.3, A2.7, A2.8, N2.1, N2.2, N2.5, N2.8 |
| `psql` trên `elearning_ci` sau replay | A2.4, A2.5, N2.7 (cả hai `CHECK`) |
| Hai tiến trình API song song (`STORAGE_DRIVER=demo` và `=r2`) | N2.11 |
| `src/media/local-file.spec.ts` (13 test) | N2.10, N2.14, và test chốt chặn "URL tải về không dùng được để ghi đè" |
| Script demo chạy trên trình duyệt thật | A2.11, 16 bước demo script |

Điểm đáng chú ý ở N2.4: `POST /admin/courses` không kèm cookie ban đầu trả
`403 CSRF_INVALID`, **lộ ra rằng route tồn tại**. `CsrfGuard` là guard toàn cục nên
nó chạy trước `AdminGuard`. Đã sửa: khi request rơi vào tiền tố `/admin/` hoặc
`/dev/`, `CsrfGuard` ném `NotFoundException` thay vì `403`. Bây giờ N2.3, N2.4 và
một đường dẫn không tồn tại trả **cùng một body**, và e2e assert đúng điều đó.

---

## 2. Đã dựng những gì

### Backend — 36 route mới

`src/catalog/` (public + admin), `src/media/` (storage seam, stream seam,
`LocalFileController`, upload URL, video asset), `src/reporting/`.

Migration `add_catalog`: 6 bảng, 6 enum, cộng 2 `CHECK` viết tay nối vào cuối
`migration.sql`.

Seam theo đúng mẫu của `DEMO_MODE.md` §1 — một token, một interface, đúng hai lớp,
chọn bằng `useClass` với biểu thức ba ngôi:

| Seam | Token | Lớp demo | Lớp thật |
|---|---|---|---|
| Lưu trữ file | `OBJECT_STORAGE` | `LocalDiskStorage` | `R2ObjectStorage` |
| Video | `STREAM_CLIENT` | `LocalStreamClient` | `CloudflareStreamClient` |

`LocalFileController` chỉ vào mảng `controllers` khi `STORAGE_DRIVER !== 'r2'` —
đã kiểm chứng: ở chế độ `r2`, log Nest không map route `media/local` nào và một
object key **có thật** trả `404`, trong khi instance demo trả `200` cho đúng key đó.

### Frontend — 17 trang, 15 file component mới

Công khai: `/` (viết lại), `/courses`, `/courses/[slug]`, `/categories/[slug]`,
`/about`, bốn trang pháp lý, `sitemap.ts`, `robots.ts`.
Quản trị: `/admin`, `/admin/categories`, `/admin/courses`, `/admin/courses/new`,
`/admin/courses/[id]`, `.../curriculum`, `.../lessons/[lessonId]`.

Hai dependency mới ở `apps/web`: `marked` và `sanitize-html`, đúng như ROADMAP cho
phép, và chỉ dùng ở một chỗ duy nhất là `src/lib/markdown.ts`.

---

## 3. Sai lệch so với spec, kèm lý do

Mỗi mục dưới đây là một chỗ spec không tự nhất quán hoặc không chạy được như viết.
Không mục nào là chọn cho tiện.

### 3.1 Thêm route thứ 36: `GET /admin/lessons/{id}`

`API_CONTRACT.md` §5.2 chốt `GET /admin/courses/{id}` **chỉ trả outline** (A2.10
kiểm đúng điều đó) và nói admin xem trước nội dung bằng `/learn/*`. Nhưng trang
`/admin/courses/[id]/lessons/[lessonId]` là **form soạn thảo**: nó phải đọc
`content` hiện tại để đổ vào textarea, nếu không lần lưu đầu tiên sẽ xoá trắng nội
dung cũ. "Xem trước" và "nạp form" là hai việc khác nhau.

Đã thêm `GET /admin/lessons/{id}` trả `LessonOutline + { courseId, sectionTitle,
content, videoAssetId, videoAsset, resources[] }` — đúng bằng phản hồi của `PATCH`
cùng đường dẫn, cộng hai thứ màn hình cần. `GET /admin/courses/{id}` giữ nguyên
sạch outline.

### 3.2 `AuditLog` hoãn sang Phase 3

`API_CONTRACT.md` §5.3 nói mọi mutation admin ghi một dòng `AuditLog`. Nhưng bảng
`audit_logs` nằm ở migration `add_learning` (`DATA_MODEL.md` §Chiến lược migration,
migration số 4 — Phase 3), và `ROADMAP.md` §6 không liệt kê nó trong `add_catalog`.
Không thể ghi vào một bảng chưa tồn tại.

Chọn: giữ nguyên thứ tự migration của `DATA_MODEL.md` và nối audit vào toàn bộ
mutation của Phase 2 khi làm Phase 3. Không acceptance nào của Phase 2 kiểm audit.

### 3.3 `add_catalog` có **2** `CHECK`, không phải 4

`ROADMAP.md` §6 viết "đây là **bốn** `CHECK` cộng một unique một phần". Đọc kỹ bảng
nguồn ở `DATA_MODEL.md` §SQL viết tay: bốn `CHECK` là tổng của **cả hai** migration —
2 cái trên `courses` thuộc `add_catalog`, 2 cái trên `purchases`/`payment_attempts`
cộng unique một phần thuộc `add_payment` (Phase 4). Câu trong ROADMAP đang đính chính
tổng số dòng của bảng, không phải số `CHECK` của phase này.

`add_catalog` vì vậy có đúng 2 `CHECK`, cả hai đã kiểm chứng bằng `psql` sau replay.

### 3.4 `apps/web` có test runner, sớm hơn Phase 5

`ROADMAP.md` §4 viết "không thêm test runner cho `apps/web` trước Phase 5", nhưng
bảng "Test bắt buộc" của §6 lại yêu cầu `apps/web/src/lib/markdown.spec.ts`, và D3
đòi `pnpm test` exit 0 với không test nào bị skip. Hai câu này không thể cùng đúng.

Chọn: ranh giới XSS thắng. Đã thêm `vitest` (environment `node`, không jsdom, không
thư viện render) chỉ để chạy spec hàm thuần. Playwright vẫn để tới Phase 5 — các
script Playwright dùng để nghiệm thu phase này là công cụ chạy một lần, không commit
và không nằm trong `package.json`.

### 3.5 Thủ tục sắp xếp lại: pha 2 viết theo từng id

`DATA_MODEL.md` §Section mô tả pha 2 là **một** câu `UPDATE ... SET position =
-position - 1`. `updateMany` của Prisma không tham chiếu được cột ở vế phải, nên viết
đúng như vậy sẽ phải dùng `$executeRaw` với tên bảng động — đắt hơn thứ nó mua.

Đã viết pha 2 thành N lệnh update theo id, trong cùng transaction. Trạng thái cuối
giống hệt, không vi phạm unique. `reorder.spec.ts` mô phỏng ràng buộc
`@@unique([scopeId, position])` và chứng minh cả hai điều: thủ tục hai pha không va
chạm, còn cách một pha thì va chạm thật.

### 3.6 `API_PUBLIC_URL` phải là origin **trình duyệt** thấy

`.env.example` để `API_PUBLIC_URL="http://localhost:3001"`. Uploader trong admin
`PUT` thẳng vào signed URL, nên với giá trị đó lệnh ghi thành cross-origin từ
`localhost:3000` sang `localhost:3001` — mà API không bật CORS, đúng theo thiết kế
"trình duyệt luôn thấy cùng origin" của `DEMO_MODE.md` §7. Upload ảnh bìa hỏng.

Đã đổi `.env.example`, `.env` và chú thích trong `DEMO_MODE.md` §7 sang
`http://localhost:3000` — origin mà `next.config.ts` rewrite `/api/*` về API.

### 3.7 Header không được đọc cookie

`UX_PLAN.md` §2.2 ghi rõ `(marketing)/layout.tsx` "không đọc cookie", nhưng
`SiteShell` của Phase 1 gọi `getSession()`. Hệ quả đo được: `/` và `/courses/[slug]`
build ra `ƒ` (dynamic), tức `revalidate = 300` không có tác dụng.

Đã tách phần phụ thuộc phiên thành island `UserMenu` (`src/components/user-menu.tsx`)
và gom lời gọi `GET /auth/me` vào `src/lib/viewer.ts` để một trang chỉ hỏi một lần.
Sau đó `/` và cả 5 trang `/courses/[slug]` build ra `○`/`●` với `Revalidate 5m`.

### 3.8 `/categories/[slug]` là dynamic, không phải ISR

`UX_PLAN.md` §2.2 ghi `generateStaticParams + revalidate 300`, nhưng cùng tài liệu
§3.1 yêu cầu trang này có `SortSelect` và `Pagination` — hai thứ đọc `searchParams`,
mà đọc `searchParams` là dynamic. Không thể vừa tĩnh vừa nhận tham số sắp xếp.

Chọn: giữ `SortSelect` + `Pagination`, chấp nhận dynamic, và cache ở tầng fetch
(`revalidate 60`) để tải trọng lên API vẫn thấp.

### 3.9 `TrustStats` chưa hiện số học viên

`enrollmentCount` là **số thật ở mọi thời điểm** (`DATA_MODEL.md` §Quy tắc nhãn dữ
liệu demo, quy tắc 2), và ở Phase 2 nó bằng 0 vì chưa có bảng `enrollments`. In
"0 học viên" làm khối uy tín trên trang chủ là tự bắn vào chân, còn bịa một con số
thì vi phạm chính quy tắc đó.

Chọn: ô thứ ba tạm hiển thị số danh mục — một con số thật — và đổi sang số học viên
ở Phase 3. `TrustStats` nhận `studentLabel` nên đổi lại là một dòng.

### 3.10 Link `/my-courses` trỏ tạm về `/courses`

Phase 1 đã ship link tới `/my-courses` (menu tài khoản, đích sau đăng nhập) trong khi
trang đó thuộc Phase 3. Đo được: 3 lỗi `404` trên console ngay sau khi đăng nhập.

Chọn: một hằng số `src/lib/routes.ts` → `LEARNER_HOME = "/courses"`, và bỏ dòng menu
"Khóa học của tôi" cho tới khi trang tồn tại. Phase 3 đổi một dòng.

### 3.11 Bốn trang pháp lý dựng sớm

Footer của Phase 1 link tới `/terms` và `/privacy`; Next prefetch hai link đó và ăn
`404` trên mọi trang có footer. `UX_PLAN.md` §3.1 đã đặc tả sẵn bốn trang này (nội
dung Markdown, banner **BẢN NHÁP**, `noindex`), nên dựng chúng rẻ hơn là gỡ link.

Nội dung là bản nháp, có banner cảnh báo và `robots: noindex` — không trang nào được
hiểu nhầm là chính sách đang có hiệu lực.

### 3.12 `express` khai báo tường minh ở `apps/api`

Đường ghi `PUT /media/local/{key}` cần `express.raw({ type: '*/*', limit })` gắn
riêng cho route đó (`DEMO_MODE.md` §3 bước 6). `express` vốn đã có qua
`@nestjs/platform-express` và `@types/express` vốn đã là devDependency trực tiếp,
nhưng pnpm cô lập node_modules nên không import được nếu không khai báo. Đây là khai
báo lại một dependency đã cài, không phải cài thêm gói mới.

### 3.13 `res.sendFile` không dùng được

`sendFile` của Express 5 trên môi trường này gọi callback lỗi với mọi file, kể cả
file có thật — biểu hiện: `404` kèm header đã set. Đường đọc đã đổi sang
`pipeline(createReadStream(path), response)` sau một lần `stat`. Ít tầng hơn, và
stream được cho file 50 MB.

---

## 4. Ba chỗ phải đọc kỹ khi review

1. **`src/media/local-file.controller.ts`** — chỗ duy nhất trong demo mode nhận
   *đường dẫn* từ client. Thứ tự bước 0→6 là biên tin cậy, không phải phong cách.
   Đặc biệt: chữ ký chứa HTTP method (nếu không, URL tải tài liệu của học viên cũng
   là chữ ký `PUT` hợp lệ đè lên chính file đó), và đường ghi **không có** ngoại lệ
   nào cho prefix `public/`.
2. **`apps/web/src/lib/markdown.ts`** — allowlist, không phải denylist. 19 test bao
   `<script>`, `onerror=`, `javascript:`, `<svg onload>`, `<iframe>`, entity đã mã
   hoá, `data:` URI, link protocol-relative và `style=`.
3. **`src/catalog/catalog.service.ts` → `recompute()`** — một hàm ghi duy nhất cho
   `lessonCount` và `totalDurationSeconds`, gọi trong cùng transaction với **mọi**
   mutation chạm curriculum. Publish chỉ là một caller nữa.

---

## 5. Nợ kỹ thuật đã đánh dấu

| Vị trí | `ponytail:` | Ngưỡng nâng cấp |
|---|---|---|
| `src/catalog/search-text.ts` | không index `search_text` | `EXPLAIN ANALYZE` của `GET /courses?q=` vượt 50 ms → thêm `pg_trgm` + GIN |
| `src/auth/auth-rate-limit.guard.ts` (Phase 1) | rate limit theo tiến trình | trước khi scale ngang |

`deleteCourse` hiện chặn theo cột phi chuẩn hoá `enrollmentCount` vì bảng
`enrollments` chưa tồn tại; Phase 3 đổi sang đếm thật và FK `Restrict` sẽ là hàng
rào cuối.
