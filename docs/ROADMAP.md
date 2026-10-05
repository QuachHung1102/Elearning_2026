# Roadmap thực thi

Tài liệu này chỉ mô tả **thứ tự thi công và điều kiện nghiệm thu**. Kiến trúc, lựa chọn công nghệ, mô hình dữ liệu và thiết kế luồng ZaloPay đã nằm trong [PROJECT_PLAN.md](./PROJECT_PLAN.md) và không được nhắc lại ở đây.

Không có lịch, không có ngày. Ước lượng bằng đơn vị tương đối S/M/L/XL.

> **Trạng thái và thứ tự thi công hiện hành nằm ở [_PLAN.md](./_PLAN.md).** Tài liệu này giữ
> đặc tả từng phase và mã acceptance (`A*`, `N*`). Các bảng trạng thái ở §1, §2.1 và §10 là
> mốc lúc lập roadmap, không được cập nhật; phần acceptance/demo của Phase 4 (§8) có tên
> endpoint lỗi thời, danh sách và cách sửa ở `_PLAN.md` mục 3 (P4-1…P4-9).

## 1. Trạng thái nền khi lập roadmap

Trạng thái triển khai mới nhất xem [_STATUS.md](./_STATUS.md). Bảng dưới giữ
nguyên mốc khảo sát ban đầu, không phải kết quả kiểm tra hiện tại.

Đo bằng lệnh trên cây mã hiện tại, không suy đoán:

| Hạng mục | Hiện có | Kế hoạch cuối |
|---|---|---|
| Prisma model | 2 (`User`, `Session`) | 14 — [DATA_MODEL.md](./DATA_MODEL.md) §Prisma schema đầy đủ |
| Prisma migration | 1 (`20260829200026_add_user_auth`) | 5 — DATA_MODEL.md §Chiến lược migration |
| Route API | 6 (`auth/register`, `auth/login`, `auth/me`, `auth/logout`, `auth/csrf`, `GET /api/v1`) | 75 — [API_CONTRACT.md](./API_CONTRACT.md) §5 |
| Trang Next.js | 1 (`page.tsx`, một `<h1>`) | 36 — [UX_PLAN.md](./UX_PLAN.md) §2.2 |
| `apps/api/.env.example` | 3 biến | 40 biến — [DEMO_MODE.md](./DEMO_MODE.md) §7 |
| `apps/web/.env.example` | không có file | 2 biến (`API_ORIGIN`, `NEXT_PUBLIC_CHECKOUT_ENABLED`) — DEMO_MODE.md §7 |
| CI | không có `.github/workflows` | 1 workflow |
| Design token | `globals.css` chỉ có `@import "tailwindcss"` | Bốn khối của UX_PLAN.md §1.1; 44 cặp màu đã đo, `44/44 pass` bằng `design/contrast-check.py` |

**Cột "kế hoạch cuối" đếm từ tài liệu sở hữu từng chủ đề, không đếm từ danh sách của chính tài liệu này.** Đó là điểm sửa quan trọng nhất so với bản đầu: bản đầu ghi 64 route / 26 trang / 34 biến, ba con số cộng từ những danh sách mà roadmap tự khai và không khớp với bất kỳ tài liệu nào — nên chúng không mô tả sản phẩm nào cả. Ba con số hiện tại đếm bằng lệnh trên chính ba tài liệu đó.

Cách cộng **75 route** (bảng endpoint của API_CONTRACT.md §5.1–§5.9): 5 route auth giữ lại + 12 (Phase 1) + 35 (Phase 2) + 13 (Phase 3) + 10 (Phase 4) + 0 (Phase 5). `GET /api/v1` trả `'Hello World!'` bị gỡ ở Phase 1 nên không nằm trong con số này. Ba route `/dev/*` **có** được đếm; chúng chỉ tồn tại khi có driver demo, nhưng chúng là bề mặt HTTP thật ở môi trường dev.

Cách cộng **36 trang** (cây route của UX_PLAN.md §2.2, đếm số file `page.tsx`): 9 (Phase 1) + 12 (Phase 2, gồm `src/app/page.tsx` đã có và được viết lại) + 7 (Phase 3) + 4 (Phase 4) + 4 (Phase 5). `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`, `global-error.tsx`, `opengraph-image.tsx`, `sitemap.ts`, `robots.ts`, `proxy.ts` không phải trang nên không được đếm.

Cách cộng **40 biến**: đếm trực tiếp các dòng `NAME=` trong khối `apps/api/.env.example` ở DEMO_MODE.md §7. Roadmap này **không** giữ bảng biến riêng — xem mục 2.3.

Phần auth đã xong về mặt bảo mật cốt lõi: scrypt, session trong PostgreSQL, JWT `HS256` chỉ chứa `sub`/`sid`, cookie `HttpOnly` + `SameSite=Lax`, double-submit CSRF, rate limit theo IP. Phần còn thiếu của Phase 1 nằm ở mục 5.

## 2. Thứ tự phase sau khi đảo

### 2.1 Thứ tự mới

| # | Phase | Ước lượng | Trạng thái |
|---|---|---|---|
| 1 | Nền tảng | L | đang dở |
| 2 | Catalog và soạn nội dung | XL | chưa bắt đầu |
| 3 | Trải nghiệm học | L | chưa bắt đầu |
| 4 | Thanh toán | L | chưa bắt đầu |
| 5 | Hardening và mở bán | M | chưa bắt đầu |

So với PROJECT_PLAN.md, **Thanh toán đổi chỗ với Trải nghiệm học**: từ vị trí 3 xuống vị trí 4.

Hardening vẫn ở cuối. "Thanh toán làm sau cùng" nghĩa là sau cùng **trong các phase tính năng**; Hardening không phải tính năng, nó siết chính phần thanh toán vừa xây nên phải đứng sau.

Lý do đảo:

- Thanh toán là phần duy nhất phụ thuộc vào một bên thứ ba có quy trình phê duyệt chậm (đăng ký merchant, sandbox, QC). Đặt nó ở giữa lộ trình biến một thủ tục giấy tờ thành vật cản của toàn bộ sản phẩm.
- Thanh toán không tạo ra giá trị nào nếu chưa có thứ để bán và chưa có trải nghiệm học để giao. Catalog và Learning mới là phần cần thời gian thiết kế, sửa và xem lại nhiều lần.
- `Enrollment` là seam thật giữa hai nửa hệ thống. Nếu `Enrollment` chỉ sinh ra được từ callback ZaloPay thì không thể kiểm thử phần học nếu chưa có merchant. Tách `Enrollment` khỏi thanh toán ngay từ đầu là điều kiện bắt buộc để làm việc theo thứ tự này, và cũng là thiết kế đúng hơn.
- Toàn bộ Phase 2 và 3 chạy được trên laptop chỉ với PostgreSQL. Không tài khoản Cloudflare, không tài khoản email, không tài khoản ZaloPay.

### 2.2 Giá phải trả cho việc đảo thứ tự

| Hệ quả | Chi tiết | Được gỡ ở |
|---|---|---|
| `Enrollment` phải có đường tạo không qua thanh toán | Admin cấp quyền thủ công: `POST /api/v1/admin/enrollments`. Đây là cách duy nhất có `Enrollment` cho tới Phase 4, và vẫn là cách chính thức để tặng/đền bù về sau. Không phải stub vứt đi. | không gỡ |
| `AuditLog` phải lên sớm | Cấp quyền thủ công là hành động admin sửa quyền truy cập, bắt buộc có vết. Trong PROJECT_PLAN.md `AuditLog` gắn với thanh toán; ở đây nó vào migration Phase 3. | — |
| Nút mua trên trang chi tiết khóa học chưa có đích | Phase 2 và 3 hiển thị `priceVnd` cùng một `EnrollCta` biến thể "Liên hệ để đăng ký" dẫn sang `/contact?course=[slug]`, do `NEXT_PUBLIC_CHECKOUT_ENABLED=false` quyết định (UX_PLAN.md §3.1). Phase 4 bật cờ và cùng component đổi sang nhánh checkout. **`/contact` vì thế là trang tĩnh của Phase 1, không phải Phase 5** — nếu để ở Phase 5 thì suốt ba phase nút mua duy nhất của sản phẩm dẫn vào `404` và D8 fail mỗi phase. Phase 5 chỉ còn `/privacy`, `/terms`, `/refund`, `/payment`. | Phase 4 |
| `enrollmentCount` trên course card bằng 0 ở Phase 2 | DTO `CourseCard` có trường `enrollmentCount` ngay từ Phase 2 (tên chốt ở DATA_MODEL.md, **không** phải `studentCount`), trả `0` vì bảng `enrollments` chưa tồn tại; Phase 3 nối vào bộ đếm thật. Frontend không phải sửa. | Phase 3 |
| Dashboard admin không có số doanh thu | `src/app/admin/page.tsx` và `GET /admin/reports/overview` (API_CONTRACT.md §5.7) được **tạo ở Phase 2**. Ba ô `StatTile` không phụ thuộc thanh toán chạy thật ngay; hai ô "Doanh thu tháng" và "Thanh toán đang treo" **bị ẩn hẳn** khi `NEXT_PUBLIC_CHECKOUT_ENABLED=false` và lưới co từ 5 xuống 3 cột (UX_PLAN.md §3.4) — hiện `0 ₫` là nói "chưa bán được gì" trong khi sự thật là "chưa có tính năng bán". | Phase 4 |
| `Enrollment.purchaseId` chưa tồn tại | Cột nullable này được thêm trong migration `add_payment` của Phase 4, không tạo trước một FK trỏ vào bảng chưa có (DATA_MODEL.md §Chiến lược migration: đây là field duy nhất đến muộn). `Enrollment.source` thì khai đủ cả `PURCHASE` và `MANUAL_GRANT` ngay từ migration Phase 3 để tránh một `ALTER TYPE ... ADD VALUE` ở migration sau. | Phase 4 |
| Rủi ro merchant dồn về cuối | **Việc phải làm ngay ở Phase 1, song song, không nằm trên critical path của code**: mở hồ sơ đăng ký merchant ZaloPay và lấy sandbox credentials. Đây là rủi ro thật của việc đảo thứ tự và cách duy nhất để triệt tiêu nó là bắt đầu thủ tục sớm. | Phase 4 |

### 2.3 Driver seam và biến môi trường

Mọi phụ thuộc bên ngoài nằm sau một seam chọn bằng biến môi trường, và mỗi seam có một bản demo chạy offline.

**Đặc tả seam và `.env.example` thuộc [DEMO_MODE.md](./DEMO_MODE.md)** — §1 cho bốn seam (token, interface, hai lớp cài đặt, mẫu `useClass`), §7 cho toàn bộ `.env.example` kèm chú thích từng biến và đánh dấu `[PROD]`, §6 cho boot guard. Roadmap này **không giữ bảng biến riêng**: bản đầu có một bảng "biến mọc theo phase" với `MAIL_DRIVER=log`, `STORAGE_DRIVER=local`, `MEDIA_TOKEN_SECRET`, `STORAGE_SIGNING_SECRET`, `SEED_*`, `PAYMENT_QR_TTL_SECONDS`, `PAYMENT_RETURN_URL`, `R2_ACCOUNT_ID` và `CF_*` — không tên nào trong số đó tồn tại trong `.env.example` thật, nên nó là một hợp đồng thứ hai và là cái sai.

Bốn biến driver và giá trị hợp lệ, chép để đọc nhanh (nguồn: DEMO_MODE.md §1):

| Seam | Biến | Giá trị |
|---|---|---|
| Video | `VIDEO_DRIVER` | `demo` \| `cloudflare` |
| Lưu trữ file | `STORAGE_DRIVER` | `demo` \| `r2` |
| Email | `MAIL_DRIVER` | `demo` \| `smtp` |
| Thanh toán | `PAYMENT_DRIVER` | `demo` \| `zalopay` |

Điều roadmap này chốt là **thứ tự xuất hiện**, không phải tên biến: `MAIL_DRIVER` + hai `DEMO_VIDEO_*` ở Phase 1 (luồng xác minh email cần mailer demo ngay); `STORAGE_DRIVER` + nhóm `R2_*` ở Phase 2; `VIDEO_DRIVER` + nhóm `CLOUDFLARE_*` ở Phase 3; `PAYMENT_DRIVER` + nhóm `ZALOPAY_*` + `CHECKOUT_QR_TTL_MINUTES`/`RECONCILE_*` ở Phase 4; `SMTP_URL` được điền giá trị thật ở Phase 5. File `.env.example` thì commit **đầy đủ 40 biến ngay từ Phase 1** — biến không được ghi ở đâu là biến sẽ bị quên khi tới lúc cần.

Ràng buộc bắt buộc: **route chỉ tồn tại ở chế độ demo phải được đăng ký có điều kiện, không phải bị guard chặn.** `DevModule` (chứa `/dev/mail*` và `POST /dev/payments/{appTransId}/confirm`) chỉ được import khi có ít nhất một driver ở giá trị `demo`; `LocalFileController` (`GET|PUT /media/local/{key}`) chỉ vào mảng `controllers` khi `STORAGE_DRIVER !== 'r2'`. Mẫu code ở DEMO_MODE.md §1. Boot guard ở Phase 5 chặn production cùng driver demo nhưng **không gỡ route** — nên đăng ký có điều kiện là lớp bảo vệ thật, boot guard chỉ là lớp thứ hai. Đây là kiểm tra âm tính N2.11, N4.4 và N5.2.

`ZALOPAY_CALLBACK_URL` là URL ZaloPay gọi ngược vào backend, gửi theo từng đơn hàng trong trường `callback_url`. PROJECT_PLAN.md yêu cầu nó là HTTPS công khai nên **không dùng được `localhost`**: A4.9 chạy trên staging Railway, hoặc local qua `cloudflared tunnel --url http://localhost:3001` rồi đặt `ZALOPAY_CALLBACK_URL` bằng URL tunnel.

### Hằng số không phải env

Những ngưỡng dưới đây cố định trong mã, không cấu hình được: một giá trị chỉ thành biến môi trường khi thực sự có môi trường cần giá trị khác. Đặt trong `apps/api/src/*/…constants.ts` cạnh module dùng nó.

| Hằng số | Giá trị | Nơi đặt | Ghi chú |
|---|---|---|---|
| `SESSION_DURATION_SECONDS` | `7d` | `auth/auth.constants.ts` | **đã có trong cây mã**, không đổi |
| `LOGIN_RATE_LIMIT` | `10 request / 60s / IP` | `auth/auth-rate-limit.guard.ts` | **đã có trong cây mã** (`LIMIT = 10`, `WINDOW_MS = 60_000`); A5.6 đo đúng con số này |
| `PROGRESS_PING_INTERVAL` | `15s` | `components/video-player.tsx` | nhịp `PUT /lessons/{id}/progress` |
| `COMPLETE_THRESHOLD` | `0.95` | `components/video-player.tsx` | tỉ lệ thời lượng để tự đánh dấu hoàn thành. **Tính ở client trên `video.duration` của phần tử `<video>` đang phát**, không đọc `VideoAsset.durationSeconds` (DEMO_MODE.md §2) — nhờ đó ngưỡng đúng ở cả hai driver. A3.7 đo đúng con số này |
| `CHECKOUT_POLL_INTERVAL` | `3s` | `components/payment-status.tsx` | nhịp polling trạng thái |
| `PAGE_SIZE_DEFAULT` / `PAGE_SIZE_MAX` | `20` / `100` | `common/pagination.ts` | giá trị chốt ở API_CONTRACT.md §2.7 |

**Hai TTL của token email là biến môi trường, không phải hằng số.** Bản đầu của bảng này đặt `EMAIL_VERIFY_TTL = 24h` và `PASSWORD_RESET_TTL = 1h` làm hằng số trong mã; PLAN_SUPPLEMENT.md §3 chốt lại chúng là `EMAIL_VERIFY_TTL_MINUTES=1440` và `PASSWORD_RESET_TTL_MINUTES=60` trong `.env.example` (DEMO_MODE.md §7), và API_CONTRACT.md §5.1 đồng thuận về giá trị. Tương tự, ngưỡng rate limit cho `POST /checkout/{courseSlug}` là **5 lần / 300 giây / user** theo bảng đầy đủ ở API_CONTRACT.md §8, không phải một hằng số riêng của roadmap.

Toàn bộ biến được đọc và validate **một lần** trong `apps/api/src/config.ts`, export một object đông cứng. Các `throw` rải rác đang có trong `auth.module.ts` và `prisma.service.ts` chuyển về đây.

## 3. Đồ thị phụ thuộc

Chỉ vẽ những phụ thuộc thật. Mũi tên có nghĩa là "không làm được nếu chưa có".

```text
                    ┌──────────────────────────────────────────────────┐
                    │ P1 Nền tảng                                      │
                    │  a. config.ts + health + seed (admin + demo)     │
                    │  b. AdminGuard + AuthToken + mailer(demo)        │
                    │     + password/sessions + error envelope         │
                    │  c. next.config rewrite /api/*                   │
                    │  d. design token (UX_PLAN §1) + font + Lucide    │
                    │  e. auth UI + /account + /contact + error/loading│
                    │  f. CI workflow (có bước prisma generate)        │
                    └───┬──────────────┬───────────────┬───────────────┘
                        │              │               │
          (a,b) ────────┤        (c,d) ┤         (b,c,d) │
                        ▼              ▼               ▼
                 ┌─────────────┐  ┌──────────┐   ┌──────────┐
                 │ P2 API      │  │ P2 web   │   │ P1e auth │
                 │ Catalog     │─▶│ catalog  │   │ UI       │
                 │ + admin CRUD│  │ + admin  │   └──────────┘
                 └──────┬──────┘  └────┬─────┘
                        └──────┬───────┘
                               ▼
                 ┌───────────────────────────────┐
                 │ P3 Enrollment + Learning      │
                 │  Enrollment/LessonProgress    │
                 │  manual grant + AuditLog      │
                 │  playback token (video seam)  │
                 └───────────────┬───────────────┘
                                 ▼
                 ┌───────────────────────────────┐
                 │ P4 Thanh toán                 │
                 │  Purchase/PaymentAttempt      │
                 │  confirmPayment() dùng chung  │
                 └───────────────┬───────────────┘
                                 ▼
                 ┌───────────────────────────────┐
                 │ P5 Hardening và mở bán        │
                 └───────────────────────────────┘

Chạy song song, không chặn và không bị chặn bởi code:
  ├─ Hồ sơ merchant ZaloPay sandbox ─────────────── cần xong trước cuối P4
  ├─ Tài khoản Cloudflare Stream + R2 ───────────── cần xong trước P5
  ├─ Nhà cung cấp email SMTP ────────────────────── cần xong trước P5
  ├─ design/elearning.pen: màn hình P2 và P3 ────── cần xong trước khi code màn hình tương ứng
  ├─ Nội dung liên hệ (email + số điện thoại) ──── cần xong trước P1e
  └─ Nội dung privacy / terms / refund / payment ─ cần xong trước P5
```

Điểm chặn thật, cần đọc kỹ vì đây là chỗ quyết định việc gì làm song song được:

| Bị chặn | Chặn bởi | Vì sao |
|---|---|---|
| Mọi route admin | `AdminGuard` (P1b) | không có guard thì không có route admin an toàn. **Một** guard duy nhất, tự resolve session và ném `NotFoundException` ở mọi nhánh thất bại (API_CONTRACT.md §3.1) |
| Web gọi API bằng cookie | `next.config.ts` rewrite (P1c) | khác origin thì cookie `SameSite=Lax` không đi kèm |
| Mọi màn hình có giao diện | design token (P1d) | tránh phải sơn lại toàn bộ sau; hai khối trong `globals.css` ở UX_PLAN.md §1.1 là bản duy nhất, không ai được tự chọn màu |
| Mọi trang gọi API | `src/lib/api.ts` + envelope lỗi (P1b) | shape lỗi và hành vi `401`/`403` của server component là contract chung, đổi sau thì phải sửa mọi trang |
| P2 web | contract API catalog (P2 API) | chỉ cần **contract**, không cần implement xong: hai nửa chạy song song sau khi chốt DTO |
| P3 | `Lesson` + `Course.status` (P2) | không có nội dung thì không có gì để học |
| P4 | `Enrollment` + `confirmPayment` seam (P3) | callback phải gọi đúng hàm cấp quyền đã có |
| P5 | tất cả | siết thứ đã xây |

Không chặn nhau, làm song song được: P1a với P1d/P1e; P2 admin UI với P2 public UI; P3 playback token (API) với P3 lesson player (web); P4 `ZaloPayClient` với P4 checkout UI, vì driver demo đã cố định contract từ trước.

## 4. Definition of Done — áp dụng cho mọi phase

Không phase nào được coi là xong nếu thiếu một dòng trong bảng này. Đây là điều kiện bổ sung, ngoài acceptance riêng của từng phase.

| # | Kiểm tra | Lệnh hoặc thao tác | Kết quả bắt buộc |
|---|---|---|---|
| D1 | Lint | `corepack pnpm lint` | exit 0, không warning mới |
| D2 | Typecheck | `corepack pnpm typecheck` | exit 0 |
| D3 | Unit test | `corepack pnpm test` | exit 0, không test bị skip |
| D4 | E2E API | `corepack pnpm --filter api test:e2e` | exit 0 |
| D5 | Build | `corepack pnpm build` | exit 0 |
| D6 | Migration replay trên DB sạch | `dropdb elearning_ci; createdb elearning_ci; $env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/elearning_ci"; corepack pnpm --filter api exec prisma migrate deploy` | exit 0, không dùng `db push`, không sửa migration cũ; các `CHECK` viết tay trong migration cũ vẫn còn sau replay |
| D7 | Seed chạy lại được | `corepack pnpm --filter api exec prisma db seed` hai lần trên DB ở D6 | lần hai exit 0, không lỗi unique, **và có in log** — Prisma 7 im lặng bỏ qua nếu thiếu `migrations.seed` |
| D8 | Không có console error | mở mọi trang mới của phase, DevTools Console | 0 error, 0 warning React |
| D9 | Responsive | DevTools ở 375 / 768 / 1024 / 1440 px | không tràn ngang, không chữ đè, touch target ≥ 44×44 px |
| D10 | Bàn phím | `Tab` qua toàn bộ trang, `Enter`/`Space` trên mọi control | mọi thao tác chuột đều làm được bằng bàn phím, focus ring nhìn thấy, không bẫy focus |
| D11 | Tương phản | `python design/contrast-check.py`, cộng thêm mọi cặp màu mới phát sinh trong phase phải được thêm vào `PAIRS` của script đó | exit 0; ≥ 4.5:1 cho body text, ≥ 3.0:1 cho viền/icon |
| D12 | Motion | bật `prefers-reduced-motion: reduce` | không còn transform/opacity animation |
| D13 | Ngôn ngữ | đọc lướt UI mới | 100% tiếng Việt, không lẫn chuỗi tiếng Anh sót lại; không dùng emoji, chỉ icon Lucide |
| D14 | CI xanh | push nhánh | workflow pass toàn bộ D1–D7, có bước `prisma generate` **trước** D1 |
| D15 | Trạng thái tải và lỗi | tắt `api`, mở mọi route segment mới của phase | hiện `loading.tsx` rồi thông báo tiếng Việt của `error.tsx`, không phải trang trắng hay stack trace |

Không thêm test runner cho `apps/web` trước Phase 5. Kiểm chứng frontend ở P1–P4 bằng `next build`, demo script và D8–D13. Playwright chỉ vào ở Phase 5 cho ba luồng sống còn.

## 5. Phase 1 — Nền tảng (phần còn lại)

**Ước lượng: L.** Auth đã xong; phần còn lại là hạ tầng quanh nó — cộng ba khiếm khuyết hạ tầng phải sửa trước khi D5 và D7 chạy được, và hai artefact contract (design token, shape lỗi API) mà bốn phase sau đều đi qua.

### Còn thiếu chính xác những gì

| Hạng mục | Trạng thái đo được | Việc phải làm |
|---|---|---|
| Guard admin | `UserRole` có trong schema, không có file guard nào | **Một** `AdminGuard` duy nhất, thay thế `SessionAuthGuard` trên `/admin/*` và `/dev/*`; nó tự gọi `AuthService.authenticate` và ném `NotFoundException` ở mọi nhánh thất bại. Chuỗi `SessionAuthGuard, AdminGuard` là **sai** và lý do đã kiểm chứng nằm ở API_CONTRACT.md §3.1 |
| CSRF toàn cục | `CsrfGuard` gắn per-route | Chuyển sang `APP_GUARD`, bỏ qua `GET`/`HEAD`/`OPTIONS`, `@SkipCsrf()` ở đúng hai chỗ (API_CONTRACT.md §3.1) |
| Tài khoản admin và dữ liệu demo | không có `prisma/seed.ts`, và `prisma.config.ts` không có khoá `migrations.seed` | seed theo đúng DATA_MODEL.md §Dữ liệu seed cho bản demo — 4 tài khoản với mật khẩu ghi thẳng trong seed, **không** có `SEED_*` trong env; khai báo runner `tsx` trong `prisma.config.ts` |
| Xác minh email / đặt lại mật khẩu | không có endpoint, không có model | model `AuthToken` (DATA_MODEL.md), nhóm `/auth/verify-email/*` và `/auth/password/*` của API_CONTRACT.md §5.1, `MAIL_DRIVER=demo` (`DevInboxMailer`) |
| Hồ sơ và phiên đăng nhập | không có endpoint | PROJECT_PLAN.md yêu cầu "hồ sơ cá nhân, đổi mật khẩu, quản lý phiên đăng nhập" và "thu hồi toàn bộ session khi đổi mật khẩu". Nhóm `/users/me*` của API_CONTRACT.md §5.1 + ba trang `/account*`. N1.7 hiện tại đang test chính thứ này |
| Health check | chỉ có `GET /api/v1` trả `'Hello World!'` | `GET /health` chạy `SELECT 1`, trả `{ status, database, uptimeSeconds }` và `503 { status: "degraded", database: "down" }` khi lỗi hoặc quá 2 giây (API_CONTRACT.md §5.9). Tên field là **`database`**, không phải `db` |
| Đọc env | `throw` rải rác ở `auth.module.ts` và `prisma.service.ts` | gom vào `src/config.ts`, validate một lần lúc boot; `assertDriverValuesAreKnown()` chạy ở mọi môi trường (DEMO_MODE.md §6) |
| Shape lỗi API | Nest trả mặc định `{ statusCode, message, error }` | envelope và danh mục `code` của API_CONTRACT.md §2.4–§2.6, cộng middleware `X-Request-Id` |
| Rewrite `/api/*` | **không có `next.config.ts`** | tạo file, rewrite `/api/:path*` sang `API_ORIGIN` (cú pháp đúng ở API_CONTRACT.md §1.6) |
| Design token | `globals.css` chỉ có một dòng `@import` | hai khối của UX_PLAN.md §1.1 theo đúng thứ tự, `@theme static`; Lexend + Inter subset `vietnamese` qua `next/font`; `lucide-react` |
| Giao diện auth và hồ sơ | 1 trang `<h1>` | 8 trang: `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/account`, `/account/password`, `/account/sessions` |
| Trạng thái tải và lỗi | không có | `loading.tsx`, `error.tsx`, `not-found.tsx`, `global-error.tsx` theo UX_PLAN.md §6.6 |
| Trang liên hệ | không có | `/contact` + `POST /contact` — đích của `EnrollCta` suốt Phase 2–3 (mục 2.2), nên nó là một form thật có rate limit, không phải trang thông tin (UX_PLAN.md §3.1) |
| CI | không có `.github/` | workflow chạy D1–D7 với service PostgreSQL, có bước `prisma generate` |

### Design token — `globals.css`

Đây là artefact đòn bẩy cao nhất của Phase 1: mọi màn hình của bốn phase sau đi qua nó.

**Giá trị token thuộc [UX_PLAN.md](./UX_PLAN.md), không thuộc tài liệu này.** Chép nguyên hai khối và các bảng màu ở §1.1–§1.2 vào `apps/web/src/app/globals.css`, cộng thang chữ §1.4, spacing/radius/shadow §1.5, motion §1.6, icon/breakpoint §1.7. Bản đầu của roadmap này có một khối CSS riêng cộng một bảng 44 cặp màu riêng — hai bộ giá trị khác nhau, cả hai tự nhận là bản duy nhất được chép. Bộ của UX_PLAN.md thắng vì nó có hai kết luận đã biên dịch thử mà bộ kia không có, và cả hai đều làm hỏng **im lặng** nếu làm sai:

- **`@theme static`, không phải `@theme`.** Dưới `@theme` thường, biến nào không được một tiện ích nào sinh ra sẽ bị loại khỏi `:root` — `--duration-fast`, `--duration-base`, `--shadow-overlay`, `--container-prose` đều biến mất. Khi đó khối `prefers-reduced-motion` ở §1.6 không có biến nào để ghi đè, và D12 fail mà không có lỗi build nào.
- **Chỉ có giao diện sáng.** Không có `.dark`, `ThemeToggle` hay script theme trong `<head>`.

Giá trị `--color-primary` giữ nguyên `#0D9488` của chủ sở hữu cho phần **không chứa chữ** (ring, thanh tiến độ, chỉ báo tab: 3.58:1 > 3.0 cho UI phi văn bản); nền đặc có chữ dùng `--color-primary-strong` `#0F766E` (5.47:1). Chữ trên `--color-accent` là `#431407` (4.91:1), không phải trắng. Ba cặp bị cấm liệt kê ở UX_PLAN.md §8.1.

`design/elearning.pen` phải khớp bảng token của UX_PLAN.md, không phải ngược lại — nguồn chân lý là `design/contrast-check.py` vì đó là thứ chạy được.

**Cặp màu phải đo ở D11** nằm ở UX_PLAN.md §8.1 và trong `PAIRS` của `design/contrast-check.py`. Script đã được cập nhật sang bộ token của UX_PLAN.md và chạy lại: **23/23 pass**, cộng ba cặp bị cấm được khẳng định là vẫn trượt ngưỡng.

### Shape lỗi API và `src/lib/api.ts`

`src/lib/api.ts` là file mà mọi trang của bốn phase sau đi qua, nên nó phải ra đời ở Phase 1. Hình dạng của nó thì **không** do roadmap này quyết:

- **Envelope lỗi và danh mục `code`**: API_CONTRACT.md §2.4 (`{ statusCode, code, message, error }`, cộng `details` và `requestId` khi có) và §2.5 (danh mục 28 mã). Bản đầu của roadmap này khai một envelope ba field thiếu `error` và một bảng 20 mã tự chế — đó là hợp đồng thứ hai và là cái sai.
- **Bản dịch `code` sang tiếng Việt**: API_CONTRACT.md §2.5b, lấy chuỗi từ UX_PLAN.md §6.2–§6.4.

`code` là chuỗi ổn định, `SCREAMING_SNAKE_CASE`. `message` chỉ để log, **web không hiển thị `message` của API** — hiển thị chuỗi tiếng Việt tra từ `code`, vì đó là cách duy nhất đạt D13 mà không phải dịch backend.

`api.ts` xuất đúng ba thứ:

- `apiFetch(path, init)` — gắn `credentials: 'include'`, lấy CSRF token từ cookie và gắn header `X-CSRF-Token` cho mọi method không phải `GET`, timeout 10s bằng `AbortSignal.timeout(10_000)`. Không thư viện HTTP.
- `class ApiError extends Error { status: number; code: string }` — ném khi `res.ok` là `false`; timeout và lỗi mạng ném `ApiError` với `code = 'NETWORK_ERROR'`, `status = 0`.
- `requireAuth(response)` dùng trong server component: `401` → `redirect('/login?next=' + encodeURIComponent(pathname))`; `403` với `code = 'NOT_ENROLLED'` → `redirect` sang `/courses/[slug]?denied=1`; mọi `403` khác và `404` → `notFound()`.

Fetch phía server phải gọi thẳng `API_ORIGIN` bằng URL tuyệt đối, chuyển tiếp header `cookie` từ `await cookies()`, và đặt `cache: 'no-store'` — rewrite của Next **không** áp cho request mà chính server Next phát ra (API_CONTRACT.md §3.3).

Trang `/login` đọc `searchParams.next`, chỉ chấp nhận giá trị bắt đầu bằng đúng một dấu `/` và không bắt đầu bằng `//` (chặn open redirect), mặc định **`/my-courses`** — tên trang lấy từ UX_PLAN.md §2.1, không phải `/dashboard`.

### Seed

Một file `prisma/seed.ts`, idempotent bằng `upsert` theo khoá tự nhiên (`email` cho user, `slug` cho category và course), thoát ngay với mã khác 0 nếu `NODE_ENV === 'production'`.

**Nội dung seed thuộc [DATA_MODEL.md](./DATA_MODEL.md) §Dữ liệu seed cho bản demo** — 8 `Category`, 6 `Course` (4 `PUBLISHED` + 1 `DRAFT` + 1 `ARCHIVED`), 17 `Section`, 68 `Lesson`, 58 `VideoAsset`, 12 `LessonResource`, 4 `User`, 3 `Enrollment`, 9 `LessonProgress`, cùng bảng slug, bảng tài khoản và khuôn sinh tiêu đề. Seed lớn dần theo migration: phần catalog chỉ chạy được sau migration 3, phần enrollment sau migration 4.

Bản đầu của roadmap này chốt một seed hai nhánh bật bằng `SEED_DEMO_DATA=true` dựng đúng một course `khoa-hoc-demo`. Bộ đó bị bỏ vì ba lý do đo được: `.env.example` thật **không có biến `SEED_*` nào** (DEMO_MODE.md §7 — mật khẩu demo ghi thẳng trong seed và README, và thứ thật sự chặn là seed tự thoát ở production); một course duy nhất không chứng minh được bộ lọc catalog, tường paywall và ca `ARCHIVED` mà chính A3.12 và N2.2 của roadmap này đòi; và bộ 6 khóa là thứ duy nhất làm hai màn hình `EmptyState` khác nhau ở UX_PLAN.md §6.2 có dữ liệu để phân biệt.

`test/learning.e2e-spec.ts` và ca demo của `test/checkout-flow.e2e-spec.ts` dùng **chính seed này** làm fixture, không tự dựng course riêng: khóa flagship `lap-trinh-web-voi-react-va-nextjs` (C1) cho luồng đã có quyền học, `student3@elearning.local` cho đường từ chối, và C6 `lap-trinh-di-dong-voi-react-native` cho ca `ARCHIVED`. Ca demo của checkout mua C2 `typescript-cho-nguoi-da-biet-javascript` (499.000 ₫) bằng `student3@elearning.local`, người mua chưa có quyền học nào.

Prisma 7 **không đọc lệnh seed từ `package.json`** — đã kiểm chứng trong `apps/api/node_modules/prisma/build/cli.js`: thân lệnh `db seed` là `let i = n.migrations?.seed; if (!i) return <cảnh báo>`, tức thiếu khoá đó thì `prisma db seed` in cảnh báo, thoát `0` và **không tạo admin**, kéo theo A1.4/A1.5 fail. Nên `prisma.config.ts` phải có:

```ts
migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
```

Runner là `tsx`, thêm vào `devDependencies` của `apps/api`. Không dùng `node --experimental-strip-types`: generator `prisma-client` sinh ra `src/generated/prisma/*.ts` và quy ước của repo import bằng đuôi `.js` (`auth.service.ts:6`), mà type stripping của Node 24.8 **không** viết lại `.js` thành `.ts` — đã tái hiện: `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…/b.js' imported from '…/a.ts'`. `tsx` viết lại được. Giữ thêm script `"seed": "tsx prisma/seed.ts"` để chạy trực tiếp bằng `pnpm --filter api seed`.

### `prisma generate` phải chạy tường minh

`apps/api/package.json` hiện dựa vào `"prebuild": "prisma generate"`. pnpm 11 mặc định **không** chạy pre/post script — kiểm chứng trong bundle corepack pnpm 11.24.0: `enablePrePostScripts: opts3.enablePrePostScripts ?? false`, và repo không có `.npmrc` nào, `pnpm-workspace.yaml` cũng không đặt khoá đó. `apps/api/.gitignore` bỏ qua `src/generated/prisma/` và `git ls-files apps/api/src/generated` trả về 0 file. Trên một checkout sạch, D2 (`tsc --noEmit`) và D5 (`nest build`) đều fail vì không phân giải được `../generated/prisma/client.js`.

Hai sửa đổi, cả hai đều bắt buộc vì lint và typecheck không đi qua `build`:

- `apps/api/package.json`: bỏ `prebuild`, đổi `"build": "prisma generate && nest build"`.
- `.github/workflows/ci.yml`: một bước `corepack pnpm --filter api exec prisma generate` **trước** D1.

### File và module

| Nơi | Thêm mới | Sửa | Xoá |
|---|---|---|---|
| `apps/api` | `src/config.ts`, `src/config/drivers.ts`, `src/common/error-filter.ts`, `src/common/error-codes.ts`, `src/common/request-id.middleware.ts`, `src/auth/admin.guard.ts`, `src/auth/rate-limit.decorator.ts`, `src/auth/auth-token.service.ts`, `src/mail/mailer.ts` + `dev-inbox.mailer.ts` + `smtp.mailer.ts`, `src/dev/dev-mail.controller.ts`, `src/contact/contact.controller.ts`, `src/health/health.controller.ts`, `prisma/seed.ts` | `src/app.module.ts` (`HealthModule`, `CsrfGuard` thành `APP_GUARD`, import `DevModule` có điều kiện), `src/app.setup.ts` (`error-filter`, `X-Request-Id`), `src/auth/auth.module.ts` + `src/prisma/prisma.service.ts` (đọc `config`), `src/auth/auth.controller.ts` (+ nhóm `/auth/verify-email/*`, `/auth/password/*`, `/users/me*`), `src/auth/auth.service.ts` (`changePassword` thu hồi session), `src/auth/auth-rate-limit.guard.ts` (tham số hoá `@RateLimit`), `src/main.ts` (`import './config/drivers.js'` là **dòng import đầu tiên**), `prisma.config.ts` (`migrations.seed`), `package.json` (`build` gọi `prisma generate`, devDep `tsx`, script `seed`), `.env.example`, `test/app.e2e-spec.ts` (bỏ case `serves the API root`, thay bằng assert health) | `src/app.controller.ts`, `src/app.controller.spec.ts` |
| `apps/web` | `next.config.ts`, `src/proxy.ts`, `src/lib/api.ts`, `src/lib/session.ts` (`getSession()` server-side), `src/lib/site.ts` (`SITE_OWNER`), `src/messages/vi.ts` + hàm `t()` (PLAN_SUPPLEMENT.md §4.9 — tên file chốt là `src/messages/vi.ts`, không phải `src/lib/messages.ts`), `src/app/loading.tsx`, `error.tsx`, `not-found.tsx`, `global-error.tsx`, `src/app/(auth)/{login,register,forgot-password,reset-password,verify-email}/page.tsx`, `src/app/(learner)/account/{page,password/page,sessions/page}.tsx`, `src/app/(marketing)/contact/page.tsx`, `src/components/ui/*` (Button, Input, Field, Alert, Skeleton, EmptyState, ErrorState, Toast) | `src/app/globals.css` (hai khối của UX_PLAN.md §1.1), `src/app/layout.tsx` (font, skip-link, không có script theme), `package.json` (`lucide-react`), `.env.example` | — |
| gốc | `.github/workflows/ci.yml` | `README.md` | — |

Cột "Xoá" tồn tại vì một lý do cụ thể: `src/app.controller.spec.ts` assert `getHello()` trả `'Hello World!'` (D3) và `test/app.e2e-spec.ts` có case `serves the API root` gọi `GET /api/v1` (D4). Gỡ `AppController` mà không đụng hai file đó thì Phase 1 không đạt được Definition of Done của chính nó.

`src/lib/site.ts` chứa hằng số `SITE_OWNER = { name, title, bio, avatarUrl }` — **không phải cột database**. Sản phẩm một chủ sở hữu nên "giới thiệu giảng viên" ở trang chủ và tên trên course card đọc từ hằng số này. Không thêm `Course.instructorName`, không thêm quan hệ `instructor`.

### Migration

`add_auth_tokens` — model `AuthToken` cùng enum `AuthTokenType`. **Tên model, tên field, tên và giá trị enum, index: đọc ở [DATA_MODEL.md](./DATA_MODEL.md) §AuthToken và §Prisma schema đầy đủ.** Bản đầu của roadmap này khai `AuthTokenType { EMAIL_VERIFY, PASSWORD_RESET }`; giá trị chốt là **`EMAIL_VERIFICATION`**, và một chữ lệch ở đây là một `ALTER TYPE` về sau.

Chỉ lưu hash của token, không lưu token gốc; token gốc chỉ tồn tại trong đường link gửi đi. TTL đọc từ env: `EMAIL_VERIFY_TTL_MINUTES=1440`, `PASSWORD_RESET_TTL_MINUTES=60` (mục 2.3).

### Route API thêm (12)

Toàn bộ nhóm `/auth/verify-email/*`, `/auth/password/*` và `/users/me*` còn thiếu trong **[API_CONTRACT.md](./API_CONTRACT.md) §5.1**, cộng `GET /health` và hai route hộp thư dev `GET /dev/mail`, `GET /dev/mail/{id}` (§5.9). Đường dẫn, DTO, ràng buộc `class-validator`, mã lỗi và cột "Trang" đọc ở đó — roadmap này **không** khai lại tên route. Bản đầu khai `POST /auth/verify-email`, `/auth/resend-verification`, `/auth/forgot-password`, `/auth/reset-password`, `PATCH /auth/password`, `GET|DELETE /auth/sessions` — bảy tên, không tên nào tồn tại trong hợp đồng.

Ba điểm về nhóm này là quyết định phạm vi phase, nên chúng ở lại đây:

- Nhóm `/users/me*` là phần PROJECT_PLAN.md dòng 162 và 293 yêu cầu ("hồ sơ cá nhân, đổi mật khẩu, quản lý phiên đăng nhập", "thu hồi toàn bộ session khi đổi mật khẩu"), và là thứ N1.7 đang test. Không hoãn sang phase sau.
- Đổi mật khẩu thu hồi **toàn bộ** session kể cả session hiện tại. An toàn hơn khi lý do đổi mật khẩu là nghi ngờ bị lộ, và nó tránh một nhánh "session nào được sống" phải test riêng.
- `SessionRow` chỉ có `id`, `createdAt`, `expiresAt`, `isCurrent` — không user-agent, không IP. `model Session` không có cột nào cho hai thứ đó, nên màn hình không được hứa "nhận ra thiết bị lạ" (UX_PLAN.md §3.3).

### Test bắt buộc

| File | Nội dung |
|---|---|
| `src/auth/admin.guard.spec.ts` | STUDENT nhận `NotFoundException`, chưa đăng nhập nhận `NotFoundException`, session bị thu hồi nhận `NotFoundException`, ADMIN đi qua và `request.auth` được đặt. Bốn nhánh thất bại phải **không phân biệt được** với nhau |
| `src/auth/auth-token.service.spec.ts` | token hết hạn bị từ chối; token đã `consumedAt` bị từ chối; dùng lại lần hai bị từ chối; hai TTL khác nhau cho hai `AuthTokenType` |
| `src/config.spec.ts` | thiếu biến bắt buộc thì boot fail; `AUTH_JWT_SECRET` < 32 byte thì fail |
| `src/config/drivers.spec.ts` | `assertDriverValuesAreKnown` từ chối `VIDEO_DRIVER=cloudfare` ở **mọi** môi trường; ca `''` là ca bắt buộc (DEMO_MODE.md §6) |
| `src/common/error-filter.spec.ts` | mọi `HttpException` ra envelope `{ statusCode, code, message, error }`; exception không có `code` thì lấy `code` mặc định theo `statusCode`; `requestId` chỉ xuất hiện khi `statusCode >= 500` |
| `test/auth.e2e-spec.ts` | tách khỏi `app.e2e-spec.ts`; thêm luồng verify email và reset password đầu-cuối, đọc token từ dòng log JSON của `DevInboxMailer`; thêm luồng đổi mật khẩu và liệt kê/thu hồi session |

### Demo script

1. `Copy-Item apps/api/.env.example apps/api/.env` và `Copy-Item apps/web/.env.example apps/web/.env`, điền `AUTH_JWT_SECRET` (sinh bằng lệnh ở DEMO_MODE.md §8). Không có `SEED_*` nào để điền — tài khoản demo ghi thẳng trong seed.
2. `corepack pnpm --filter api prisma:generate`, `corepack pnpm --filter api prisma:migrate`, rồi `corepack pnpm --filter api exec prisma db seed` — lệnh seed phải **in ra** dòng tạo 4 tài khoản; nếu nó im lặng thì `prisma.config.ts` thiếu `migrations.seed`.
3. `corepack pnpm dev`.
4. Mở `http://localhost:3000/register`, đăng ký một học viên. Trang chuyển sang trạng thái đã đăng nhập, kèm banner "Email của bạn chưa được xác minh."
5. Nhìn console của `api`: một dòng JSON `{"evt":"mail.sent","tag":"verify-email",…,"link":"http://localhost:3000/verify-email?token=…"}`.
6. Dán link vào trình duyệt → hiện "Email đã được xác minh". Banner biến mất.
7. `http://localhost:3000/login`, đăng xuất rồi đăng nhập lại bằng `admin@elearning.local` / `Demo!Admin123`.
8. Mở `http://localhost:3000/api/v1/health` → JSON `{"status":"ok","database":"up","uptimeSeconds":…}` (chứng minh rewrite của Next hoạt động, không phải gọi thẳng cổng 3001).
9. Mở `http://localhost:3001/api/v1/dev/mail` bằng cookie admin → hộp thư dev liệt kê thư vừa gửi, dấu tiếng Việt hiển thị đúng.
10. `/account/sessions` liệt kê 1 phiên đang dùng. Mở trình duyệt thứ hai, đăng nhập cùng tài khoản → danh sách thành 2 phiên. Bấm "Thu hồi" phiên kia → trình duyệt thứ hai tải lại thì bị đẩy về `/login`.
11. `/account/password` → đổi mật khẩu → bị đăng xuất ở **cả hai** trình duyệt, đăng nhập lại bằng mật khẩu mới.
12. Mở `/my-courses` khi chưa đăng nhập → bị đẩy sang `/login?next=%2Fmy-courses`; đăng nhập xong quay lại đúng `/my-courses`.
13. Tắt tiến trình `api`, tải lại `/account` → hiện skeleton rồi thông báo tiếng Việt của `error.tsx`, không phải stack trace. Bật lại api.
14. Thu nhỏ cửa sổ xuống 375px, dùng `Tab` đi hết form đăng nhập, bấm `Enter` để submit.

### Acceptance

| # | Kiểm tra | Kết quả bắt buộc |
|---|---|---|
| A1.1 | `curl.exe -s -o NUL -w "%{http_code}" http://localhost:3000/api/v1/health` | `200` |
| A1.2 | `curl.exe -s http://localhost:3001/api/v1/health` | body chứa `"database":"up"` |
| A1.3 | `corepack pnpm --filter api exec prisma db seed` chạy lần thứ hai | exit 0 |
| A1.4 | `psql $env:DATABASE_URL -c "select count(*) from users where role='ADMIN'"` | `1` (`admin@elearning.local`) |
| A1.5 | Đăng nhập `admin@elearning.local` / `Demo!Admin123` trên web, `GET /api/v1/auth/me` | `user.role` = `ADMIN`, `emailVerifiedAt` khác `null` |
| A1.6 | Luồng reset password đầu-cuối trong `test/auth.e2e-spec.ts` | pass |
| A1.7 | `corepack pnpm --filter web build` | exit 0, không cảnh báo font |
| A1.8 | `GET /api/v1/users/me/sessions` bằng cookie vừa đăng nhập ở hai trình duyệt | 2 phần tử, đúng một phần tử có `isCurrent: true` |
| A1.9 | `py -3 design/contrast-check.py` | exit 0, `44/44 pass`, và ba cặp bị cấm ở UX_PLAN.md §8.1 vẫn dưới ngưỡng |
| A1.10 | Xoá thư mục `apps/api/src/generated`, chạy `corepack pnpm typecheck` sau bước `prisma generate` của CI | exit 0 |
| N1.1 | Gọi bất kỳ route `/admin/*` bằng cookie của STUDENT | `404 NOT_FOUND`, body **giống hệt** một đường dẫn không tồn tại |
| N1.2 | Gọi route đó khi chưa đăng nhập | `404 NOT_FOUND`, body giống hệt N1.1 — hai nhánh phải không phân biệt được (API_CONTRACT.md §3.3, §6.3) |
| N1.3 | Dùng lại link verify email lần thứ hai | `400 TOKEN_INVALID`, `consumedAt` không đổi |
| N1.4 | Dùng link reset password đã quá `expiresAt` | `400 TOKEN_INVALID`, mật khẩu không đổi |
| N1.5 | `POST /api/v1/auth/login` thiếu header `X-CSRF-Token` | `403 CSRF_INVALID`, và **không** tốn quota rate limit |
| N1.6 | Xoá `AUTH_JWT_SECRET` khỏi `.env` rồi khởi động api | process thoát với lỗi nêu đúng tên biến |
| N1.7 | `POST /users/me/password` xong, dùng lại cookie session cũ gọi `/auth/me` | `401` (toàn bộ session bị thu hồi, kể cả session vừa gọi) |
| N1.8 | `POST /users/me/password` với `currentPassword` sai | `401`, `code` = `INVALID_CREDENTIALS`, mật khẩu không đổi, session không bị thu hồi |
| N1.9 | `DELETE /users/me/sessions/{id}` với id session của người khác | `404`, session đó vẫn dùng được |
| N1.10 | Mở `/login?next=https://evil.example/` rồi đăng nhập | chuyển về `/my-courses`, không về domain ngoài |
| N1.11 | Đặt `VIDEO_DRIVER=cloudfare` (gõ sai) rồi khởi động api ở `NODE_ENV=development` | process thoát, lỗi nêu đúng giá trị sai — cấu hình sai phải ồn ào, không im lặng rơi về demo |

## 6. Phase 2 — Catalog và soạn nội dung

**Ước lượng: XL.** Phase nặng nhất: vừa dựng toàn bộ hệ thống thiết kế trên màn hình thật, vừa làm CRUD 4 tầng.

### Scope

- Trang chủ theo pattern Marketplace/Directory: hero có ô tìm kiếm, lưới `Category`, khóa học nổi bật, khối uy tín (số học viên, số bài, giới thiệu chủ sở hữu đọc từ `SITE_OWNER` trong `src/lib/site.ts`).
- `/courses`: tìm kiếm, lọc, sắp xếp; toàn bộ state nằm trong `searchParams`, server component, không thư viện state. **Tên và cú pháp tham số là của [API_CONTRACT.md](./API_CONTRACT.md) §2.7–§2.8 và §5.2** (`q`, `category` csv slug, `level` csv enum, `priceVndMin`/`priceVndMax`, `sort=<field>:<asc|desc>`, `page`/`pageSize`), ánh xạ sang nhãn tiếng Việt theo `SortSelect` ở UX_PLAN.md §4.5. Bản đầu của roadmap này tự chế `?priceMin=&sort=newest|price_asc|popular` — một cú pháp thứ hai cho cùng một endpoint. `sort` ngoài whitelist trả `VALIDATION_FAILED`, không im lặng bỏ qua.
- Course card kiểu Udemy: ảnh bìa, tiêu đề, `subtitle`, cụm `Rating`, `enrollmentCount`, tổng thời lượng, số bài, `PriceTag`. **Có `ratingAverage`/`ratingCount`/`demoStats`** — DATA_MODEL.md, API_CONTRACT.md §4, UX_PLAN.md §4.5 và PLAN_SUPPLEMENT.md §4.4 đều chốt ba cột đó, nên chúng nằm trong migration `add_catalog` và trong DTO `CourseCard` ngay từ phase này. Điều **vẫn giữ nguyên** từ PROJECT_PLAN.md là ràng buộc ngược lại: **không có model `Review`, không có endpoint gửi đánh giá**, không có luồng kiểm duyệt. Cụm sao ẩn khi `ratingCount = 0`, và khóa nào mang `demoStats = true` thì cạnh cụm sao có `Badge` "Dữ liệu demo".
- Tìm kiếm tiếng Việt: cột `Course.searchText` lưu bản đã bỏ dấu và lowercase (`NFD` + strip diacritic + `đ`→`d`), truy vấn `contains` của Prisma trên đúng cột đó. Không `unaccent`, không `tsvector`, không search engine — chi tiết ở DATA_MODEL.md §Course và API_CONTRACT.md §2.8.
- `/courses/[slug]`: mô tả, "Bạn sẽ học được gì", yêu cầu, đối tượng, curriculum accordion, **bài học thử xem được sau khi đăng nhập, không cần mua**. Không có nhánh ẩn danh nào trên đường media: `POST /lessons/{id}/playback-token` yêu cầu session kể cả cho bài preview (API_CONTRACT.md §6.1 bước 1, và PLAN_SUPPLEMENT.md §4.1 gọi tên chính dòng cũ của roadmap này là dòng phải sửa). Đổi lại, preview trở thành lý do tạo tài khoản và bề mặt ẩn danh trên đường media bằng 0.
- Curriculum accordion dùng `<details>/<summary>` native. Không thư viện accordion, mở/đóng bằng bàn phím có sẵn.
- Admin: CRUD `Course`, `Section`, `Lesson`, `Category`, `VideoAsset`, `LessonResource`; upload ảnh bìa và tài liệu qua storage seam; publish/unpublish/archive có validate; dashboard đếm số.
- Sắp xếp thứ tự bằng nút lên/xuống (Lucide `ChevronUp`/`ChevronDown`, 44×44px). Không thêm thư viện drag-drop: nút bấm vốn đã dùng được bằng bàn phím, drag-drop thì không.
- Markdown render có sanitize phía **web**, đúng một lần: API lưu và trả Markdown thô (API_CONTRACT.md §5.3). Hai nơi sanitize nghĩa là hai bộ quy tắc sẽ lệch nhau.
- Chỉ một cấp `Category`, không subcategory.

### Bốn quy tắc phải viết ra vì mỗi quy tắc là một chỗ người build sẽ tự bịa

**Phân trang.** Áp cho các list có thể tăng không giới hạn — `GET /courses`, `/admin/courses`, `/admin/users`, `/admin/enrollments`, `/admin/audit-logs`, `/admin/payments`, `/purchases/me`, `/enrollments/me`: query `?page=1&pageSize=20`, `pageSize` bị kẹp về tối đa `100`, response luôn là `{ items, page, pageSize, total, totalPages }` (shape chốt ở API_CONTRACT.md §2.7 — có `totalPages`). `GET /admin/categories` trả toàn bộ danh sách ngắn theo `position` để sắp xếp trực tiếp, không phân trang. `/admin/audit-logs` mặc định sort `createdAt desc` — đó là bảng duy nhất tăng vô hạn theo thời gian. Một helper `src/common/pagination.ts` phân tích query và kẹp giá trị; không lặp lại logic ở từng controller.

**Slug.** Sinh từ `title` bằng **đúng hàm bỏ dấu của `search-text.ts`**, thay khoảng trắng và ký tự lạ bằng `-`, gộp `-` liên tiếp, cắt hai đầu. Trùng thì thêm hậu tố `-2`, `-3`, … do server sinh, không để `409` bắn ra giữa lúc admin đang gõ tiêu đề. Form admin hiện slug preview realtime và cho sửa **khi còn `DRAFT`**; sau lần publish đầu tiên slug khoá vĩnh viễn, vì đổi nó là làm hỏng link đã chia sẻ và sitemap. `N2.6` (`409` khi trùng slug) chỉ còn xảy ra khi admin tự nhập tay đúng một slug đã tồn tại.

**`searchText`.** Nguồn = `title + ' ' + subtitle`, không gồm `description` (Markdown dài, làm `ILIKE '%q%'` nhiễu). Ghi trong **cùng transaction lưu course**, không trigger, không backfill job — dữ liệu cũ không tồn tại vì cột sinh ra cùng bảng. Cố ý **không index**: `ILIKE '%q%'` không dùng được btree, thêm index chỉ tốn ghi mà không đổi kế hoạch truy vấn. Kèm `ponytail:` comment nêu trần và đường nâng cấp: seq scan chấp nhận được tới khoảng 500 course, vượt ngưỡng đó thì đổi sang `pg_trgm` GIN.

**`ARCHIVED`.** Ẩn khỏi `/courses`, khỏi `/courses/:slug` cho khách, khỏi sitemap; `POST /checkout/:slug` trả `409`. Nhưng `Enrollment` đang `ACTIVE` **vẫn học được bình thường** — người đã trả tiền không mất quyền vì chủ sở hữu ngừng bán. Đây là lý do PROJECT_PLAN.md cấm xoá vật lý course đã có người mua.

### File và module

| Nơi | Thêm mới |
|---|---|
| `apps/api` | `src/common/pagination.ts`, `src/catalog/catalog.module.ts`, `catalog.controller.ts` (public), `admin-catalog.controller.ts`, `catalog.service.ts`, `course.dto.ts`, `publish-validation.ts`, `search-text.ts`, `slug.ts`; `src/media/media.module.ts`, `object-storage.ts` (seam), `local-disk.storage.ts`, `r2.storage.ts`, `local-file.controller.ts`, `admin-media.controller.ts`, `stream.client.ts` (seam) + hai lớp, `admin-video.controller.ts`; `src/reporting/reporting.controller.ts` |
| `apps/web` | Mười hai trang theo cây route UX_PLAN.md §2.2: `(marketing)/page.tsx` (viết lại), `courses/page.tsx`, `courses/[slug]/page.tsx`, `categories/[slug]/page.tsx`, `about/page.tsx`, `(admin)/admin/page.tsx`, `admin/categories/page.tsx`, `admin/courses/page.tsx`, `admin/courses/new/page.tsx`, `admin/courses/[id]/page.tsx`, `admin/courses/[id]/curriculum/page.tsx`, `admin/courses/[id]/lessons/[lessonId]/page.tsx`; cộng `src/lib/markdown.ts` và các component ở UX_PLAN.md §4.5 và §4.7 (`CourseCard`, `CourseGrid`, `SearchHero`, `CategoryChips`, `CourseFilters`, `SortSelect`, `Rating`, `PriceTag`, `CurriculumAccordion`, `Pagination`, `DataTable`, `SortableList`, `PublishChecklist`, `VideoAssetField`, `ResourceUploader`, `FileDropzone`, `MarkdownEditor`, `TagListInput`, `CategoryManager`, `CategoryDialog`) |

Hai dependency mới cho `apps/web`, đây là ngoại lệ có lý do: `marked` (parse Markdown) và `sanitize-html` (lọc HTML). Ranh giới XSS không phải chỗ để tiết kiệm dependency — nguồn nội dung là Markdown admin nhập và nó render trên trang công khai. Chúng nằm ở **web** chứ không ở api vì API_CONTRACT.md §5.3 chốt sanitize xảy ra đúng một lần, ở renderer phía web. `src/lib/markdown.ts` phải là **allowlist** (danh sách thẻ, thuộc tính và protocol được phép), không phải denylist; một regex tự viết loại `<script>` và `onerror=` vẫn dính `javascript:` href, `<svg onload>`, mutation-XSS và payload mã hoá entity.

**Route API thêm (35).** Danh sách đường dẫn, DTO và mã lỗi nằm ở [API_CONTRACT.md](./API_CONTRACT.md): §5.2 (catalog công khai + `POST /contact`), §5.3 (soạn nội dung admin, gồm cả `PUT .../order` và `POST /admin/courses/{id}/unpublish`), §5.6 (media: hai `*-upload-url`, `POST|GET /admin/videos`, `PUT|GET /media/local/{key}`) và `GET /admin/reports/overview` ở §5.7. Roadmap này **không** khai lại tên route — bản đầu khai `POST /admin/sections/reorder`, `POST /admin/uploads`, `DELETE /admin/lesson-resources/:id`, `GET /admin/stats`, `POST|PATCH|DELETE /admin/video-assets`, `GET /media/local/:token`; sáu tên, không tên nào tồn tại trong hợp đồng.

Năm nhóm dưới đây là phần bị thiếu chứ không phải phần thừa; lý do ở lại đây vì đó là quyết định phạm vi phase:

- **`GET /admin/courses` và `GET /admin/courses/{id}`.** Hai trang admin không có gì để fetch nếu thiếu: route public trả `404` cho `DRAFT` (N2.1) nên không dùng lại được. `GET /admin/courses` gồm cả `DRAFT`/`ARCHIVED`, phân trang, `?status=`. `GET /admin/courses/{id}` trả nguyên cây `section`/`lesson` chưa publish kèm `videoAssets[]`, nhưng **chỉ outline** — không có `content`, không có `resources`, không có playback token; xem trước nội dung đi bằng nhánh bypass theo vai trò ở `/learn/*` (API_CONTRACT.md §5.2). `GET /admin/categories` cùng lý do.
- **`GET /admin/reports/overview`** nuôi năm ô `StatTile` của `src/app/(admin)/admin/page.tsx`. Hai ô doanh thu bị ẩn khi `NEXT_PUBLIC_CHECKOUT_ENABLED=false` (mục 2.2). Ba số `draftCourses`, `pendingPaymentAttempts`, `videoAssetsNotReady` là trạng thái hiện tại, không phụ thuộc `from`/`to`.
- **`POST /admin/videos` và `GET /admin/videos/{id}`.** Không có hai route này thì không có đường nào tạo một hàng `VideoAsset`, mà `publish-validation` lại đòi `status = READY` và `Course.totalDurationSeconds` lại cộng từ `durationSeconds`. Driver `demo`: `externalId` dạng `demo/…`, `getStatus()` luôn trả `ready: true`. Driver `cloudflare`: `GET /admin/videos/{id}` gọi Stream API rồi ghi lại `status`/`durationSeconds` — **polling đồng bộ, không webhook**. Webhook trạng thái Cloudflare (PROJECT_PLAN.md dòng 123) **không xây**: nó chỉ có giá trị khi upload chạy trong admin, mà cách làm đã chốt là upload bằng Cloudflare Dashboard rồi dán UID.
- **`POST /admin/lessons/{id}/resources` và `DELETE /admin/resources/{id}`.** `POST /admin/lessons/{id}/resources/upload-url` chỉ trả object key đã ký, không gắn vào lesson nào. Không có hai route này thì không hàng `LessonResource` nào tồn tại và endpoint tải tài liệu của Phase 3 không có gì để phục vụ.
- **`PUT|GET /media/local/{key}`.** Driver demo presign bằng HMAC — mà URL presign phải trỏ vào một handler. Ảnh bìa upload ở bước 7 của demo không hiển thị được ở bước 10 nếu thiếu. Controller chỉ vào mảng `controllers` khi `STORAGE_DRIVER !== 'r2'`, và **key đến từ client**: bảy bước kiểm tra ở DEMO_MODE.md §3 là bắt buộc và không được rút gọn, gồm cả bước 0 chặn key `public/` không khớp template ảnh bìa.

### Migration

`add_catalog` — `Category`, `Course`, `Section`, `Lesson`, `VideoAsset`, `LessonResource` cùng sáu enum liên quan.

**Tên model, tên field, tên và giá trị enum, index, cascade: đọc ở [DATA_MODEL.md](./DATA_MODEL.md) §Prisma schema đầy đủ.** Bản đầu của roadmap này khai ba khối `prisma` riêng và lệch ở bốn chỗ, mỗi chỗ là một `ALTER TYPE` hoặc một migration sửa lỗi về sau: `CourseLevel` thiếu `ALL_LEVELS` và để cột nullable (chốt là 4 giá trị, `NOT NULL`, default `ALL_LEVELS`); `VideoAssetStatus` thiếu `PROCESSING` và viết `ERROR` thay vì `ERRORED`; `VideoAsset.externalId` unique đơn thay vì `@@unique([provider, externalId])` — với unique đơn, một bản ghi demo `demo/c1-s1-l1` và một UID Cloudflare không cùng tồn tại được trong một database, tức là phá đúng thứ quyết định demo-first cần.

Ba cột rating (`ratingAverage Decimal(2,1)?`, `ratingCount Int @default(0)`, `demoStats Boolean @default(false)`) nằm trong **chính migration này**, không hoãn: `CourseCard` của phase này đã vẽ cụm sao, và seed đã ghi giá trị cho 5 khóa.

Chuyển trạng thái `CourseStatus` (gồm cả `PUBLISHED → DRAFT` và `ARCHIVED → DRAFT`, cả hai đều hợp lệ và đều là nút "Bỏ lưu trữ"/"Gỡ xuất bản" của UX_PLAN.md §5.7) và `VideoAssetStatus`: bảng đầy đủ ở DATA_MODEL.md §Chuyển trạng thái. Quy tắc **khóa slug sau lần publish đầu** thì giữ nguyên và độc lập với `status` — nó bám `publishedAt`, nên quay về `DRAFT` vẫn không mở lại được ô slug.

**`CHECK` phải viết tay vào file SQL của migration.** Prisma Schema Language không có cú pháp CHECK — đã kiểm chứng với prisma 7.10.0: `@@check(priceVnd >= 0)` fail validation `P1012` "This line is not a valid field or attribute definition." Quy trình bắt buộc: `prisma migrate dev --create-only`, rồi thêm vào cuối file `.sql` vừa sinh:

```sql
ALTER TABLE "courses" ADD CONSTRAINT "courses_price_vnd_check" CHECK ("price_vnd" >= 0);
```

Đây là **bốn** `CHECK` cộng một unique một phần, không phải hai; danh sách nguyên văn ở DATA_MODEL.md §SQL viết tay nối vào cuối migration. D6 kiểm tra chính điều này: sau replay trên DB sạch, constraint viết tay vẫn còn.

`Course` giữ ba cột phi chuẩn hoá `lessonCount`, `totalDurationSeconds` và `enrollmentCount`. Hai cột đầu tính lại ở **mọi** mutation chạm curriculum, không phải chỉ lúc publish (API_CONTRACT.md §5.3): thêm hoặc xoá một bài trên khoá đang `PUBLISHED` là chuyện bình thường, và catalog được cache `public, max-age=60` nên một con số cũ được phục vụ cho mọi khách. `enrollmentCount` trả `0` cho tới Phase 3.

### Test bắt buộc

| File | Nội dung |
|---|---|
| `src/catalog/publish-validation.spec.ts` | thiếu mô tả / thiếu ảnh bìa / không có section / có lesson trỏ vào `VideoAsset` chưa `READY` → chặn publish, thông báo nêu đúng lý do |
| `src/catalog/search-text.spec.ts` | `"Lập trình"` → `"lap trinh"`; tìm `"lap trinh"` khớp khóa học tên có dấu |
| `src/catalog/slug.spec.ts` | `"Lập trình JavaScript"` → `"lap-trinh-javascript"`; trùng lần hai → `-2`, lần ba → `-3`; ký tự lạ và `-` liên tiếp bị gộp |
| `src/catalog/reorder.spec.ts` | đảo thứ tự giữ `(courseId, position)` liên tục, không trùng, chạy trong một transaction |
| `apps/web/src/lib/markdown.spec.ts` | loại bỏ: `<script>`, `onerror=`, `<a href="javascript:…">`, `<svg onload=…>`, `<iframe>`, payload mã hoá entity (`&#106;avascript:`); giữ nguyên: `<a href="https://…">`, `<strong>`, `<ul>`, `<code>` |
| `src/common/pagination.spec.ts` | `pageSize=200` bị kẹp về `100`; `page=0` và `page=-1` về `1`; giá trị không phải số về mặc định; response có đủ `totalPages` |
| `src/media/local-file.spec.ts` | URL lấy từ `signedDownloadUrl` rồi `PUT` vào chính nó → `403` (chữ ký phải chứa HTTP method); key `public/…` không khớp template ảnh bìa trên đường `PUT` → `403`; key `public/…` trên đường `GET` không cần `exp`/`sig` |
| `test/catalog.e2e-spec.ts` | DRAFT không lộ ra public; PUBLISHED trả đúng curriculum; lesson không `isPreview` không trả `content` cho khách; STUDENT nhận `404` trên mọi route `/admin/*`; `GET /admin/courses` bằng cookie admin trả cả DRAFT |

### Demo script

1. `corepack pnpm dev`, đăng nhập admin.
2. `/admin/categories` → tạo "Lập trình", "Thiết kế".
3. `/admin/courses` → "Tạo khóa học" → nhập tiêu đề "Lập trình JavaScript", slug preview hiện `lap-trinh-javascript` ngay khi gõ, chọn `level = BEGINNER`, giá `499000`, category "Lập trình". Lưu → trạng thái `DRAFT`.
4. Mở `/courses` ở cửa sổ ẩn danh → **không thấy** khóa học vừa tạo.
5. Quay lại `/admin/courses/[id]` → thêm 2 `Section`, mỗi section 3 `Lesson`, bật `isPreview` cho lesson đầu tiên.
6. Bấm `ChevronUp` trên lesson thứ ba → nó lên vị trí 2. Tải lại trang, thứ tự giữ nguyên.
7. Upload ảnh bìa. File xuất hiện trong `STORAGE_LOCAL_DIR` dưới `public/courses/{id}/cover/…` và **hiển thị được** trong form qua `GET /media/local/{key}` — URL **không có** `exp`/`sig` vì key nằm dưới prefix `public/`.
8. Tạo một `VideoAsset`: dán `demo/c1-s1-l1` làm `externalId`, gắn vào lesson 1. `GET /admin/videos/{id}` trả `status = READY` ngay.
9. Đính kèm một PDF vào lesson 1 qua "Thêm tài liệu" → hàng `LessonResource` xuất hiện trong danh sách tài liệu của bài.
10. Bấm "Xuất bản" khi chưa nhập mô tả → `PublishChecklist` tô đỏ đúng mục thiếu theo `issues[]` server trả về. Nhập đủ rồi xuất bản → `PUBLISHED`. Ô slug chuyển sang chỉ đọc.
11. `/admin` → dashboard hiện ba ô `StatTile` (khóa `DRAFT`, video chưa `READY`, học viên mới); hai ô doanh thu **không xuất hiện** vì `NEXT_PUBLIC_CHECKOUT_ENABLED=false`, lưới co còn 3 cột.
12. Ở cửa sổ ẩn danh: `/` → gõ "lap trinh" không dấu vào ô tìm kiếm → khóa học hiện ra. Lọc `level=BEGINNER` → vẫn còn; lọc `level=ADVANCED` → hiện `EmptyState` "Không tìm thấy khóa học phù hợp".
13. Mở course card → trang chi tiết. Card của khóa seed có cụm sao kèm `Badge` "Dữ liệu demo"; card của khóa vừa tạo tay không có sao nhưng **ô đó vẫn chiếm sẵn chiều cao**, lưới không lệch. Mở accordion bằng `Tab` + `Enter`.
14. Bấm một bài "Học thử" khi **chưa đăng nhập** → bị đẩy sang `/login?next=…`. Đăng nhập bằng `student3@elearning.local` (chưa mua khóa nào) rồi bấm lại → xem được bài học thử.
15. Bấm bài không phải học thử → `LessonRow` ở trạng thái `locked`, và `EnrollCta` hiện "Liên hệ để đăng ký" dẫn sang `/contact?course=[slug]` — link mở được vì `/contact` đã có từ Phase 1.
16. Lặp lại bước 12–15 ở 375px.

### Acceptance

| # | Kiểm tra | Kết quả bắt buộc |
|---|---|---|
| A2.1 | `curl.exe -s "http://localhost:3001/api/v1/courses?q=lap%20trinh"` | trả về khóa học có tiêu đề dấu đầy đủ |
| A2.2 | `curl.exe -s http://localhost:3001/api/v1/courses/<slug-da-publish>` | `200`, có mảng `sections[].lessons[]` |
| A2.3 | Body của A2.2 | mỗi lesson có `isPreview`, `durationSeconds`; `enrollmentCount` là số (bằng `0` ở phase này); có `ratingAverage`, `ratingCount`, `demoStats` |
| A2.4 | `psql $env:DATABASE_URL -c "select lesson_count, total_duration_seconds from courses"` | khớp với số lesson và tổng thời lượng thật |
| A2.5 | Bấm reorder rồi `psql ... "select position from lessons where section_id=... order by position"` | dãy liên tục `1..n`, không trùng |
| A2.6 | `POST /admin/courses/{id}/publish` trên course thiếu ảnh bìa | `422 COURSE_NOT_PUBLISHABLE`, `details.issues[]` có `{ field: "coverImageKey", reason: "MISSING" }` |
| A2.7 | Xem `/courses/[slug]` ở 375/768/1024/1440 | không tràn ngang; grid card 1/2/3/4 cột; ảnh bìa tải được qua `GET /media/local/{key}` **không cần chữ ký** |
| A2.8 | `GET /courses?pageSize=200` | body có `{ items, page, pageSize, total, totalPages }` với `pageSize` = `100` |
| A2.9 | `GET /admin/courses` bằng cookie admin khi có 1 course `DRAFT` | course `DRAFT` nằm trong `items` |
| A2.10 | `GET /admin/courses/{id}` của course `DRAFT` | có `sections[].lessons[]` và `videoAssets[]`; **không** có `content`, không có `resources` — xem trước nội dung đi bằng `/learn/*` |
| A2.11 | `GET /admin/reports/overview` bằng cookie admin | `200` với đủ 8 khoá + `series[]`; `draftCourses` khớp số khóa `DRAFT` thật |
| A2.12 | `POST /admin/videos` với `VIDEO_DRIVER=demo` rồi `GET /admin/videos/{id}` | `status` = `READY` ngay, không cần thao tác thứ hai |
| A2.13 | `POST /admin/lessons/{id}/resources` rồi mở trang bài học admin | lesson đó có mảng `resources` 1 phần tử |
| A2.14 | Publish course rồi `PATCH /admin/courses/{id}` đổi `slug` | `409 SLUG_TAKEN` hoặc `409 CONFLICT`, slug không đổi |
| A2.15 | `POST /admin/courses/{id}/unpublish` trên course `ARCHIVED` | `200`, `status` = `DRAFT`, `archivedAt` = `NULL`, `publishedAt` **không đổi** |
| N2.1 | `curl.exe -s -o NUL -w "%{http_code}" http://localhost:3001/api/v1/courses/<slug-draft>` | `404` |
| N2.2 | `GET /courses` khi có course `ARCHIVED` (C6 của seed) | course đó không nằm trong kết quả |
| N2.3 | `POST /admin/courses` bằng cookie STUDENT | `404 NOT_FOUND`, body giống hệt một đường dẫn không tồn tại |
| N2.4 | `POST /admin/courses` không kèm cookie | `404 NOT_FOUND`, body giống hệt N2.3 |
| N2.5 | `GET /courses/{slug}` bởi khách, đọc lesson không `isPreview` | field `content` và `videoAssetId` **không** có trong response |
| N2.6 | Tạo hai course cùng `slug` | `409 SLUG_TAKEN` |
| N2.7 | Đặt `priceVnd = -1` | `400` từ validation; và `psql ... "insert into courses(...) values(..., -1, ...)"` bị `CHECK` constraint viết tay chặn ở tầng DB |
| N2.8 | Nhập lần lượt `<img src=x onerror=alert(1)>`, `[x](javascript:alert(1))`, `<svg onload=alert(1)>`, `<iframe src=…>` vào mô tả rồi xem trang chi tiết | không chuỗi nào còn trong HTML render; thẻ `<a>` còn lại chỉ có `href` `http`/`https`/`mailto` |
| N2.9 | `GET /admin/courses` bằng cookie STUDENT | `404 NOT_FOUND` |
| N2.10 | `GET /media/local/{key}` với key `../../apps/api/.env` đã ký hợp lệ | `403 SIGNATURE_INVALID`, không trả nội dung file |
| N2.11 | Đặt `STORAGE_DRIVER=r2`, gọi `GET /media/local/{key}` | `404` — controller không được đăng ký |
| N2.12 | `POST /admin/courses/{id}/publish` cho course có lesson trỏ `VideoAsset` `status=PENDING` | `422`, `issues[]` có `{ lessonId, field: "videoAsset", reason: "NOT_READY" }` |
| N2.13 | `POST /admin/courses/{id}/publish` cho course `priceVnd = 0` | `422`, `issues[]` có `{ field: "priceVnd", reason: "MISSING" }` — không có khóa `PUBLISHED` nào giá 0 |
| N2.14 | `PUT /media/local/public/x.svg` với chữ ký hợp lệ nhưng key không khớp template ảnh bìa | `403 SIGNATURE_INVALID` — đường ghi không có ngoại lệ nào cho `public/` |

## 7. Phase 3 — Trải nghiệm học

**Ước lượng: L.**

Đây là phase làm cho việc đảo thứ tự có ý nghĩa: sau phase này sản phẩm đã dùng được đầu-cuối mà chưa có một dòng code thanh toán nào.

### Scope

- Model `Enrollment` với `source ∈ {PURCHASE, MANUAL_GRANT}` — cả hai giá trị khai đủ ngay ở migration này để tránh một `ALTER TYPE` ở migration sau; phase này chỉ sinh `MANUAL_GRANT`.
- Admin cấp và thu hồi quyền học qua đúng một hàm `EnrollmentService.grant()`/`.revoke()` (chữ ký ở DEMO_MODE.md §5), mọi thao tác ghi `AuditLog`.
- Quản lý người dùng: tìm, xem, khoá và mở khoá. PROJECT_PLAN.md dòng 181–182 yêu cầu, `UserStatus { ACTIVE, BLOCKED }` **đã có sẵn trong cây mã** mà chưa chỗ nào dùng, và bước 1 của demo script bảo admin "chọn học viên" — không có endpoint tìm user thì không chọn được ai. Đăng nhập bằng tài khoản `BLOCKED` trả **`401 INVALID_CREDENTIALS`**, cùng mã và cùng câu với sai mật khẩu (API_CONTRACT.md §6.3 — mã riêng là một oracle nói cho người dò biết email nào tồn tại và đang bị khoá); khoá tài khoản thu hồi toàn bộ session đang mở, đúng như PROJECT_PLAN.md dòng 293.
- `/my-courses`: danh sách enrollment đang `ACTIVE` kèm tiến độ theo số bài, hai tab "Đang học" / "Đã xong".
- Trình học: sidebar curriculum, nội dung Markdown, video player.
- Playback token: `POST /lessons/{id}/playback-token`, **tám bước** kiểm tra ở API_CONTRACT.md §6.1 (session bắt buộc kể cả bài preview; nhánh `ADMIN`; `videoAssetId == null → 404`; `await` trước `getStatus`). Driver demo trả một URL **đã ký, có hạn thật** trên chính route media dùng chung `/api/v1/media/local/{key}`, không phải một URL file tĩnh trần (PLAN_SUPPLEMENT.md §6 rủi ro 3) — chỉ như vậy N3.3 mới chạy được. TTL `PLAYBACK_TOKEN_TTL_SECONDS`.
- Lưu vị trí xem: `PUT /lessons/{id}/progress`, gọi mỗi 15 giây khi đang phát, trên `pause`, `ended` và `visibilitychange → hidden`; gộp để không quá 1 request / 5 giây. **Không bao giờ** trên `timeupdate`. Không thư viện, không websocket.
- Đánh dấu hoàn thành thủ công + tự động khi `video.currentTime >= 0.95 * video.duration`, đọc `video.duration` của phần tử `<video>` đang phát chứ không đọc `VideoAsset.durationSeconds`.
- "Tiếp tục học": `/learn/[courseSlug]` redirect sang lesson dở dang gần nhất, dùng `resumeLessonId` mà `GET /learn/{courseSlug}` đã trả sẵn — không có endpoint `/resume` riêng.
- `enrollmentCount` trong DTO catalog chuyển từ `0` sang bộ đếm thật, tăng/giảm trong cùng transaction với việc `Enrollment` chuyển vào hoặc rời khỏi `ACTIVE`.

### File và module

| Nơi | Thêm mới | Sửa |
|---|---|---|
| `apps/api` | `src/enrollment/enrollment.module.ts`, `enrollment.service.ts` (`grant`, `revoke`, `hasAccess`), `admin-enrollment.controller.ts`; `src/learning/learning.module.ts`, `learning.controller.ts`, `progress.service.ts`; `src/media/playback.controller.ts`; `src/audit/audit.service.ts` + `actions.ts`; `src/admin/admin-user.controller.ts`, `src/audit/admin-audit.controller.ts` | `src/catalog/catalog.service.ts` (`enrollmentCount` thật), `src/media/local-stream.client.ts` (`signPlayback` ký URL trên route media dùng chung) |
| `apps/web` | Bảy trang theo cây route UX_PLAN.md §2.2: `(learner)/my-courses/page.tsx`, `(player)/learn/[courseSlug]/page.tsx`, `(player)/learn/[courseSlug]/[lessonId]/page.tsx`, `(admin)/admin/users/page.tsx`, `admin/users/[id]/page.tsx`, `admin/enrollments/page.tsx`, `admin/audit-logs/page.tsx`; cộng `VideoPlayer`, `CurriculumAccordion` biến thể `player`, `ProgressBar`, `CompleteToggle`, `LessonNav`, `ResourceList`, `CourseProgressCard`, `ManualGrantDialog`, `RevokeDialog`, `BlockUserDialog` | `CourseCard` (badge "Đã đăng ký" qua island `EnrolledBadge`), `(admin)/admin/page.tsx` |

**Route API thêm (13).** Đường dẫn và DTO ở [API_CONTRACT.md](./API_CONTRACT.md) §5.4 (enrollment), §5.5 (learning), §5.6 (`GET /lessons/{lessonId}/resources/{resourceId}/download`, `POST /lessons/{lessonId}/playback-token`), §5.7 (`GET /admin/audit-logs`) và §5.1 (`GET|PATCH /admin/users*`). Roadmap này **không** khai lại tên route: bản đầu khai `GET /me/courses`, `POST /lessons/:id/progress`, `POST /lessons/:id/complete`, `GET /lessons/:id/playback`, `GET /media/demo/:token`, `GET /admin/audit`, `POST /admin/users/:id/block` — bảy tên không tồn tại trong hợp đồng, và `/media/demo/:token` là một route không có ở bất kỳ tài liệu nào (driver video demo ký URL trên chính `/media/local/{key}`).

Hai điểm về nhóm này là quyết định phạm vi phase:

- Khoá/mở khoá tài khoản là **`PATCH /admin/users/{id}`** với body `{ status }`, không phải hai route `block`/`unblock`. Một endpoint, một `AuditLog` với hai `action` khác nhau tuỳ giá trị.
- `GET /learn/{courseSlug}` và `GET /lessons/{lessonId}/content` đi qua **cùng một** hàm kiểm tra quyền; đó là điều kiện để N3.10 không phải một kiểm tra riêng lẻ dễ quên. Cả hai đều có nhánh bypass cho `ADMIN`, và lượt xem của admin không sinh `LessonProgress`, không chạm `enrollmentCount` (API_CONTRACT.md §5.5).

### Migration

`add_learning` — `Enrollment`, `LessonProgress`, `AuditLog` cùng hai enum `EnrollmentStatus`, `EnrollmentSource`.

**Tên model, tên field, tên và giá trị enum, index, cascade: đọc ở [DATA_MODEL.md](./DATA_MODEL.md) §Prisma schema đầy đủ.** Bản đầu của roadmap này khai `EnrollmentSource { MANUAL, PURCHASE }`; giá trị chốt là **`MANUAL_GRANT`**, và một chữ lệch ở đây là một `ALTER TYPE` về sau. Cột `enrollments.purchase_id` **chưa** có ở migration này — nó là field duy nhất đến muộn, thêm ở `add_payment`.

`EnrollmentStatus`: `ACTIVE ⇄ REVOKED` cả hai chiều — thu hồi rồi cấp lại thì **tái kích hoạt bản ghi cũ**, không tạo hàng thứ hai (unique `(userId, courseId)` cấm). Nhánh `update` ghi cột nào thì bảng chuyển trạng thái ở DATA_MODEL.md §Enrollment nói rõ; đặc biệt `grantedAt` **không bao giờ** bị ghi lại và cấp lại **không** tăng `enrollmentCount` hai lần.

Ba chi tiết của `AuditLog` phải viết đúng, cả ba đều làm code chạy sai nếu viết theo trực giác:

- Kiểu là `Json? @db.JsonB`. `Jsonb` viết hoa fail `P1012` ("Type "Jsonb" is neither a built-in type…") — đó là thứ bản đầu của roadmap này cảnh báo, nhưng nó kết luận sai rằng phải bỏ `@db.JsonB`. `Json? @db.JsonB` là **hợp lệ** và là dạng DATA_MODEL.md dùng.
- Cột `action` là `VarChar(64)`, không phải `VarChar(48)`.
- `actorId` **nullable**. Phase 4 ghi `AuditLog` từ những đường không có người thật: callback ZaloPay và tác vụ reconcile đều gọi `confirmPayment`, và N4.2 bắt buộc ghi cảnh báo từ chính callback. FK `NOT NULL` trỏ `User` làm những lệnh ghi đó ném lỗi và kéo cả callback fail. `null` nghĩa là hệ thống.

**Từ vựng `AuditLog.action` và `entityType` — bảng hợp nhất duy nhất nằm ở [DATA_MODEL.md](./DATA_MODEL.md) §AuditLog**, hằng số ở `apps/api/src/audit/actions.ts`. Bản đầu của roadmap này khai 8 giá trị `SCREAMING_SNAKE` (`ENROLLMENT_GRANTED`, `PAYMENT_BAD_SIGNATURE`, …) trong khi hai tài liệu kia dùng `{entity}.{verb_past}` (`enrollment.granted`) — ba danh sách đóng khác nhau, mỗi nơi tự nhận là danh sách đóng. Quy tắc chốt: `{entity}.{verb_past}` cho `action`, SCREAMING cho `entityType` (nó là giá trị lọc trên query string). Danh sách phải đóng ngay từ khi cột ra đời, nếu không `/admin/audit-logs` sẽ có bộ lọc trên một tập giá trị không ai biết.

### Test bắt buộc

| File | Nội dung |
|---|---|
| `src/enrollment/enrollment.service.spec.ts` | cấp trùng không tạo bản ghi thứ hai; thu hồi rồi cấp lại thì tái kích hoạt bản ghi cũ; mọi lần đều ghi `AuditLog` |
| `src/media/playback-token.spec.ts` | token hết hạn bị từ chối; token của user A không dùng được cho user B; token của lesson X không dùng được cho lesson Y; sửa một byte trong chữ ký → từ chối |
| `src/learning/progress.service.spec.ts` | `lastPositionSeconds` không lùi về nhỏ hơn giá trị đã lưu; `completed: true` thì set `completedAt`; `completedAt` đã có thì không bị ghi đè. Ngưỡng 95% tính ở **client** trên `video.duration` của thẻ `<video>` đang phát (spec hàm thuần ở `apps/web`), rồi client gửi `completed: true` — server không tự hoàn thành theo `Lesson.durationSeconds` vì thời lượng seed là số giả |
| `src/enrollment/enrollment.service.spec.ts` (mở rộng) | `hasAccess()` trả `true` cho course `ARCHIVED` khi enrollment còn `ACTIVE` |
| `test/learning.e2e-spec.ts` | Fixture là seed thật: `student3@elearning.local` chưa mua, `student1@elearning.local` đã có quyền học C1 `lap-trinh-web-voi-react-va-nextjs`, C6 `lap-trinh-di-dong-voi-react-native` là khóa `ARCHIVED`. Ma trận: user chưa enroll `403 NOT_ENROLLED` ở `playback-token`; user đã enroll `200`; sau khi revoke thì `403`; bài `isPreview` của khóa `PUBLISHED` → **`401` cho khách chưa đăng nhập**, **`200` cho người đã đăng nhập chưa mua**; bài `isPreview` của khóa `DRAFT` → `404`; admin không có `Enrollment` → `200`; bài `ARTICLE` → `404`; `GET /lessons/{id}/content` cho user chưa enroll `403` và body không có `content`; đăng nhập bằng tài khoản `BLOCKED` → `401 INVALID_CREDENTIALS` |

### Demo script

1. Đăng nhập admin → `/admin/users` → gõ `student3` vào ô tìm → thấy đúng một dòng. Sang `/admin/enrollments` → chọn `student3@elearning.local` và khóa C4 `thiet-ke-giao-dien-voi-figma` → "Cấp quyền học".
2. `/admin/audit-logs` → thấy một dòng `enrollment.granted` kèm actor và thời điểm. Lọc theo action → chỉ còn dòng đó.
3. Đăng xuất, đăng nhập bằng `student3@elearning.local` / `Demo!Student123`.
4. `/my-courses` → khóa học xuất hiện, tiến độ `0/12 bài`.
5. Bấm "Bắt đầu học" → vào `/learn/[courseSlug]/[lessonId]` của bài đầu tiên.
6. Video demo phát được. Tua tới giữa bài, chờ 15 giây, tải lại trang → vị trí xem được giữ nguyên.
7. Bấm "Đánh dấu hoàn thành" → sidebar tick bài đó, thanh tiến độ lên `1/12`.
8. Sang bài 2, xem qua 95% thời lượng → bài tự chuyển thành hoàn thành.
9. Tải tài liệu PDF đính kèm → file tải về được, header có `Content-Disposition: attachment`.
10. Đóng tab, mở lại `/learn/[courseSlug]` → nhảy thẳng vào bài dở dang gần nhất.
11. Mở `/courses/thiet-ke-giao-dien-voi-figma` ở cửa sổ ẩn danh → `enrollmentCount` hiển thị `1`.
12. Copy `playbackUrl` ở bước 6 — nó là một URL trên `/api/v1/media/local/…` có `exp` và `sig` — dán vào cửa sổ ẩn danh sau khi hết TTL → `403 SIGNATURE_INVALID`.
13. Admin thu hồi quyền → học viên tải lại trang học → bị đẩy về `/courses/[slug]?denied=1` kèm `Alert` "Bạn chưa có quyền học khóa này."
14. Admin archive khóa đó rồi cấp lại quyền → học viên vẫn vào `/learn/[courseSlug]` học bình thường kèm `Alert` info "Khóa học này đã ngừng nhận học viên mới", nhưng `/courses` ở cửa sổ ẩn danh không còn khóa đó.
15. Admin `/admin/users/[id]` → "Khóa tài khoản" → học viên tải lại bất kỳ trang nào → bị đăng xuất; đăng nhập lại → `Alert` "Email hoặc mật khẩu không đúng." — **đúng câu của sai mật khẩu**, không có câu "Tài khoản đã bị khóa" (N3.14, API_CONTRACT.md §6.3: câu riêng là một oracle trạng thái tài khoản). `/admin/audit-logs` có dòng `user.blocked`. Mở khóa lại.
16. Đăng nhập admin, mở `/learn/kien-truc-backend-voi-nestjs` (khóa C5 `DRAFT`) → vào được nhờ nhánh bypass theo vai trò, header hiện banner "Bạn đang xem trước với quyền quản trị. Tiến độ học không được ghi lại." `psql` xác nhận **không** có hàng `lesson_progress` nào mới.
17. Đi hết trình học chỉ bằng bàn phím ở 375px và 1440px.

### Acceptance

| # | Kiểm tra | Kết quả bắt buộc |
|---|---|---|
| A3.1 | `POST /admin/enrollments` với cookie admin | `201`, `source` = `MANUAL_GRANT` |
| A3.2 | `psql $env:DATABASE_URL -c "select count(*) from audit_logs where action='enrollment.granted'"` | tăng đúng 1 sau A3.1 |
| A3.3 | `GET /enrollments/me` bằng cookie học viên | `Paginated<EnrollmentItem>`, `items[0].progress` có `completedLessons`/`totalLessons`/`percent` và `resumeLessonId` |
| A3.4 | `POST /lessons/{id}/playback-token` bằng cookie học viên đã enroll | `200`, body đúng `{ playbackUrl, kind, expiresAt }` và **không gì khác** |
| A3.5 | Gọi `playbackUrl` ở A3.4 trong TTL | `200`, `Content-Type` là `video/mp4`; URL có tham số `exp` và `sig` |
| A3.6 | `PUT /lessons/{id}/progress` với `lastPositionSeconds=120`, rồi `GET /learn/{courseSlug}` | vị trí đã lưu là `120` |
| A3.7 | Xem quá 95% thời lượng (`COMPLETE_THRESHOLD`) | `psql ... "select completed_at from lesson_progress ..."` khác `NULL` |
| A3.8 | `GET /courses/{slug}` sau khi có 1 enrollment `ACTIVE` | `enrollmentCount` = `1` |
| A3.9 | `POST /admin/enrollments` lần hai cho cùng cặp user/course | `200`, `psql ... "select count(*) from enrollments where user_id=... and course_id=..."` vẫn `1`, và `enrollment_count` của khóa **không** tăng lần hai |
| A3.10 | `GET /admin/users?q=<một phần email>` bằng cookie admin | `Paginated<AdminUserRow>`, `items` chứa đúng user đó, **không** có `passwordHash` |
| A3.11 | `PATCH /admin/users/{id}` với `status = BLOCKED` | `200`; `psql ... "select status from users where id=..."` = `BLOCKED`; mọi session của user đó có `revoked_at` khác `NULL`; `audit_logs` có `user.blocked` |
| A3.12 | `GET /learn/{courseSlug}` của course `ARCHIVED` bằng cookie đã enroll `ACTIVE` | `200`, học bình thường |
| A3.13 | `GET /admin/audit-logs?action=enrollment.granted&pageSize=200` | chỉ action đó, `pageSize` = `100`, sort `createdAt desc` |
| A3.14 | Admin không có `Enrollment` gọi `GET /learn/{courseSlug}` và `POST /lessons/{id}/playback-token` trên khóa `DRAFT` | `200` cả hai; `progress` = `null`, `resources` = `[]`; **không** hàng `lesson_progress` mới, `enrollment_count` không đổi |
| N3.1 | `POST /lessons/{id}/playback-token` bằng cookie user chưa enroll, bài không phải học thử | `403 NOT_ENROLLED` |
| N3.2 | Lệnh trên khi chưa đăng nhập | `401` |
| N3.3 | Gọi `playbackUrl` sau `PLAYBACK_TOKEN_TTL_SECONDS` | `403 SIGNATURE_INVALID` |
| N3.4 | User B dùng `playbackUrl` của user A | `403` |
| N3.5 | Sau `DELETE /admin/enrollments/{id}`, học viên gọi `GET /learn/{courseSlug}` | `403 NOT_ENROLLED` |
| N3.6 | `GET /lessons/{id}/resources/{rid}/download` bởi user chưa enroll | `403 NOT_ENROLLED` |
| N3.7 | `PUT /lessons/{id}/progress` cho lesson thuộc khóa chưa enroll | `403`, không có hàng nào được tạo trong `lesson_progress` |
| N3.8 | `POST /admin/enrollments` bằng cookie STUDENT | `404 NOT_FOUND`, body giống hệt một đường dẫn không tồn tại |
| N3.9 | `GET /admin/audit-logs` bằng cookie STUDENT | `404 NOT_FOUND` |
| N3.10 | `GET /lessons/{lessonId}/content` bằng cookie user chưa enroll, bài không phải học thử | `403`, body **không** chứa `content` — bài chỉ có Markdown và không có video vẫn phải bị chặn, N2.5 nằm ở controller catalog nên không phủ route này |
| N3.11 | Lệnh trên sau `DELETE /admin/enrollments/{id}` | `403` |
| N3.12 | Đọc `playbackUrl` mà driver demo trả về | Là URL trên `/api/v1/media/local/{key}` **có `exp` và `sig`**, không phải một URL file tĩnh trần trong `apps/web/public` — nếu không thì N3.3 không kiểm được gì |
| N3.13 | `POST /lessons/{id}/playback-token` cho bài `ARTICLE` bằng cookie đã enroll | `404 NOT_FOUND`, không phải `500` |
| N3.14 | `POST /auth/login` bằng tài khoản `BLOCKED` | `401`, `code` = `INVALID_CREDENTIALS` — **giống hệt** sai mật khẩu, không có mã riêng; `select count(*) from sessions where user_id=...` không tăng |
| N3.15 | Cookie session cũ của user vừa bị block, gọi `/auth/me` | `401` |
| N3.16 | `PATCH /admin/users/{id}` bằng cookie STUDENT | `404 NOT_FOUND` |
| N3.17 | Admin `PATCH /admin/users/{id}` với `status = BLOCKED` trên **chính tài khoản mình** | `409 SELF_ACTION_FORBIDDEN`, trạng thái không đổi |

## 8. Phase 4 — Thanh toán

**Ước lượng: L.** Ít màn hình nhưng nhiều bất biến phải đúng tuyệt đối.

Điều kiện tiên quyết ngoài code: sandbox credentials ZaloPay đã có (thủ tục bắt đầu từ Phase 1). Nếu chưa có, vẫn làm hết phase bằng `PAYMENT_DRIVER=demo` và chỉ hoãn A4.9.

Luồng, bất biến và các yêu cầu bảo mật đã được đặc tả trong PROJECT_PLAN.md mục "Thiết kế thanh toán ZaloPay". Phase này chỉ bổ sung phần liên quan tới seam demo.

### Scope

- `Purchase` và `PaymentAttempt`; thêm cột `Enrollment.purchaseId` (nullable, unique, FK `Restrict`).
- **Một hàm `confirmPayment` duy nhất**, gọi bởi cả ba đường: callback ZaloPay, `POST /dev/payments/{appTransId}/confirm`, và tác vụ reconcile. Không có đường cấp `Enrollment` thứ hai.
- `confirmPayment` chạy trong một `$transaction` mở đầu bằng **ghi có điều kiện**: `updateMany({ where: { appTransId, status: 'PENDING' } })`, `count === 0` thì dừng và trả `200`. Unique **không** phải cơ chế idempotency — ghi lại cùng `providerTransId` lên chính hàng đang giữ nó không vi phạm unique (DATA_MODEL.md §PaymentAttempt). Rồi mới `Purchase` → `enrollmentService.grant({ source: 'PURCHASE' })` → `enrollmentCount` → `AuditLog purchase.paid`. Không giữ transaction mở trong lúc gọi mạng.
- Driver `demo`: `CheckoutService` sinh `appTransId` đúng định dạng `yymmdd_{seq}` theo giờ Việt Nam (**không** dùng `toISOString()` — server chạy UTC và từ 00:00 tới 07:00 giờ VN tiền tố ngày sẽ sai), `DemoZaloPayClient` giữ một `Map` riêng và **không** đọc `PaymentAttempt`; nút xác nhận gọi `POST /dev/payments/{appTransId}/confirm`.
- Reconcile: **một** vòng `setInterval` khởi động trong `OnModuleInit`, huỷ trong `OnModuleDestroy`, `RECONCILE_INTERVAL=60` giây, bỏ qua attempt trẻ hơn `RECONCILE_MIN_AGE=120` giây. Đối soát trước, đóng attempt quá hạn sau, trong cùng một lượt. Không thêm `@nestjs/schedule`, không chuỗi cron.
- Thanh toán đến muộn: callback đúng MAC và đúng số tiền cho attempt đã `EXPIRED` vẫn được xác nhận (`EXPIRED → SUCCEEDED`, ghi `payment.reconciled` với `metadata.late = true`) vì tiền đã thu thì phải có quyền học; attempt `FAILED`/`CANCELLED` thì không, và một đơn đã `CANCELLED`/`REFUNDED` bị từ chối kèm `payment.callback_rejected`.
- Trang checkout `/checkout/[courseSlug]` polling `GET /purchases/{id}`; không bao giờ tự kết luận thành công từ redirect. Client tự so `attempts[0].expiresAt` với đồng hồ của mình để chuyển `QrPanel` sang `expired` — **không** đợi server đổi `status`, vì `GET /purchases/{id}` đọc trạng thái đã lưu chứ không tính lại tại chỗ.
- Lịch sử mua của học viên (`/account/orders`, `/account/orders/[id]`); màn hình đối soát và hoàn tiền của admin (`/admin/orders`).
- Email xác nhận mua hàng gửi sau khi transaction commit, qua mail seam (`tag: 'purchase-receipt'`).
- Bật `NEXT_PUBLIC_CHECKOUT_ENABLED=true`: `EnrollCta` đổi từ "Liên hệ để đăng ký" sang "Đăng ký học · {giá}", và hai `StatTile` doanh thu ở `/admin` hiện ra. Cùng component, không dựng gì mới.
- Luồng hoàn tiền: `POST /purchases/{id}/refund-request` của học viên đặt `status = REFUND_REQUESTED`; admin duyệt (`→ REFUNDED`) hoặc từ chối (`→ PAID`). Lý do đi vào `AuditLog.metadata`, **không** có cột `refundReason`.

### Màn hình checkout — máy trạng thái đầy đủ

Đây là màn hình duy nhất dính tới tiền của người dùng, nên nó không được đặc tả bằng một câu. `PaymentStatus` poll `GET /purchases/{id}` mỗi `CHECKOUT_POLL_INTERVAL` (3s, giãn dần lên 10s sau 1 phút), **dừng** khi trạng thái là terminal hoặc khi quá `expiresAt`. Không websocket, không SSE, không `react-query`.

Trạng thái dưới đây là `PaymentAttempt.status` của attempt mới nhất, trừ hàng `PAID` đọc `Purchase.status`. Tên giá trị chốt ở DATA_MODEL.md — `SUCCEEDED` chứ không phải `PAID` cho attempt, `CANCELLED` **hai chữ `L`** chứ không phải `CANCELED`; bản đầu của roadmap này viết một chữ `L` và làm bảng ánh xạ `return_code` ở DEMO_MODE.md §5 trỏ vào một giá trị enum không tồn tại.

| Trạng thái | UI | Việc tiếp theo |
|---|---|---|
| `PENDING`, còn hạn | QR + đồng hồ đếm ngược tới `expiresAt` + "Đang chờ thanh toán" | polling tiếp |
| `PENDING`, quá `expiresAt` theo đồng hồ client | QR mờ đi + "Mã QR đã hết hạn" + nút **"Tạo mã QR mới"** | nút gọi lại `POST /checkout/{courseSlug}` → attempt mới, `appTransId` khác. Client **không** đợi server đổi `status` |
| `Purchase.status = PAID` | `PaymentResult` `success`: "Bạn đã có quyền học khóa này." | dừng poll, CTA "Vào học ngay" |
| `EXPIRED` | như `PENDING` quá hạn | nút tạo lại |
| `FAILED` | "Thanh toán không thành công" + nút "Thử lại" | nút gọi lại `POST /checkout/{courseSlug}` |
| `CANCELLED` | "Giao dịch đã bị hủy" + nút "Thử lại" | như trên |
| Poll lỗi 3 lần liên tiếp | trạng thái `unknown`: "Chưa xác nhận được trạng thái. Bấm để kiểm tra lại." | **tuyệt đối không** tự tuyên bố thành công |

Đồng hồ đếm về `0` **không** tự tạo QR mới — nó chuyển sang trạng thái hết hạn và chờ người dùng bấm. Tự tạo QR mới khi tab đang mở nền là cách sinh ra một dãy `PaymentAttempt` rác.

### Hoàn tiền

Phase 4 hoàn tiền là **ghi sổ thuần**: không gọi Refund API của ZaloPay, tiền chuyển tay ngoài hệ thống. Lý do: một chủ sở hữu với vài giao dịch hoàn tiền mỗi tháng xử lý bằng app ngân hàng nhanh hơn là xây và kiểm thử một luồng refund có callback riêng. `ponytail:` comment ở `admin-purchase.controller.ts` ghi trần này và đường nâng cấp là gọi ZaloPay Refund API khi số lần hoàn tiền đủ nhiều để thao tác tay thành phiền.

- `reason` **bắt buộc** ở cả hai đường (học viên gửi yêu cầu, admin duyệt/từ chối/hoàn), vào thẳng `AuditLog.metadata`. **Không** có cột `refundReason` trên `Purchase`.
- Không hoàn một phần. `Purchase.status → REFUNDED`, `Enrollment.status → REVOKED`, `enrollmentCount −1` — cùng một transaction.
- `LessonProgress` **giữ nguyên**: nếu người đó mua lại sau này thì tiến độ còn đó, và xoá dữ liệu học chẳng thu hồi được gì.
- Mua lại sau khi hoàn tiền chèn một hàng `Purchase` **mới**, không đặt lại hàng cũ về `PENDING` — unique một phần chỉ tính `PENDING|PAID|REFUND_REQUESTED` nên nó cho phép điều đó.

**"Danh sách cần xử lý hoàn tiền"** mà PROJECT_PLAN.md dòng 251 bắt buộc thì có chỗ ở, nhưng **không phải một cột mới**: giao dịch thừa tự nhận diện được bằng truy vấn "`Purchase` có nhiều hơn một attempt `SUCCEEDED`". Chốt: `GET /admin/payments?duplicatePaid=true` (API_CONTRACT.md §5.8) cộng một `AuditLog payment.duplicate_paid` ghi khi `confirmPayment` gặp attempt `SUCCEEDED` thứ hai của cùng `Purchase`. Bản đầu của roadmap này chốt một cột `PaymentAttempt.needsRefund` cộng một index — cột đó không có trong DATA_MODEL.md và là một cột phi chuẩn hoá cho một sự kiện đếm trên đầu ngón tay.

### File và module

| Nơi | Thêm mới | Sửa |
|---|---|---|
| `apps/api` | `src/checkout/checkout.module.ts`, `checkout.controller.ts`, `checkout.service.ts`, `confirm-payment.ts`, `zalopay.client.ts` (seam) + `zalopay-http.client.ts` + `demo-zalopay.client.ts`, `zalopay-callback.controller.ts`, `reconcile.service.ts`, `admin-payment.controller.ts`, `admin-purchase.controller.ts`; `src/dev/dev-payment.controller.ts` | `src/enrollment/enrollment.service.ts` (nhận `source = PURCHASE` + `purchaseId`), `src/mail/*` (template biên nhận), `src/reporting/reporting.controller.ts` (số doanh thu) |
| `apps/web` | `(learner)/checkout/[courseSlug]/page.tsx`, `(learner)/account/orders/page.tsx`, `account/orders/[id]/page.tsx`, `(admin)/admin/orders/page.tsx`; `OrderSummary`, `QrPanel`, `PaymentStatus`, `PaymentResult` | `courses/[slug]` (`EnrollCta` nhánh checkout), `(admin)/admin/page.tsx` (hai `StatTile` doanh thu hiện ra), `.env.example` (`NEXT_PUBLIC_CHECKOUT_ENABLED=true`) |

**Route API thêm (10).** Đường dẫn và DTO ở [API_CONTRACT.md](./API_CONTRACT.md) §5.8 (checkout, purchases, callback, admin payments/refund), §5.9 (`POST /dev/payments/{appTransId}/confirm`, chỉ tồn tại khi có driver demo) và `GET /admin/reports/courses` ở §5.7. Trang web `/checkout/[courseSlug]` không có route API cùng tên: nó gọi `POST /checkout/{courseSlug}` để lấy hoặc tạo attempt, rồi poll `GET /purchases/{id}`. Kiểm tra chủ sở hữu nằm ở `GET /purchases/{id}`, và nó trả **`404`** cho đơn của người khác chứ không `403` (N4.8).

### Migration

`add_payment` — `Purchase`, `PaymentAttempt`, ba enum thanh toán, **và** cột `enrollments.purchase_id` cùng FK + unique của nó.

**Tên model, tên field, tên và giá trị enum, index, cascade: đọc ở [DATA_MODEL.md](./DATA_MODEL.md) §Prisma schema đầy đủ.** Bản đầu của roadmap này khai hai enum riêng và lệch ở ba chỗ: `PurchaseStatus` thiếu `REFUND_REQUESTED` và `CANCELLED`; `PaymentAttemptStatus` viết `PAID` thay vì `SUCCEEDED` và `CANCELED` một chữ `L` thay vì `CANCELLED`; và cột `Enrollment.paymentAttemptId` thay vì `purchaseId`.

- `PurchaseStatus` có **5** giá trị. Chuyển trạng thái đầy đủ, gồm cả `PAID → REFUND_REQUESTED → REFUNDED` và `PAID → REFUND_REQUESTED → PAID`, ở DATA_MODEL.md §Chuyển trạng thái. Một `Purchase` đã `PAID` mà nhận thêm callback vẫn trả `return_code: 1` và không đổi trạng thái.
- `PaymentAttemptStatus`: `PENDING` là trạng thái khởi tạo duy nhất; `PENDING → {SUCCEEDED, FAILED, EXPIRED, CANCELLED}`, cả bốn là terminal. Một `Purchase` có nhiều attempt nhưng **tối đa một** attempt `PENDING` tại một thời điểm.

Ràng buộc chặn trùng đơn là một **unique một phần viết tay** trên `purchases (user_id, course_id) WHERE status IN ('PENDING','PAID','REFUND_REQUESTED')`, không phải `@@unique([userId, courseId])` — nếu dùng unique đầy đủ thì mua lại sau khi hoàn tiền là không thể. Cùng file `migration.sql` còn hai `CHECK` (`purchases.price_vnd >= 0`, `payment_attempts.amount_vnd > 0`); cả ba câu lệnh nguyên văn ở DATA_MODEL.md §SQL viết tay nối vào cuối migration, và D6 kiểm rằng chúng vẫn còn sau replay.

### Test bắt buộc

| File | Nội dung |
|---|---|
| `src/checkout/zalopay-signature.spec.ts` | HMAC `key2` đúng → chấp nhận; sai một ký tự → từ chối; thiếu field → từ chối. Dùng vector cố định, không gọi mạng |
| `test/confirm-payment.e2e-spec.ts` (Postgres thật, gọi `CheckoutService.confirmPayment` trực tiếp; thay cho `src/checkout/confirm-payment.spec.ts` vì thứ cần kiểm là điều kiện ghi của chính Postgres, mà bản mock không chứng minh được) | gọi hai lần cùng `appTransId` → lần hai trả `ALREADY_PROCESSED`, chỉ một `Enrollment`, `paidAt` **không** bị ghi đè, `enrollmentCount` **không** tăng lần hai, và vẫn trả thành công; bốn lời gọi đồng thời → đúng một `PAID`; số tiền lệch so với snapshot → từ chối, không cấp quyền, ghi `payment.callback_rejected`; `appTransId` không tồn tại → từ chối; attempt `FAILED`/`CANCELLED` nhận báo thu tiền → từ chối `attempt_closed` (không được trả "đã xử lý"); attempt `EXPIRED` → vẫn xác nhận, ghi `payment.reconciled` với `late = true`; Purchase `CANCELLED`/`REFUNDED` → từ chối nhưng attempt vẫn `SUCCEEDED`; khóa đã gỡ xuất bản (`DRAFT`) sau khi hiện QR vẫn được cấp quyền; attempt thứ hai của cùng Purchase → `DUPLICATE_PAID` và `payment.duplicate_paid` |
| `src/checkout/app-trans-id.spec.ts` | lúc `2026-09-01T20:00:00Z`, tiền tố ngày là `260902` (giờ Việt Nam) chứ không phải `260901` — ca này chỉ fail khi ai đó thay `Intl.DateTimeFormat` bằng `toISOString()` |
| `src/checkout/checkout.service.spec.ts` | đã có `Enrollment` `ACTIVE` → `409 ALREADY_ENROLLED`, không tạo `PaymentAttempt` mới; còn QR chưa hết hạn → trả lại đúng QR cũ với `200`; hết hạn → tạo attempt mới với `201`; `emailVerifiedAt` null → `403 EMAIL_NOT_VERIFIED` |
| `src/checkout/reconcile.service.spec.ts` | `Map` của `DemoZaloPayClient` đặt `SUCCEEDED` trong khi `PaymentAttempt` vẫn `PENDING` → chạy reconcile → `Enrollment` được cấp (kịch bản "callback bị mất"); attempt quá `expiresAt` được đóng **sau** bước đối soát trong cùng lượt |
| `test/checkout.e2e-spec.ts` | Fixture do test dựng (`createCourse`, người dùng mới): mỗi ca cần một khóa và một học viên sạch. Các nhánh của `POST /checkout/:slug`: tạo đơn và QR; gọi lại → cùng QR với `200`; QR hết hạn → QR mới trên cùng đơn; đổi giá trước QR mới thì đơn chưa trả theo giá mới; bấm đồng thời → một đơn; `401`, chưa xác minh email, `404`, `422 COURSE_NOT_PURCHASABLE`, `409 ALREADY_ENROLLED` (kể cả đơn đã `PAID` mà quyền bị gỡ tay); đơn cũ đã hoàn tiền → đơn mới; giới hạn 5 lần / 300 giây; nhà cung cấp lỗi → giữ đơn, lần sau có QR mới |
| `test/checkout-flow.e2e-spec.ts` | Ca đầu chạy **demo script bước 3–11 trên seed thật** — C2 `typescript-cho-nguoi-da-biet-javascript` (499.000 ₫), `student3@elearning.local`, `admin@elearning.local` — nên seed hỏng demo thì fail ở đây (A4.1–A4.6, A4.11, A4.12). Hai ca sau dùng dữ liệu tạo riêng: đổi giá sau khi có QR → tiền ghi nhận là giá snapshot (A4.7); hai attempt cùng `SUCCEEDED` của một `Purchase` → chỉ một `Enrollment`, một `purchase.paid`, `audit_logs` có `payment.duplicate_paid`, `GET /admin/payments?duplicatePaid=true` trả đúng đơn đó và không trả đơn chỉ thanh toán một lần (N4.10) |
| `test/payment-callback.e2e-spec.ts` | Callback thật qua HTTP, không cần session và CSRF: mở khóa và trả `return_code` `1`; lặp lại hoặc gửi đồng thời → một lần; chữ ký giả hoặc dữ liệu bị sửa sau khi ký → `-1`, không cấp quyền; đúng chữ ký nhưng lệch số tiền → `-1` và ghi lý do; đơn chưa từng phát hành → `-1`; thân không phải đơn hàng, `type` khác đơn hàng; xác nhận lỗi → `0` để nhà cung cấp gọi lại; route chỉ có với đúng nhà cung cấp đang cấu hình (N4.1–N4.3). Luôn trả HTTP `200` |
| `src/web-secrets.spec.ts` | quét `apps/web`: `key2` không xuất hiện trong `src` (N4.11); `ZALOPAY_KEY`, `CF_STREAM_TOKEN`, `R2_SECRET`… không xuất hiện ở bất kỳ file văn bản nào của web (N5.1) |

### Demo script

Chạy với `PAYMENT_DRIVER=demo`.

1. Đăng nhập bằng một học viên **chưa** có quyền học khóa mục tiêu.
2. `/courses/[slug]` → giá hiển thị đúng, nút "Đăng ký học" đã thay cho khối liên hệ.
3. Bấm nút → `/checkout/[slug]` hiện QR giả, trạng thái "Chờ thanh toán", đồng hồ đếm ngược.
4. Mở tab khác, quay lại `/courses/[slug]`, bấm "Đăng ký học" lần nữa → về đúng trang checkout cũ, **cùng một** `paymentAttemptId` (cùng mã QR), không sinh QR mới.
5. Ở một trình duyệt khác đăng nhập admin, mở `/admin/orders`, chọn giao dịch `PENDING` và bấm "Xác nhận thanh toán" (chỉ hiện khi `PAYMENT_DRIVER=demo`; học viên không bấm được — `DEMO_MODE.md` §"Endpoint confirm dev").
6. Trang checkout tự đổi sang "Thành công" nhờ polling, rồi chuyển sang `/learn/[slug]`.
7. Console `api` in email biên nhận.
8. `/my-courses` → khóa học nằm trong danh sách. `/account/orders` → một dòng `PAID`.
9. `/admin/orders` → giao dịch hiện ra; `/admin` có `revenueVnd` bằng `499000`.
10. Xác nhận lại cùng `appTransId` (`POST /dev/payments/{appTransId}/confirm`, cookie admin) → trả `200`, nhưng số enrollment không đổi.
11. `/admin/orders` → hoàn tiền (`POST /admin/purchases/{id}/refund`) → nhập lý do (bắt buộc) → trạng thái `REFUNDED`, `Enrollment` chuyển `REVOKED`, `AuditLog` có `purchase.refunded` kèm lý do, hàng `lesson_progress` vẫn còn nguyên.
12. Với một khóa khác: tạo QR, để `CHECKOUT_QR_TTL_MINUTES` trôi qua (đặt `1` để thử) → trang tự chuyển sang "Mã QR đã hết hạn" và hiện nút "Tạo mã QR mới". Bấm nút → `paymentAttemptId` mới khác cái cũ (admin thấy thêm một `appTransId` mới ở `/admin/orders`).
13. Kiểm tra ở 375px: QR không tràn, nút "Giả lập thanh toán" và "Tạo mã QR mới" ≥ 44px.

### Acceptance

| # | Kiểm tra | Kết quả bắt buộc |
|---|---|---|
| A4.1 | `POST /checkout/:slug` lần đầu | `201`, body có `paymentAttemptId`, `qrCode`, `expiresAt` (`appTransId` là mã phía nhà cung cấp, chỉ admin thấy) |
| A4.2 | `POST /checkout/:slug` lần hai trong TTL | `200` (không phải `201`), `paymentAttemptId` **giống hệt** A4.1; `psql ... "select count(*) from payment_attempts where purchase_id=..."` = `1` |
| A4.3 | `POST /dev/payments/{appTransId}/confirm` (cookie admin) | `200`; `psql ... "select status from purchases where id=..."` = `PAID` |
| A4.4 | Sau A4.3 | `psql ... "select source, purchase_id from enrollments where user_id=... and course_id=..."` → `PURCHASE`, id khác `NULL` |
| A4.5 | Lặp lại A4.3 lần hai | `200`, và `select count(*) from enrollments where user_id=... and course_id=...` vẫn `1` |
| A4.6 | `GET /purchases/me` | 1 dòng, `status` = `PAID`, `priceVnd` = giá đã chụp lúc tạo attempt |
| A4.7 | Đổi `Course.priceVnd` sau khi tạo attempt rồi thanh toán | tiền ghi nhận là giá snapshot, không phải giá mới |
| A4.8 | Dừng api giữa lúc `PENDING`, chạy lại, chờ một chu kỳ reconcile | attempt được truy vấn lại và kết thúc đúng trạng thái |
| A4.9 | Với `PAYMENT_DRIVER=zalopay`, sandbox credentials và `ZALOPAY_CALLBACK_URL` là URL HTTPS công khai (staging Railway, hoặc `cloudflared tunnel --url http://localhost:3001`): chạy bộ test sandbox | callback thật mở khóa đúng một `Enrollment` |
| A4.10 | Để QR hết hạn trên trang checkout | UI chuyển sang "Mã QR đã hết hạn", nút "Tạo mã QR mới" xuất hiện, polling chỉ chậm lại (không dừng) để bắt khoản thanh toán đến muộn; bấm nút → attempt mới có `paymentAttemptId` khác |
| A4.11 | `GET /admin/reports/overview` sau A4.3 | `revenueVnd` bằng `priceVnd` của purchase, `paidPurchases` = `1` |
| A4.12 | Sau `POST /admin/purchases/:id/refund` | `psql ... "select count(*) from lesson_progress where user_id=..."` không đổi |
| N4.1 | `POST /payments/zalopay/callback` với MAC sai | phản hồi từ chối, `select count(*) from enrollments` không đổi |
| N4.2 | Callback có MAC đúng nhưng `amount` lệch snapshot | từ chối, không cấp quyền, ghi `AuditLog` cảnh báo |
| N4.3 | Callback với `appTransId` không tồn tại | từ chối (HTTP `200`, `return_code` `-1`); không tạo `Purchase`, `PaymentAttempt` hay `Enrollment` nào, chỉ ghi một `AuditLog payment.callback_rejected` (`unknown_app_trans_id`) |
| N4.4 | Đặt `PAYMENT_DRIVER=zalopay`, gọi `POST /dev/payments/{appTransId}/confirm` (cookie admin) | `404` — route không được đăng ký |
| N4.5 | `POST /checkout/:slug` khi chưa đăng nhập | `401` |
| N4.6 | `POST /checkout/:slug` khi đã có `Enrollment` `ACTIVE` | `409`, không tạo `PaymentAttempt` |
| N4.7 | `POST /checkout/:slug` cho course `DRAFT` | `404` |
| N4.8 | `GET /purchases/:id` của người khác | `404` (không lộ đơn của người khác) |
| N4.9 | `GET /admin/payments` bằng cookie STUDENT | `404` (mọi route `/admin/*` đáp 404 với người không phải admin) |
| N4.10 | Thanh toán hai `PaymentAttempt` khác nhau của cùng `Purchase` | `select count(*) from enrollments where user_id=... and course_id=...` = `1`; có `AuditLog payment.duplicate_paid` và đơn hiện trong `GET /admin/payments?duplicatePaid=true` |
| N4.11 | `grep -ri "key2" apps/web/src` | không có kết quả |
| N4.12 | `POST /checkout/:slug` cho course `ARCHIVED` (hoặc giá 0) | `422 COURSE_NOT_PURCHASABLE` (khác `404` của `DRAFT`: khóa này có tồn tại, chỉ là ngừng bán) |
| N4.13 | `POST /admin/purchases/:id/refund` không kèm `reason` | `400`, trạng thái không đổi |

## 9. Phase 5 — Hardening và mở bán

**Ước lượng: M.**

### Scope

- Lật toàn bộ seam sang driver thật: `MAIL_DRIVER=smtp`, `STORAGE_DRIVER=r2`, `VIDEO_DRIVER=cloudflare`, `PAYMENT_DRIVER=zalopay`. Đây là phép thử cuối cùng cho thiết kế seam ở mục 2.3.
- Security header viết tay trong `app.setup.ts`: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Strict-Transport-Security`, `Content-Security-Policy`. Không thêm `helmet` cho năm dòng middleware.
- Boot guard: từ chối khởi động nếu `NODE_ENV=production` mà còn driver ở giá trị demo hoặc `AUTH_JWT_SECRET` trùng giá trị trong `.env.example`.
- Rate limit mở rộng cho `POST /checkout/*` (5 lần / 300 giây theo `userId`, `API_CONTRACT.md` §8) và callback bất thường. Bộ đếm vẫn per-process; giữ nguyên `ponytail:` comment đã có trong `auth-rate-limit.guard.ts` và chỉ chuyển sang shared storage khi thực sự chạy nhiều instance.
- Structured logging có `requestId`, `purchaseId`, `appTransId`; không có secret, password hash hay session token.
- SEO: `app/sitemap.ts`, `app/robots.ts` (API native của Next), JSON-LD `Course` trên trang chi tiết, metadata Open Graph.
- Trang `/privacy`, `/terms`, `/refund-policy`. `/contact` đã có từ Phase 1 (mục 2.2) vì nó là đích của nút mua suốt Phase 2–3.
- Playwright cho ba luồng: khách → đăng ký → được cấp quyền → học xong một bài; khách bị chặn khỏi bài trả phí; checkout demo đầu-cuối.
- Backup: `pg_dump` định kỳ ngoài Railway, và **một lần restore thật** vào database trống rồi chạy lại toàn bộ e2e trên đó.
- Rà accessibility ở bốn breakpoint, kiểm tra tương phản.

### File và module

| Nơi | Thêm mới | Sửa |
|---|---|---|
| `apps/api` | `src/common/security-headers.middleware.ts`, `src/common/request-id.middleware.ts`, `src/common/logger.ts`, `scripts/backup.ps1`, `scripts/restore-drill.ps1` | `src/app.setup.ts`, `src/config.ts` (boot guard), `src/auth/auth-rate-limit.guard.ts` |
| `apps/web` | `src/app/sitemap.ts`, `src/app/robots.ts`, `src/app/privacy/page.tsx`, `terms`, `refund-policy`, `e2e/*.spec.ts`, `playwright.config.ts` | `src/app/courses/[slug]/page.tsx` (JSON-LD), `layout.tsx` (metadata), `src/app/contact/page.tsx` (nội dung chính thức) |
| gốc | — | `.github/workflows/ci.yml` (thêm bước Playwright) |

### Migration

Không có migration mới. Nếu phase này phát sinh migration thì đó là dấu hiệu một phase trước chưa xong.

### Test bắt buộc

| File | Nội dung |
|---|---|
| `test/security-headers.e2e-spec.ts` | mọi response có đủ header trong danh sách |
| `test/rate-limit.e2e-spec.ts` | vượt ngưỡng ở `/auth/login` và `/checkout/*` → `429` kèm `Retry-After` |
| `src/config.spec.ts` (mở rộng) | `NODE_ENV=production` + `PAYMENT_DRIVER=demo` → boot fail |
| `src/common/logger.spec.ts` | log của một request đăng nhập không chứa password, JWT hay giá trị cookie |
| `apps/web/e2e/*.spec.ts` | ba luồng nêu trên, chạy ở 375px và 1440px |

### Demo script

1. Dựng `.env` production-like với toàn bộ driver thật, `NODE_ENV=production`.
2. Đổi một driver về `demo` → khởi động api → process thoát kèm lỗi nêu đúng tên biến. Đổi lại.
3. `curl.exe -I https://<domain>/api/v1/health` → đủ header bảo mật.
4. Mua một khóa học bằng ZaloPay sandbox trên môi trường staging → mở khóa được, nhận email thật, video phát từ Cloudflare Stream.
5. Copy URL playback Cloudflare sang trình duyệt khác sau khi hết hạn token → bị chặn.
6. `https://<domain>/sitemap.xml` → liệt kê đúng các khóa đã publish, không có `DRAFT`.
7. Dán URL trang chi tiết vào Rich Results Test → nhận diện `Course`.
8. Chạy `scripts/restore-drill.ps1` → khôi phục vào database trống, chạy `pnpm --filter api test:e2e` trỏ vào DB đó → xanh.
9. `corepack pnpm --filter web exec playwright test` → 3 luồng xanh.
10. Bật `prefers-reduced-motion`, đi hết trang chủ → không còn animation.

### Acceptance

| # | Kiểm tra | Kết quả bắt buộc |
|---|---|---|
| A5.1 | `curl.exe -I http://localhost:3001/api/v1/health` | có `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Content-Security-Policy` |
| A5.2 | `curl.exe -s http://localhost:3000/sitemap.xml` | chứa mọi slug `PUBLISHED` |
| A5.3 | `curl.exe -s http://localhost:3000/robots.txt` | có dòng `Sitemap:` |
| A5.4 | `corepack pnpm --filter web exec playwright test` | 3/3 pass |
| A5.5 | `scripts/restore-drill.ps1` rồi chạy e2e trên DB khôi phục | exit 0 |
| A5.6 | Gửi 11 request `POST /auth/login` trong 60 giây | request thứ 11 trả `429` kèm `Retry-After` |
| A5.7 | Đọc log của một request đăng nhập | có `requestId`, không có password/JWT/cookie |
| A5.8 | `python design/contrast-check.py` | exit 0, mọi cặp pass |
| A5.9 | Gửi 6 request `POST /checkout/:slug` trong 300 giây bằng cùng cookie | request thứ 6 trả `429` kèm `Retry-After` (`API_CONTRACT.md` §8: 5 lần / 300 giây / user) |
| N5.1 | `grep -ri "ZALOPAY_KEY\|CF_STREAM_TOKEN\|R2_SECRET" apps/web` | không có kết quả |
| N5.2 | `NODE_ENV=production` + bất kỳ driver nào ở `demo` | api không khởi động, lỗi nêu đúng tên biến |
| N5.3 | `AUTH_JWT_SECRET` để nguyên giá trị của `.env.example` với `NODE_ENV=production` | api không khởi động |
| N5.4 | Mở trang học ở tab ẩn danh với URL đoán được | `401`, không lộ tiêu đề bài học trong body |
| N5.5 | `curl.exe -s http://localhost:3000/sitemap.xml` với một course `DRAFT` | slug đó không xuất hiện |

## 10. Tổng hợp ước lượng

| Phase | Ước lượng | Phần nặng nhất |
|---|---|---|
| 1 Nền tảng (còn lại) | L | design token + giao diện auth, không phải backend. Tăng từ M lên L vì phase này gánh thêm quản lý mật khẩu/phiên (PROJECT_PLAN.md dòng 162), `/contact`, error boundary, và ba khiếm khuyết hạ tầng phải sửa trước khi D5/D7 chạy được: `prisma.config.ts` thiếu `migrations.seed`, không có runner TypeScript cho seed, `prisma generate` không tự chạy |
| 2 Catalog và soạn nội dung | XL | admin authoring 4 tầng và toàn bộ hệ thống thiết kế lên màn hình thật |
| 3 Trải nghiệm học | L | playback token và bất biến quyền truy cập; quản lý người dùng đi kèm vì không có nó thì không chọn được học viên để cấp quyền |
| 4 Thanh toán | L | idempotency và reconcile |
| 5 Hardening và mở bán | M | restore drill và lật seam sang driver thật |

## 11. Điểm khác PROJECT_PLAN.md

Các quyết định ghi đè kế hoạch gốc thuộc [PLAN_SUPPLEMENT.md](./PLAN_SUPPLEMENT.md) §1–§2. Roadmap này chỉ thi hành thứ tự phase, deliverable và điều kiện nghiệm thu; không lặp lại hợp đồng driver, seed, rating hay microcopy.

Nguồn sự thật tương ứng:

- Driver seam và biến môi trường: [DEMO_MODE.md](./DEMO_MODE.md).
- Schema, enum, migration và seed: [DATA_MODEL.md](./DATA_MODEL.md).
- Route, design token, trạng thái và microcopy: [UX_PLAN.md](./UX_PLAN.md).
- Endpoint và mã lỗi: [API_CONTRACT.md](./API_CONTRACT.md).
