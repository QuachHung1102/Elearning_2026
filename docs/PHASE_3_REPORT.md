# Phase 3 — Trải nghiệm học: báo cáo hoàn thành

Ngày: 2026-09-22. Nhánh: `feat/phase-3-learning` (5 slice: A `7a0ce9e`, B `1793142`,
E `e69fe52`, C `32d1683`, D `c8a6a41`).

Tài liệu này ghi lại **những gì đã dựng, những chỗ lệch so với spec và lý do**, cùng
bằng chứng của từng mục kiểm tra. Nó không lặp lại nội dung `ROADMAP.md` §7. Mọi con
số dưới đây lấy từ lệnh đã chạy trong lượt nghiệm thu cuối, không ước lượng.

---

## 1. Kết quả kiểm tra

### Definition of Done (`ROADMAP.md` §4)

| # | Kiểm tra | Kết quả |
|---|---|---|
| D1 | `pnpm lint` | exit 0; `oxlint src/ test/` và `eslint --max-warnings 0` chạy riêng cũng exit 0, không in warning nào |
| D2 | `pnpm typecheck` | exit 0 cả hai app |
| D3 | `pnpm test` | **195** test đạt (141 api trong 19 file + 54 web trong 5 file), không test bị skip |
| D4 | `pnpm --filter api test:e2e` | **55** test đạt trong 5 file, không skip |
| D5 | `pnpm build` | exit 0 cả hai app **khi API đang chạy ở :3001**. Tắt API thì `web build` fail ở prerender `/categories/[slug]` (`ECONNREFUSED`) — xem §6 vấn đề mở 1 |
| D6 | Replay migration trên DB sạch | `DROP DATABASE elearning_ci` + `CREATE` → `prisma migrate deploy` exit 0, 4 migration; `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` → "No difference detected", exit 0; `courses_price_vnd_check` và `courses_compare_price_check` còn nguyên |
| D7 | Seed chạy lại | chạy hai lần trên DB ở D6, cả hai exit 0, có in log ("Seeded 3 enrollments, 9 lesson progress rows"). Sau lần hai: 1 admin, 3 enrollment, 9 `lesson_progress`, 0 `audit_logs`, `enrollment_count` C1 = 2, C2 = 1 |
| D8 | Console sạch | 12 route × 4 khung (48 lần tải): 0 error, 0 warning. Lỗi console duy nhất trong cả buổi là `401` của `POST /auth/login` ở bước demo 15 — đúng response hợp đồng cho tài khoản bị khóa, trình duyệt tự ghi mọi response khác 2xx |
| D9 | Responsive 375/768/1024/1440 | 12 route × 4 khung: không tràn ngang (`scrollWidth − innerWidth ≤ 0`), 0 control dưới 44×44 px |
| D10 | Bàn phím | Trình học ở 1440 và 375, `/admin/enrollments`, `/admin/users/[id]`: mọi control tới được bằng `Tab`, đều có focus ring; vòng `Tab` quay về đầu trang, không bẫy; dialog là `<dialog>` modal native (`:modal` = true), `Esc` đóng và trả focus về nút mở |
| D11 | Tương phản | `design/contrast-check.py` exit 0 — 23/23 cặp đạt, 3/3 cặp cấm vẫn dưới ngưỡng. Phase này không thêm token màu nào (`globals.css` chỉ thêm `scroll-margin-top`) |
| D12 | `prefers-reduced-motion: reduce` | 5 trang (kèm drawer và dialog đang mở): `--duration-fast` = `1ms`, 0 animation đang chạy, 0 phần tử có transition/animation > 10 ms |
| D13 | Ngôn ngữ | 9 trang mới: `lang="vi"`, không emoji (ký tự tượng hình duy nhất bắt được là `©` ở footer). Chữ Latinh còn lại là tên riêng (React, Figma, NestJS), nội dung seed, tên phím `Home`/`End` trong bảng phím tắt, và nhãn "Từ chối callback" lấy nguyên từ bảng từ vựng `DATA_MODEL.md` §AuditLog |
| D14 | CI | **Chưa kiểm được**: nhánh chưa push. Đọc `.github/workflows/ci.yml` thì bước `corepack pnpm build` chạy khi không có API nào đang chạy — theo D5 bước đó sẽ fail. Xem §6 vấn đề mở 1 |
| D15 | Trạng thái tải và lỗi | Tắt API, mở 7 route segment mới: 6/7 thấy skeleton `loading.tsx` trước, cả 7 kết thúc ở `error.tsx` tiếng Việt có "Thử lại", không trang trắng, không stack trace. `/my-courses` hiện "Đã xảy ra lỗi" của `app/error.tsx` chứ không phải "Không tải được khóa học của bạn": lỗi nổ ở `getSession()` của `(learner)/layout.tsx`, tầng trên `my-courses/error.tsx` — cấu trúc có từ Phase 1, giống `/account/*` |

D8–D13 và D15 đo bằng Playwright MCP trên server thật (API `node dist/main`, web
`next dev`), không commit script vào repo — giống cách làm của Phase 2.

### Acceptance của phase (`ROADMAP.md` §7)

14 mục dương và 17 mục âm đều có bằng chứng. Không mục nào fail.

| Mục | Bằng chứng |
|---|---|
| A3.1, A3.2, A3.8, A3.9 | `enrollments.e2e-spec.ts` › "grants once, answers a repeat with 200, and counts the learner once" (`201` + `MANUAL_GRANT`; đúng 1 dòng `enrollment.granted`; `GET /courses/{slug}` `enrollmentCount` = 1; lần hai `200`, 1 hàng, bộ đếm không tăng). Demo bước 1: `POST` trả `201`, `source` = `MANUAL_GRANT`; `psql` đếm `enrollment.granted` tăng 10 → 11 |
| A3.3 | `enrollments.e2e-spec.ts` › "returns the learner's own courses with progress and a resume lesson" |
| A3.4, A3.5, N3.3, N3.4, N3.12 | `learning.e2e-spec.ts` › "issues a playback token with exactly three keys and serves it to its viewer only" (đúng 3 key; `200 video/mp4`, `206` với `Range`, `416`; user B → `403 SIGNATURE_INVALID`; không cookie → `403`; `exp` đã qua → `403 SIGNATURE_INVALID`; URL trên `/api/v1/media/local/videos/*.mp4` có `exp` và `sig`). N3.3 chạy thêm bằng TTL thật ở demo bước 12 |
| A3.6 | `learning.e2e-spec.ts` › "saves progress: position never goes back…" — `PUT 120` rồi đọc lại `120`. **Lưu ý:** vị trí đọc lại ở `GET /lessons/{id}/content` (`progress.lastPositionSeconds`), vì `GET /learn/{slug}` theo hợp đồng chỉ trả `completedLessonIds` + `resumeLessonId`, không trả vị trí từng bài; test kiểm thêm `resumeLessonId` của `/learn` trỏ đúng bài vừa lưu |
| A3.7 | Cùng test trên: `completed: true` → `completed_at` khác `NULL`, lần hai không ghi đè. Trên trình duyệt (demo bước 8): tua tới 55/60 s, player tự gửi `{"lastPositionSeconds":57,"completed":true}`; `psql` xác nhận `completed_at` khác `NULL` cho "Bài 2: Nền tảng Figma (phần 2)" |
| A3.10, A3.11, N3.14, N3.15, N3.16, N3.17 | `admin-users.e2e-spec.ts` › "finds a user by part of the email without ever returning a password hash", "blocks a user: sessions revoked, old cookie dead, login refused like a wrong password", "refuses a student with the same 404…", "never lets an admin block their own account" |
| A3.12 | `learning.e2e-spec.ts` › "keeps an ARCHIVED course open to its ACTIVE learners only (A3.12)"; demo bước 14 |
| A3.13, N3.9 | `admin-users.e2e-spec.ts` › "lists the audit log newest first, filtered by the closed vocabulary", "hides the audit log from a student behind the same 404 as a missing path" |
| A3.14 | `learning.e2e-spec.ts` › "lets an admin without an enrollment preview a DRAFT course silently (A3.14)"; demo bước 16 (`psql`: `lesson_progress` 11 → 11, `enrollment_count` của C5 0 → 0) |
| N3.1, N3.2, N3.13 | `learning.e2e-spec.ts` › "applies the DEMO_MODE §2 playback matrix with LocalStreamClient" và "… with a stub StreamClient" (cùng ma trận trên cả hai driver) |
| N3.5, N3.11 | `learning.e2e-spec.ts` › "locks a learner out after a revoke (N3.5, N3.11)" |
| N3.6 | `learning.e2e-spec.ts` › "signs a resource download for an enrolled learner only (N3.6)" |
| N3.7 | `learning.e2e-spec.ts` › "refuses progress for a course the caller is not enrolled in and writes nothing (N3.7)" |
| N3.8 | `enrollments.e2e-spec.ts` › "hides every enrollment endpoint from a student behind a plain 404" |
| N3.10 | `learning.e2e-spec.ts` › "returns LessonContent by access mode and never leaks content to a non-enrolled learner" |

Test đơn vị bắt buộc của `ROADMAP.md` §7 đều có: `enrollment.service.spec.ts` (cấp
trùng, tái kích hoạt, audit, `hasAccess` cho `ARCHIVED`), `playback-token.spec.ts`
(hết hạn, user A/B, lesson X/Y, lật một byte chữ ký), `progress.service.spec.ts`.

### Demo script (`ROADMAP.md` §7, 17 bước)

Chạy trên Chromium qua Playwright MCP, dev DB vừa seed lại. API khởi động với
`PLAYBACK_TOKEN_TTL_SECONDS=120` (biến môi trường của tiến trình, không sửa `.env`)
để bước 12 chờ được hết TTL.

| # | Kết quả | Quan sát |
|---|---|---|
| 1 | Đạt | `/admin/users?q=student3` → đúng 1 dòng. `ManualGrantDialog`: gõ "student3" → gợi ý `student3@elearning.local`; chọn Figma → `POST` `201`, toast "Đã cấp quyền học cho student3@elearning.local." |
| 2 | Đạt | Dòng đầu `/admin/audit-logs`: "02:09 22/09/2026 · admin@elearning.local · Cấp quyền học · Quyền học · 83b48266 · ::1". Lọc `action=enrollment.granted` → 11 dòng, **chỉ** action đó. Không phải "chỉ còn một dòng" vì dev DB còn 10 dòng từ các lần thử trước |
| 3 | Đạt | Đăng xuất qua menu tài khoản, đăng nhập `student3` → `/my-courses` |
| 4 | Đạt | "Thiết kế giao diện với Figma — 0 / 12 bài đã hoàn thành" |
| 5 | Đạt | "Bắt đầu học" → `/learn/thiet-ke-giao-dien-voi-figma/{bài 1}` |
| 6 | Đạt | Video phát (`duration` 60, `readyState` 4, `src` là URL ký trên `/api/v1/media/local/videos/…`). Tua tới 30 s, chờ 16,5 s: đúng **một** `PUT progress` ở giây thứ 14 (`{"lastPositionSeconds":43}`); tải lại → player tua về 43 |
| 7 | Đạt | "Đánh dấu hoàn thành" → `PUT {"completed":true}`, `courseProgress` 1/12; mọi `ProgressBar` "1/12 bài · 8%", sidebar ghi "Đã hoàn thành" |
| 8 | Đạt | "Sau" → bài 2, focus rơi vào tiêu đề bài; tua tới 55 s → tự gửi `completed: true`, thanh tiến độ "2/12 bài · 17%" |
| 9 | Đạt | "Tải xuống" → `200`, `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="tai-lieu-1.pdf"`, byte bắt đầu bằng `%PDF-`. Đo bằng `page.route` chặn đúng request trình duyệt gửi đi: sự kiện `download` của Playwright MCP làm đứt kết nối công cụ (lỗi công cụ, không phải sản phẩm) |
| 10 | Đạt | Mở tab mới `/learn/thiet-ke-giao-dien-voi-figma` → vào bài có `LessonProgress.updatedAt` mới nhất (bài 1: lúc rời trang player đã gửi một `PUT` khi tab bị ẩn). Đúng quy tắc `resumeLessonId` |
| 11 | Đạt một phần | API công khai `GET /courses/thiet-ke-giao-dien-voi-figma` → `enrollmentCount` = 1. **Trang web không hiển thị con số này ở đâu cả** — xem §6 vấn đề mở 2 |
| 12 | Đạt | URL ở bước 6, sau khi `exp` qua (120 s): cửa sổ ẩn danh → `403 SIGNATURE_INVALID`; chính phiên của `student3` → `403 SIGNATURE_INVALID`. Trước hạn: phiên chủ `200`, ẩn danh `403` |
| 13 | Đạt (theo sai lệch 3.8) | Thu hồi qua `RevokeDialog` → `204`. Học viên đang ở bài 1 — bài "Học thử" — tải lại vẫn ở lại trong khung học thử. Mở bài 2 hoặc `/learn/{slug}` → `/courses/thiet-ke-giao-dien-voi-figma?denied=1` với "Bạn chưa có quyền học khóa này." |
| 14 | Đạt | Lưu trữ khóa, cấp lại (select ghi "(Đã lưu trữ)") → `201`. Học viên vào lại được, có `Alert` "Khóa học này đã ngừng nhận học viên mới. Bạn vẫn học được đầy đủ." API `/courses` không còn khóa, `/courses/{slug}` → `404`. Trang `/courses` ở cửa sổ ẩn danh còn hiện khóa ở lần tải đầu (cache fetch `revalidate 60`, stale-while-revalidate), lần tải sau thì hết |
| 15 | Đạt (theo sai lệch 3.4) | `BlockUserDialog` → `PATCH` `200`. Học viên tải lại → `/login?next=/learn/…`. Đăng nhập lại → `401 INVALID_CREDENTIALS`, `Alert` "Email hoặc mật khẩu không đúng." Nhật ký có dòng "Khóa tài khoản · Người dùng · e5d264c9". Mở khóa lại → `200`, `ACTIVE` |
| 16 | Đạt | Admin mở `/learn/kien-truc-backend-voi-nestjs` → vào bài đầu, banner "Bạn đang xem trước với quyền quản trị. Tiến độ học không được ghi lại."; phát 3 s rồi dừng: 0 `PUT progress`, không nút hoàn thành, không khối tài liệu. `psql`: `lesson_progress` 11 → 11, của admin 0 |
| 17 | Đạt | 1440: `Tab` qua link bỏ qua, nút quay lại, trình phát, thanh tua (`aria-valuetext` "52 giây trên 1 phút"), Phát, Tắt tiếng, tốc độ, Phụ đề, Phím tắt, Toàn màn hình, nút hoàn thành, Tải xuống, Sau, các chương và bài; `k` phát, `→` tua +5 s, `Space` dừng, `?` mở bảng phím tắt, `Esc` đóng và trả focus; `Enter` trên chương đổi `aria-expanded`, trên bài thì điều hướng và focus tiêu đề bài mới. 375: nút "Nội dung khóa học" mở drawer, focus ở trong drawer, chọn bài → drawer đóng và focus tiêu đề bài mới; `Esc` đóng và trả focus về nút mở; không tràn ngang |

Trạng thái đã khôi phục sau demo: khóa Figma xuất bản lại (`PUBLISHED`,
`enrollment_count` 0), quyền học của `student3` với Figma thu hồi lại (về `REVOKED`
như trước demo), `student3` đã mở khóa, 2 hàng `lesson_progress` của `student3` do
demo tạo đã xóa bằng `psql` (seed không có hàng nào cho `student3`). Tiến độ của
`student1` khớp seed (bài 9 ở giây 42, chưa xong). Còn lại trong dev DB, không ảnh
hưởng lần chạy sau: các dòng `audit_logs` của demo (bảng chỉ thêm, không sửa, không
xóa) và các enrollment `REVOKED` của `student1`/`student3` có từ trước lượt này.

### So khung thiết kế

**Chưa làm.** `mcp__pencil__get_app_state` trả "A file needs to be open in the
editor" — không có file `.pen` nào đang mở trong Pencil, nên không đọc được khung.
Các khung của Phase 3 (`u3GYDL`/`h59Grp`, `EpImB`/`QP3ZD`, `JIxT9`, `N3tGSt`, `r7QfH`,
`e0pQTr`/`y1DfV`, `TOsmg`, `al4qG`/`Q8zLax`, `VGm43`, `Z3TgIk`, `Nbo4S`, `V2vkY`/`GoK4Q`,
`YqORF`, `WwJKy`, `TBzLr`, `rufY0`/`TZTFh`, `JI01K`, `QH1bk`, `g2uPbd`, `o3qD2b`,
`a0CTEL`, `i3KJZM`) chưa được đối chiếu, gồm cả nút outline "Khóa học của tôi" trên
header player trong khung — code dựng header gọn theo `UX_PLAN.md` §7.2 với link quay
lại.

---

## 2. Đã dựng những gì

### Backend — 13 route mới

`GET|PATCH /admin/users*` (3), `GET /admin/audit-logs` (1),
`GET|POST|DELETE /admin/enrollments*` (3), `GET /enrollments/me` (1),
`GET /learn/{slug}`, `GET /lessons/{id}/content`, `PUT /lessons/{id}/progress`,
`GET /lessons/{id}/resources/{rid}/download` (4), `POST /lessons/{id}/playback-token` (1).
Cộng một nhánh mới trên route sẵn có `GET /media/local/videos/*.mp4` phục vụ video
mẫu đã ký.

Migration `add_learning`: `enrollments`, `lesson_progress`, `audit_logs`, hai enum
`EnrollmentStatus`, `EnrollmentSource` — đúng `DATA_MODEL.md`, chưa có `purchase_id`.

Module mới: `src/audit/` (từ vựng đóng `AUDIT_VOCABULARY`, `AuditService.record(entry, tx?)`,
decorator `@AuditActor()`), `src/enrollment/` (một hàm quyền truy cập cho mọi route
học, `grant`/`revoke`), `src/learning/`, `src/admin/`, `src/common/client-ip.ts`.
Mọi mutation admin của Phase 2 giờ ghi đúng một dòng `AuditLog` trong cùng
transaction và có rate limit 120/60 s theo user.

### Frontend — 7 trang, 16 file component mới

Học viên: `/my-courses`, `/learn/[courseSlug]`, `/learn/[courseSlug]/[lessonId]`.
Quản trị: `/admin/users`, `/admin/users/[id]`, `/admin/enrollments`, `/admin/audit-logs`.
Component: `VideoPlayer` (thẻ `<video>` native, điều khiển tự dựng, phím tắt, thanh
tua `role="slider"`), curriculum biến thể player, `CurriculumDrawer` (`<dialog>`),
`ProgressBar`, `CourseProgressCard`, `ManualGrantDialog`, `RevokeDialog`,
`BlockUserDialog`, `EnrolledBadge`, `DeniedAlert`. Hàm thuần có spec ở
`src/lib/{player,progress-sync,audit,routes}.spec.ts`.

`LEARNER_HOME` đổi sang `/my-courses`, menu tài khoản có lại "Khóa học của tôi"
(đóng mục 3.10 của `PHASE_2_REPORT.md`).

Không thêm dependency npm nào.

### Seed

`student1` → C1 + C2, `student2` → C1, `student3` không có; 9 hàng `LessonProgress`
cho `student1` trên C1 (8 bài xong, bài 9 dở ở giây 42 và là `resumeLessonId`); chạy
lại thì ép các enrollment đó về `ACTIVE`, ghi lại tiến độ về đúng giá trị seed và
đặt `enrollment_count` = số enrollment `ACTIVE`. Seed không ghi `audit_logs`.

---

## 3. Sai lệch so với spec, kèm lý do

### 3.1 File video demo nằm trong `apps/api`, URL ký gắn với người xem

`DEMO_MODE.md` bản cũ để `sample.mp4` trong `apps/web/public` và trả `DEMO_VIDEO_URL`
thô — ai biết đường dẫn cũng tải được, và N3.3/N3.4 không kiểm được gì. Đã chuyển
file sang `apps/api/assets/demo/sample.mp4` (tự sinh bằng ffmpeg, CC0, 1.948.743 byte,
60 giây, có `LICENSE.txt`), biến `DEMO_VIDEO_FILE`, `DEMO_VIDEO_DURATION_SECONDS=60`.
`StreamClient.signPlayback` thêm tham số `viewerId`; chữ ký là HMAC của
`local-file:GET:{key}:{exp}:{viewerId}`, khi phục vụ thì đọc người xem từ cookie phiên.
Cloudflare bỏ qua `viewerId` vì token Cloudflare không gắn người xem. Tài liệu đã sửa:
`DEMO_MODE.md` §2 + §7, `DATA_MODEL.md`, `PLAN_SUPPLEMENT.md` §3 và rủi ro 3,
`API_CONTRACT.md` §6.1, `.env.example`.

### 3.2 Ngưỡng 95% tính ở client

`ROADMAP.md` §7 ghi `progress.service.spec.ts` kiểm "vượt 95% thời lượng thì set
`completedAt`". Nhưng cùng mục đó chốt ngưỡng đọc `video.duration` của thẻ `<video>`
đang phát, và thời lượng bài học trong seed là số giả. Server không tự hoàn thành
theo `Lesson.durationSeconds`; client gửi `completed: true` khi vượt ngưỡng, server
chỉ đảm bảo `completedAt` ghi một lần và `completed: false` bỏ đánh dấu. Ngưỡng có
spec ở `apps/web/src/lib/player.spec.ts`. Đã sửa bảng test của `ROADMAP.md` §7.

### 3.3 Field cộng thêm vào DTO

`GET /learn/{slug}` trả `course.status` và `EnrollmentItem.course` có `status`: web cần
nó để hiện `Alert` và badge "Đã ngừng bán" cho khóa `ARCHIVED`, mà hai shape trong hợp
đồng không mang field này. `GET /enrollments/me` nhận `sort` ∈ `grantedAt:desc`
(mặc định) | `grantedAt:asc` | `lastActivityAt:desc` để `/my-courses` xếp theo lần học
gần nhất (`UX_PLAN.md` §5.2); giá trị khác → `400`. `GET /admin/users` có thêm tham số
`email` khớp chính xác (gợi ý email trong `ManualGrantDialog`), đã ghi vào
`API_CONTRACT.md` §5.1.

### 3.4 Tài khoản bị khóa đăng nhập: không có câu "Tài khoản đã bị khóa"

`ROADMAP.md` §7 bước 15 cũ yêu cầu `Alert` "Tài khoản đã bị khóa. Liên hệ hỗ trợ để
được mở lại.", trong khi N3.14, `API_CONTRACT.md` §6.3 và `UX_PLAN.md` §6.3 đều bắt
tài khoản bị khóa trả đúng `401 INVALID_CREDENTIALS` như sai mật khẩu — một câu riêng
là oracle cho biết email nào tồn tại và đang bị khóa. Chọn phía bảo mật; đã sửa bước
15 của `ROADMAP.md`.

### 3.5 Luật chuyển trạng thái khóa học chặt hơn

Có enrollment thật thì "gỡ về bản nháp" không còn vô hại: `DRAFT` không cho ai học
(`PLAN_SUPPLEMENT.md` §4.10). `unpublish` trả `409 COURSE_HAS_ENROLLMENTS` khi còn
enrollment `ACTIVE`; `archive` chỉ nhận `PUBLISHED`; `publish` nhận cả `ARCHIVED`
(409 khi đã `PUBLISHED`); xóa khóa chặn theo mọi hàng `enrollments`, không theo bộ
đếm. Đã sửa `API_CONTRACT.md` §2.5, §5.3 và bảng chuyển trạng thái của `DATA_MODEL.md`
ngay ở slice A.

### 3.6 `/admin/audit-logs` không áp mặc định 30 ngày

`API_CONTRACT.md` §5.7 cho `/admin/reports/*` mặc định 30 ngày khi thiếu `from`/`to`.
Nhật ký kiểm toán không được ẩn hàng cũ, nên thiếu cả hai thì trả toàn bộ lịch sử.
`UX_PLAN.md` §6.2 thêm hai trạng thái rỗng "có lọc" và "quá trang cuối". Đã ghi vào
tài liệu ở slice E.

### 3.7 `ResourceList` không có toast "Liên kết tải xuống đã hết hạn."

`GET .../download` không bao giờ trả `SIGNATURE_INVALID`: mỗi lần bấm ký một URL mới
rồi điều hướng ngay, nên nhánh toast + "Lấy liên kết mới" là code chết và đã bỏ.
Client cũng không tự kiểm `expiresAt` (đồng hồ máy nhanh sẽ làm hỏng mọi lần tải).
Khoảng trống: mở lại một URL cũ hết hạn thì trình duyệt hiện body JSON `403` thô. Đã
sửa `API_CONTRACT.md` §2.5b và `UX_PLAN.md` §6.1.

### 3.8 Layout player dựng khung học thử thay vì luôn chuyển hướng khi `403`

`UX_PLAN.md` §5.1 bước 3 và 9 cũ: bài "Học thử" phát trong `PreviewDialog` trên trang
khóa học, và mọi `403` ở `/learn` chuyển về `?denied=1`. Đã làm: bài "Học thử" phát
ngay trong trình học — layout dựng khung từ outline công khai `/courses/{slug}`,
"Trước/Sau" chỉ bước giữa các bài học thử, không ghi tiến độ; mọi bài khác vẫn về
`/courses/{slug}?denied=1`. Chưa có `PreviewDialog`. Giá: một lần gọi công khai thêm
cho request bị từ chối. Hệ quả thấy được ở demo bước 13 (bài 1 là bài học thử). Đã
sửa `UX_PLAN.md` §2.3 (bảng route), §5.1 và `API_CONTRACT.md` §2.5b dòng
`NOT_ENROLLED`.

### 3.9 Không có trạng thái "sidebar lỗi, `LessonNav` vẫn chạy"

`UX_PLAN.md` §5.2 bước 6 muốn curriculum lỗi riêng mà Trước/Sau vẫn đi được. Khung,
curriculum và dữ liệu Trước/Sau cùng đến từ một `GET /learn/{slug}`, nên hỏng là hỏng
cả: `learn/error.tsx` hiện "Không tải được chương trình học" → "Thử lại";
`[lessonId]/error.tsx` lo lỗi nội dung bài trong layout. Đã sửa `UX_PLAN.md` §5.2.

### 3.10 `STORAGE_DRIVER=r2` + `VIDEO_DRIVER=demo` vẫn có `LocalFileController`

Ngoài production, tổ hợp này đăng ký `LocalFileController` chỉ cho video mẫu; mọi key
khác (tải lẫn upload) trả `404` (`local-file-r2.spec.ts`). Production (hai driver
thật, `assertNoDemoDriversInProduction` bắt buộc) vẫn không có route. Đã thêm bảng
vào `DEMO_MODE.md` §1.

### 3.11 Các quyết định còn lại của kế hoạch triển khai

Không lệch tài liệu nhưng ghi lại để review: một hàm quyền truy cập duy nhất cho 5
route học (khóa `ARCHIVED` chỉ hiện với người có enrollment `ACTIVE`, `DRAFT` không
có ngoại lệ enrollment); `grant()` trên hàng đã `ACTIVE` không ghi gì, không audit,
controller trả `200`; `AdminUserRow.purchaseCount` = 0 và `purchases: []` tới Phase 4;
section ghi audit với `entityType` = `COURSE`, lesson reorder với `SECTION` theo cột
"Ghi ở" của `DATA_MODEL.md`.

---

## 4. Khoảng trống đã biết

| Khoảng trống | Hệ quả | Khi nào đóng |
|---|---|---|
| URL tài liệu cũ hết hạn (3.7) | Trình duyệt hiện JSON `403` thô | Khi có trang trung gian tải xuống, hoặc R2 trả trang lỗi riêng |
| Chưa có `PreviewDialog` (3.8) | "Học thử" mở trình học thay vì hộp thoại trên trang khóa học | Khi dựng lại trang khóa học |
| Khung Pencil chưa đối chiếu (§1) | Sai khác về bố cục chưa phát hiện | Mở `design/elearning.pen` trong Pencil rồi so |
| Nút "Lưu trữ" ở `/admin/courses/[id]` không có `ArchiveDialog` | Một cú bấm là lưu trữ ngay, `UX_PLAN.md` §5.7 yêu cầu hộp xác nhận. Có từ Phase 2, lộ ra ở demo bước 14 | Việc nhỏ ở `course-form.tsx`, dùng lại `ConfirmDialog` |
| `/my-courses` khi API sập hiện lỗi chung (D15) | "Đã xảy ra lỗi" thay cho câu riêng của trang | Khi `(learner)/layout.tsx` có `error.tsx` riêng |

## 5. Ba chỗ phải đọc kỹ khi review

1. **`src/enrollment/enrollment.service.ts`** — `resolveAccess`/`lessonAccess`/`courseAccess`
   là cửa duy nhất của mọi route học. Thứ tự: không tồn tại hoặc không hiển thị →
   `404` trước, rồi mới `403`. `grant`/`revoke` đổi trạng thái, bộ đếm và audit trong
   cùng transaction, cập nhật có điều kiện để hai request đồng thời không cộng đôi.
2. **`src/media/local-file.controller.ts`** — nhánh `videos/*.mp4`: `exp` → phiên từ
   cookie → chữ ký gắn người xem → phục vụ một `Range`. Đường cũ của tài liệu/ảnh bìa
   giữ nguyên từng byte.
3. **`apps/web/src/components/learning/video-player.tsx` + `src/lib/progress-sync.ts`**
   — nhịp ghi tiến độ (15 s khi phát, `pause`/`ended`/tab ẩn, gộp ≤ 1 request / 5 s,
   không bao giờ trên `timeupdate`), làm mới token trước hạn 60 s, giữ tiến độ trong
   bộ nhớ khi mất mạng.

## 6. Vấn đề mở — cần chủ sở hữu quyết

1. **`web build` cần API đang chạy, CI sẽ fail ở D5.** *(Đã sửa 2026-09-30, `_PLAN.md` T0.9: `generateStaticParams` trả `[]`, trang chủ `revalidate = 0`, sitemap và trang danh mục render theo yêu cầu; `pnpm build` exit 0 khi API tắt. Phần mô tả dưới đây giữ nguyên làm ghi nhận lúc phát hiện.)* Tắt API thì `next build` fail
   khi prerender `/categories/[slug]` (`generateStaticParams` gọi `/categories`), và
   các trang ISR khác cũng gọi API lúc build. `ci.yml` chạy `corepack pnpm build`
   mà không khởi động API. Có từ Phase 2, chưa sửa vì không kiểm được trên CI khi
   chưa push. Hai hướng: (a) trong CI build + seed + start API trước bước build;
   (b) cho các hàm build-time trả rỗng khi API không tới được rồi để ISR tự điền.
2. **`enrollmentCount` không hiển thị ở web công khai.** API trả đúng số thật (A3.8,
   demo bước 11) nhưng `CourseCard`/`CourseHero` không in nó — `UX_PLAN.md` §0 nói card
   có "số học viên", còn bố cục cố định của `CourseCard` ở §4.5 không có hàng đó.
   `TrustStats` ở trang chủ vẫn hiện số danh mục thay cho số học viên (`PHASE_2_REPORT.md`
   §3.9 hẹn đổi ở Phase 3) — tổng `enrollmentCount` đếm trùng người học nhiều khóa, nên
   cần chốt "số học viên" là số lượt ghi danh hay số người.
3. **Múi giờ của PostgreSQL local lệch dữ liệu thời gian 7 giờ.** Server dev chạy
   `TimeZone = Asia/Bangkok`; mọi mốc thời gian app ghi qua `@prisma/adapter-pg` bị lưu
   sớm hơn thực tế 7 giờ (vd. `audit_logs.created_at` 12:13 UTC trong khi `now()` là
   19:14 UTC). App đọc lại nhất quán nên UI hiển thị đúng, nhưng mọi truy vấn SQL so
   với `now()` hoặc gom theo `AT TIME ZONE` (báo cáo doanh thu Phase 4) sẽ lệch. CI
   (Postgres mặc định UTC) không gặp. Có từ Phase 1. Hướng sửa: đặt `timezone = 'UTC'`
   cho database/role, hoặc `options=-c TimeZone=UTC` trong `DATABASE_URL`; cần quyết
   có sửa dữ liệu dev đã lệch hay seed lại.

   **Đã sửa ở code (T0.4, 2026-09-30).** Nguyên nhân: `@prisma/adapter-pg` ghi `Date`
   dạng giờ UTC không kèm offset và đổi nhãn offset đọc về thành `+00:00` mà không quy
   đổi, nên hai lỗi triệt tiêu khi đọc lại bằng Prisma còn SQL thì thấy giá trị lệch.
   `PrismaService` và `prisma/seed.ts` nay ép phiên về UTC bằng
   `options: '-c TimeZone=UTC'` (`src/prisma/pg-session.ts`); `test/timezone.e2e-spec.ts`
   giữ hồi quy và tự ép role về `Asia/Bangkok` nên fail cả trên server UTC. Dữ liệu dev
   ghi **trước** bản sửa vẫn lệch −7 giờ. Cách xử lý khuyến nghị: `prisma migrate reset`
   trên DB dev (xóa dữ liệu dev, seed lại). Không có SQL dịch giờ an toàn: hàng do Prisma
   ghi thì sớm 7 giờ, còn hàng ghi bằng `now()` phía DB (tiến độ học) vốn đúng.
