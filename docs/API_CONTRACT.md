# Hợp đồng REST API

Tài liệu này định nghĩa toàn bộ bề mặt HTTP của `apps/api`. Nó mở rộng [PROJECT_PLAN.md](./PROJECT_PLAN.md) (kiến trúc, luồng ZaloPay), [DATA_MODEL.md](./DATA_MODEL.md) (schema, tên field, enum) và [DEMO_MODE.md](./DEMO_MODE.md) (seam driver, biến môi trường, endpoint dev). Không lặp lại nội dung của ba tài liệu đó.

Nguyên tắc: **quy ước đã cài đặt là quy ước duy nhất**. Mục 1 ghi lại hiện trạng đã kiểm chứng bằng lệnh; mọi phần còn lại chỉ mở rộng nó.

Mỗi endpoint đều có cột **Trang** trỏ tới nơi tiêu thụ. Không có endpoint nào không có người gọi. Đường dẫn trang là route Next.js đề xuất; tài liệu UX là nguồn chính thức cho tên trang, hợp đồng này chỉ cần biết trang nào gọi endpoint nào.

## 1. Hiện trạng đã cài đặt

Đã kiểm chứng bằng cách chạy code, không suy đoán.

### 1.1 Sáu route hiện có

| Method | Path | File |
|---|---|---|
| `GET` | `/api/v1` | `app.controller.ts` — trả chuỗi `Hello World!`, `Content-Type: text/html; charset=utf-8` |
| `GET` | `/api/v1/auth/csrf` | `auth.controller.ts` |
| `POST` | `/api/v1/auth/register` | `auth.controller.ts` |
| `POST` | `/api/v1/auth/login` | `auth.controller.ts` |
| `GET` | `/api/v1/auth/me` | `auth.controller.ts` |
| `POST` | `/api/v1/auth/logout` | `auth.controller.ts` |

### 1.2 Cấu hình toàn cục (`app.setup.ts`)

| Thiết lập | Giá trị |
|---|---|
| Global prefix | `api/v1` |
| Versioning | Không dùng `enableVersioning()`. Version nằm trong prefix. |
| Middleware | `cookie-parser`, không tham số |
| CORS | **Chưa bật** |
| `ValidationPipe.transform` | `true` |
| `ValidationPipe.whitelist` | `true` — field lạ bị loại |
| `ValidationPipe.forbidNonWhitelisted` | `true` — field lạ làm request `400` |
| `ValidationPipe.stopAtFirstError` | `true` — mỗi field tối đa một thông báo |
| `ValidationPipe.validationError` | `{ target: false, value: false }` — không echo giá trị người dùng gửi |
| Exception filter | Không có filter tuỳ biến; dùng `BaseExceptionFilter` mặc định của Nest |

### 1.3 Cookie và session

| Cookie | HttpOnly | SameSite | Secure | Path | Max-Age | Nội dung |
|---|---|---|---|---|---|---|
| `elearning_session` | có | `Lax` | chỉ khi `NODE_ENV=production` | `/` | `604800` (7 ngày) | JWT `HS256`, claims `sub` (user id) + `sid` (session id), `exp` khớp session |
| `elearning_csrf` | **không** | `Lax` | chỉ khi `NODE_ENV=production` | `/` | `604800` | 32 byte ngẫu nhiên, `base64url` (43 ký tự) |

Không cookie nào đặt thuộc tính `Domain` — cả hai là host-only.

`SessionAuthGuard` mỗi request: đọc cookie → `jwt.verifyAsync` (`HS256`) → truy vấn `Session` phải `revokedAt = null`, `expiresAt > now`, và `user.status = ACTIVE`. Thiếu bất kỳ điều kiện nào → `401`. Đây là lý do đăng xuất và khoá tài khoản có hiệu lực tức thì.

### 1.4 Hợp đồng CSRF double-submit

| Thành phần | Giá trị |
|---|---|
| Nguồn token | `GET /api/v1/auth/csrf` → body `{ "csrfToken": "..." }`, đồng thời `Set-Cookie: elearning_csrf` |
| Header gửi lên | `X-CSRF-Token` (guard đọc key thường hoá `x-csrf-token`) |
| So sánh | `timingSafeEqual` trên byte thô, yêu cầu **độ dài bằng nhau** trước khi so |
| Thất bại | `403` `Invalid CSRF token` |
| Xoay vòng | **Hiện tại:** `csrf()` sinh token mới **mỗi lần gọi** `GET /auth/csrf` (`auth.controller.ts` — `createCsrfToken()` chạy vô điều kiện), *và* sau mỗi `register`/`login` qua `setSessionCookies`. |
| Xoá | `logout` xoá cả hai cookie |

Thứ tự guard hiện tại là `@UseGuards(CsrfGuard, AuthRateLimitGuard)`. Hệ quả đã kiểm chứng: request sai CSRF bị `403` và **không tiêu tốn quota rate limit**. Giữ nguyên tính chất này.

**Phải sửa `csrf()` thành idempotent trước khi layout gọi nó mỗi lần tải trang (mục 8).** Với hành vi hiện tại, tab thứ hai hoặc một lần điều hướng client-side làm hỏng token mà form đang mở đang giữ, và lần submit sau nhận `403 CSRF_INVALID` từ một client hoàn toàn đúng — im lặng, vì mục 1.5 đảm bảo `403` không tốn quota nên không có gì kêu. Sửa: `csrf()` dùng lại cookie đang có khi nó khớp `^[A-Za-z0-9_-]{43}$`, chỉ sinh mới khi thiếu hoặc sai định dạng. Xoay vòng trong `setSessionCookies` **giữ nguyên** — đó là phòng thủ session fixation, không phải cùng một việc.

### 1.5 Rate limit hiện có (`auth-rate-limit.guard.ts`)

| Thuộc tính | Giá trị |
|---|---|
| Áp dụng cho | `POST /auth/register`, `POST /auth/login` |
| Khoá đếm | `${clientIp}:${request.path}` — register và login có quota riêng |
| Cửa sổ | `60_000` ms, cố định (fixed window) |
| Giới hạn | `10` request / cửa sổ |
| Nguồn IP | `X-Real-IP` khi có `RAILWAY_ENVIRONMENT_ID` và header là IP hợp lệ; ngược lại `request.ip` |
| Bộ nhớ | `Map` trong process, xoá sạch khi vượt `10_000` khoá |
| Khi vượt | Header `Retry-After` (giây) + `429` |

Request bị `400` do validation **vẫn tính vào quota**, vì guard chạy trước pipe. Đây là hành vi đúng và test e2e đang dựa vào nó.

### 1.6 Bốn khoảng trống phải lấp trước khi thêm module mới

Đã kiểm chứng bằng cách chạy `BaseExceptionFilter` và một Nest app thật:

| Vấn đề | Hiện tại | Yêu cầu |
|---|---|---|
| Route không khớp | Rơi xuống 404 mặc định của Express, trả **HTML**, không phải JSON | Thêm `NotFoundException` fallback để 404 cũng đi qua envelope JSON |
| Body của `429` | `HttpException(string, 429)` → `{"statusCode":429,"message":"..."}`, **thiếu** `error` | Chuẩn hoá bằng exception filter toàn cục |
| Mã lỗi máy đọc được | Không có | Thêm field `code` (mục 3.3) |
| `next.config.ts` | **Chưa tồn tại** trong `apps/web` | Bắt buộc phải có rewrite `/api/:path*` → `API_ORIGIN`, nếu không cookie `SameSite=Lax` không hoạt động cross-origin |

Cú pháp rewrite phải viết đúng, không viết `'/api/*'`. Đã chạy matcher của chính Next 16.3.3 (`next/dist/shared/lib/router/utils/path-match`): `getPathMatch('/api/*')` ném `Unexpected MODIFIER at 5, expected END`, còn `'/api/:path*'` khớp `/api/v1/auth/me` → `{ path: ['v1','auth','me'] }`. Nội dung tối thiểu của `apps/web/next.config.ts`:

```ts
async rewrites() {
  return [{ source: '/api/:path*', destination: `${process.env.API_ORIGIN}/api/:path*` }];
}
```

Rewrite này **chỉ** áp cho request đi tới Next server từ trình duyệt. Nó **không** áp cho fetch mà chính Next server phát ra — xem mục 3.3.

## 2. Quy ước toàn cục

### 2.1 Base path và versioning

Base path là `/api/v1`, đặt bằng `setGlobalPrefix('api/v1')`. **Không** bật `enableVersioning()` của Nest: bản đầu chỉ có một version, và URI versioning của Nest sẽ tạo ra hai cách viết version trong cùng một app. Khi cần `v2`, đổi global prefix và chạy song song hai instance, hoặc lúc đó mới bật `enableVersioning({ type: VersioningType.URI })`.

Trình duyệt luôn gọi cùng origin qua rewrite của Next (`/api/:path*` → `API_ORIGIN`, mục 1.6). CORS giữ nguyên trạng thái **tắt**. Bật CORS là dấu hiệu ai đó đã gọi API trực tiếp bằng origin khác — trường hợp đó phải được xem xét lại, không phải mở CORS.

### 2.2 Content type

| Chiều | Quy ước |
|---|---|
| Request body | `application/json` duy nhất. Ngoại lệ duy nhất: `PUT /media/local/{key}` (upload byte thô, chỉ tồn tại khi `STORAGE_DRIVER=demo`). |
| Response | `application/json; charset=utf-8`. Ngoại lệ: `GET /dev/mail*` trả HTML, `GET /media/local/{key}` trả file. |
| `204` | Không body. |
| Upload file thật | Không bao giờ đi qua NestJS. Client `PUT` thẳng lên storage bằng signed URL. |
| Giới hạn body JSON | `256kb` (`express.json({ limit: '256kb' })`). Đủ cho `Lesson.content` 50.000 ký tự tiếng Việt UTF-8 (~150kb) cộng phần còn lại của body. Mặc định `100kb` của Express **không đủ** và sẽ hỏng đúng ở màn hình soạn bài dài nhất. |
| Giới hạn body thô | `PUT /media/local/{key}`: `MAX_UPLOAD_BYTES` (`52428800`). Handler đọc hằng số phía server và kiểm `Content-Length` **trước khi đọc byte đầu tiên** — đúng bước 6 của DEMO_MODE.md §3. |
| Vượt giới hạn | `413 PAYLOAD_TOO_LARGE`. |
| Sai `Content-Type` | `415 UNSUPPORTED_MEDIA_TYPE`. |

`SignedUpload.maxBytes` là **giá trị server echo cho UI** hiển thị trước khi chọn file, không phải một tuyên bố được ký. DEMO_MODE.md §3 đã chốt không ký `maxBytes` vào URL: nó là hằng số phía server và handler đọc trực tiếp, nên ký nó chỉ thêm bề mặt mà không thêm bảo đảm. Đừng viết code kiểm `Content-Length` "so với `maxBytes` trong URL" — trong URL không có giá trị đó.

### 2.3 Cache-Control

Mở rộng đúng quy ước đã có (`@Header('Cache-Control', 'no-store')` trên `/auth/csrf` và `/auth/me`):

| Nhóm | Giá trị |
|---|---|
| Mọi endpoint cần session | `no-store` |
| Catalog công khai (`/categories`, `/categories/{slug}`, `/courses`, `/courses/{slug}`) | `public, max-age=60, stale-while-revalidate=300` |
| `/health` | `no-store` |

Vì catalog công khai được cache, nó **không được** chứa bất kỳ thông tin riêng của người xem. Trạng thái "đã mua hay chưa" lấy từ `GET /enrollments/me`, không nhúng vào `GET /courses/{slug}`. Đây cũng là lý do không có guard "session tuỳ chọn" nào trong hệ thống.

### 2.4 Envelope lỗi

Giữ nguyên ba field mà Nest đang trả, **thêm** một field `code`. Một `AppExceptionFilter` toàn cục chuẩn hoá mọi lỗi:

```json
{
  "statusCode": 409,
  "code": "EMAIL_TAKEN",
  "message": "Email is already registered",
  "error": "Conflict"
}
```

| Field | Kiểu | Ghi chú |
|---|---|---|
| `statusCode` | number | Luôn khớp HTTP status |
| `code` | string | `SCREAMING_SNAKE_CASE`, ổn định, là **hợp đồng thật** với frontend |
| `message` | string \| string[] | Tiếng Anh, dành cho developer và log. Mảng chỉ xuất hiện với lỗi validation. |
| `error` | string | Tên chuẩn của HTTP status. Giữ để tương thích ngược. |
| `details` | object | Có ở `VALIDATION_FAILED`, `COURSE_NOT_PUBLISHABLE`, `PURCHASE_NOT_REFUNDABLE` |
| `requestId` | string | **Chỉ có khi `statusCode >= 500`.** Giá trị đúng bằng header `X-Request-Id` của cùng response. |

`message` **giữ nguyên tiếng Anh**. Giao diện tiếng Việt map `code` sang câu chữ tiếng Việt ở phía web theo bảng ở mục 2.5b — đó chính là lý do `code` phải tồn tại. Không dịch `message` trong API: nó sẽ vào log và sẽ bị người ta copy vào tìm kiếm.

**`X-Request-Id` có trên mọi response, không riêng lỗi.** Một middleware đứng trước mọi thứ khác: dùng lại giá trị client gửi lên nếu khớp `^[A-Za-z0-9_-]{8,64}$`, ngược lại sinh UUID v4; gắn vào `request`, echo ra response header, và đưa vào mọi dòng structured log của request đó (PROJECT_PLAN.md §Triển khai và PLAN_SUPPLEMENT.md đều bắt buộc "log chứa request ID" — đây là chỗ định nghĩa nó). Web hiện chuỗi này dưới thông báo lỗi 500 kèm nút copy; đó là mã tra cứu, không phải mã lỗi thô, nên không vi phạm quy tắc "không hiện mã lỗi thô" ở UX_PLAN.md §6.1.

### 2.5 Danh mục `code`

| `code` | Status | Khi nào |
|---|---|---|
| `VALIDATION_FAILED` | 400 | `ValidationPipe` từ chối body/query/param |
| `TOKEN_INVALID` | 400 | Token verify email / reset password sai hoặc hết hạn |
| `ORDER_MISMATCH` | 400 | Danh sách id gửi lên khi reorder không phải hoán vị của tập hiện có |
| `UNAUTHENTICATED` | 401 | Thiếu session, session bị thu hồi/hết hạn, hoặc user bị khoá |
| `INVALID_CREDENTIALS` | 401 | Sai email hoặc mật khẩu (một thông báo duy nhất, xem mục 6.3) |
| `CSRF_INVALID` | 403 | Thiếu hoặc sai `X-CSRF-Token` |
| `NOT_ENROLLED` | 403 | Chưa có `Enrollment` active cho khoá học đang truy cập |
| `EMAIL_NOT_VERIFIED` | 403 | Bắt đầu checkout khi `User.emailVerifiedAt` là `null` (PLAN_SUPPLEMENT.md §4.1). Đây là **chỗ duy nhất** email chưa xác minh bị chặn: đăng nhập, xem catalog, xem bài học thử và học khoá đã có `Enrollment` đều cho phép |
| `SIGNATURE_INVALID` | 403 | `/media/local/*`: chữ ký HMAC sai **hoặc** `exp` đã qua. Một mã duy nhất cho cả hai — DEMO_MODE.md §3 đã chốt không phân biệt, vì trả lời khác nhau là kể cho người cầm URL biết họ đoán đúng phần nào. |
| `NOT_FOUND` | 404 | Không tồn tại, hoặc tồn tại nhưng người gọi không được phép biết |
| `EMAIL_TAKEN` | 409 | Đăng ký trùng email |
| `ALREADY_ENROLLED` | 409 | Checkout khoá đã có quyền học |
| `COURSE_HAS_ENROLLMENTS` | 409 | Xoá cứng khoá học đã có người học; gỡ về bản nháp khoá còn `Enrollment` `ACTIVE` |
| `SECTION_NOT_EMPTY` | 409 | Xoá section còn lesson |
| `CATEGORY_NOT_EMPTY` | 409 | Xoá category còn khoá học trỏ tới (FK `Restrict`, DATA_MODEL.md) |
| `SLUG_TAKEN` | 409 | `Course.slug` hoặc `Category.slug` đã tồn tại |
| `EXTERNAL_ID_TAKEN` | 409 | `POST /admin/videos` trùng `(provider, externalId)` |
| `VIDEO_ALREADY_ATTACHED` | 409 | `videoAssetId` đã gắn vào lesson khác (`@unique`) |
| `VIDEO_NOT_READY` | 409 | Xin playback token cho `VideoAsset` chưa ở trạng thái `READY` |
| `PAYMENT_EXPIRED` | 409 | Thao tác trên `PaymentAttempt` đã hết hạn |
| `PURCHASE_NOT_REFUNDABLE` | 409 | Hoàn tiền một `Purchase` chưa `PAID`, đã `REFUNDED`, hoặc ngoài chính sách PLAN_SUPPLEMENT.md §4.5; `details` nêu lý do |
| `SELF_ACTION_FORBIDDEN` | 409 | Admin tự khoá tài khoản của chính mình |
| `PAYLOAD_TOO_LARGE` | 413 | Body vượt giới hạn ở mục 2.2 |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | `Content-Type` không nằm trong danh sách cho phép của endpoint |
| `COURSE_NOT_PURCHASABLE` | 422 | Khoá `DRAFT`/`ARCHIVED` hoặc `priceVnd = 0` |
| `COURSE_NOT_PUBLISHABLE` | 422 | Publish khi nội dung chưa hợp lệ; `details.issues[]` liệt kê từng thiếu sót |
| `RATE_LIMITED` | 429 | Vượt giới hạn ở mục 8; kèm header `Retry-After` |
| `INTERNAL` | 500 | Lỗi không xác định. Không bao giờ lộ stack hay message gốc. |

Không có `LINK_EXPIRED`. Hết hạn và sai chữ ký dùng chung `SIGNATURE_INVALID`; thêm mã thứ hai là mở lại đúng thứ DEMO_MODE.md §3 đã cố ý đóng.

### 2.5b Bản dịch tiếng Việt của `code`

Đây là phần làm cho `code` có ích. Không màn hình nào được tự nghĩ ra câu chữ cho một mã đã có ở đây.

Chuỗi lấy nguyên văn từ UX_PLAN.md §6.2 và §6.3 khi ở đó đã có; phần còn lại viết mới theo đúng quy ước §9.1 (xưng "bạn", câu chủ động, không dấu chấm than, "Vui lòng" chỉ dùng khi thật sự yêu cầu hành động).

| `code` | Câu tiếng Việt | Nơi hiển thị | Hành động kèm theo |
|---|---|---|---|
| `VALIDATION_FAILED` | Câu theo từng trường ở UX_PLAN.md §6.4 | Lỗi dưới từng ô, bind theo `details` | ≥ 2 lỗi: `Alert` `destructive` đầu form, "Vui lòng kiểm tra lại {n} trường" |
| `TOKEN_INVALID` | "Liên kết đã hết hạn hoặc đã được dùng." | Trang `/verify-email`, `/reset-password` — `ErrorState` | Nút "Gửi lại liên kết" |
| `ORDER_MISMATCH` | "Danh sách đã thay đổi. Tải lại rồi sắp xếp lại." | `Alert` `inline` trên `SortableList` | Nút "Tải lại" |
| `UNAUTHENTICATED` | "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." | `Toast` `error` không tự đóng | Chuyển `/login?next=` sau 2 giây |
| `INVALID_CREDENTIALS` | "Email hoặc mật khẩu không đúng." | `Alert` `destructive` dưới form | — (không focus ô nào: không được gợi ý sai ô nào) |
| `CSRF_INVALID` | "Không thực hiện được thao tác. Tải lại trang rồi thử lại." | `Alert` sau khi đã tự thử lại **một** lần | Nút "Tải lại trang" |
| `NOT_ENROLLED` | "Bạn chưa có quyền học khoá này." | Trang lỗi trong layout player | Nút "Xem khoá học" → `/courses/[slug]` |
| `EMAIL_NOT_VERIFIED` | "Xác minh email trước khi thanh toán." | `Alert` `warning` trên trang checkout `/checkout/[courseSlug]` | Nút "Gửi lại email xác minh" → `POST /auth/verify-email/request`, cooldown 120 giây như banner ở UX_PLAN.md §3.2 |
| `SIGNATURE_INVALID` | "Liên kết tải xuống đã hết hạn." | `Toast` `error` | Nút "Lấy liên kết mới" |
| `NOT_FOUND` | Trang 404 chuẩn của web, không phải toast | Trang lỗi | Nút "Về trang chủ" |
| `EMAIL_TAKEN` | "Email này đã được đăng ký." | Lỗi dưới ô `email` | Link "Đăng nhập" |
| `ALREADY_ENROLLED` | "Bạn đã có quyền học khoá này." | `Alert` `info` trên trang checkout | Nút "Vào học" |
| `COURSE_HAS_ENROLLMENTS` | Xoá: "Không xoá được: khoá học đã có học viên." · Gỡ về bản nháp: "Không gỡ về bản nháp được: khoá học đang có học viên." | Xoá: `Alert` trong `ConfirmDialog` · Gỡ về bản nháp: `Alert` `destructive` đầu form sửa khoá học | Gợi ý "Lưu trữ" thay vì xoá hoặc gỡ về bản nháp (nút "Lưu trữ" nằm ngay cạnh "Gỡ xuất bản") |
| `SECTION_NOT_EMPTY` | "Xoá hết bài học trong chương trước đã." | `Alert` trong `ConfirmDialog` | — |
| `CATEGORY_NOT_EMPTY` | "Danh mục còn khoá học, không xoá được." | `Alert` trong `ConfirmDialog` | Nút "Xem khoá học trong danh mục" |
| `SLUG_TAKEN` | "Đường dẫn này đã được dùng." | Lỗi dưới ô `slug` | — |
| `EXTERNAL_ID_TAKEN` | "Video này đã được thêm trước đó." | Lỗi dưới ô `externalId` | — |
| `VIDEO_ALREADY_ATTACHED` | "Video này đang gắn ở một bài học khác." | `Alert` trong `VideoAssetField` | — |
| `VIDEO_NOT_READY` | "Video đang được xử lý" / "Bài học sẽ xem được sau vài phút." | `ErrorState` trong khung player (UX_PLAN.md §6.2) | Nút "Kiểm tra lại" |
| `PAYMENT_EXPIRED` | "Mã QR đã hết hạn." | `QrPanel` trạng thái `expired` | Nút "Tạo lại mã QR" |
| `PURCHASE_NOT_REFUNDABLE` | "Đơn này ngoài chính sách hoàn tiền." | `Alert` `destructive` trong dialog hoàn tiền | Hiện `details` (ngày mua, số ngày, % tiến độ) + ô tick "Vẫn hoàn" (`force`) |
| `SELF_ACTION_FORBIDDEN` | "Bạn không thể khoá tài khoản của chính mình." | `Alert` trong `BlockUserDialog` | — |
| `PAYLOAD_TOO_LARGE` | "Tệp vượt quá {maxBytes} cho phép." | Lỗi dưới `FileDropzone` | Nút "Chọn tệp khác" |
| `UNSUPPORTED_MEDIA_TYPE` | "Định dạng tệp không được hỗ trợ." | Lỗi dưới `FileDropzone` | Nêu rõ định dạng cho phép |
| `COURSE_NOT_PURCHASABLE` | "Khoá học này hiện không bán." | `Alert` `warning` thay chỗ `EnrollCta` | Nút "Xem khoá học khác" |
| `COURSE_NOT_PUBLISHABLE` | Từng dòng theo bảng ở mục 5.3 | `PublishChecklist` | Nút "Xuất bản" vô hiệu tới khi đủ |
| `RATE_LIMITED` | "Bạn đã thử quá nhiều lần. Vui lòng đợi {n} phút rồi thử lại." | Nút bị khoá kèm đếm ngược (UX_PLAN.md §6.3) | `{n}` tính từ header `Retry-After` |
| `INTERNAL` | "Đã có lỗi từ hệ thống. Vui lòng thử lại." | `Toast` `error` hoặc `ErrorState` tuỳ bề mặt | Nút "Thử lại" + dòng phụ `requestId` kèm nút copy |

### 2.6 Shape lỗi validation

Giữ nguyên `message` là mảng string do Nest sinh ra (frontend hiện tại và test e2e đang dựa vào), **thêm** `details` map field → tên constraint đầu tiên. Cài bằng `exceptionFactory` trên `ValidationPipe` đã có, không đổi bốn tuỳ chọn hiện tại.

```json
{
  "statusCode": 400,
  "code": "VALIDATION_FAILED",
  "error": "Bad Request",
  "message": [
    "displayName must be longer than or equal to 2 characters",
    "email must be an email"
  ],
  "details": { "displayName": "isLength", "email": "isEmail" }
}
```

Form phía web bind lỗi theo `details`, không parse `message`. Vì `stopAtFirstError: true`, mỗi field có đúng một entry. Field lạ vẫn trả `property x should not exist` với `details` rỗng.

### 2.7 Phân trang

Dùng **offset**, không dùng cursor.

Lý do: mọi danh sách trong sản phẩm này đều nhỏ và cần hiển thị tổng số — catalog kiểu Udemy in "1.234 khoá học", bảng admin cần nhảy trang, báo cáo cần tổng. Hệ thống một chủ sở hữu có hàng trăm khoá học và hàng nghìn enrollment, `COUNT(*)` ở quy mô đó là miễn phí. Cursor chỉ thắng ở feed append-only rất lớn — sản phẩm này không có cái nào, kể cả audit log. Một quy ước, không ngoại lệ.

| Query param | Kiểu | Mặc định | Ràng buộc |
|---|---|---|---|
| `page` | int | `1` | `@IsInt() @Min(1)` |
| `pageSize` | int | `20` | `@IsInt() @Min(1) @Max(100)` |

```json
{ "items": [], "page": 1, "pageSize": 20, "total": 137, "totalPages": 7 }
```

`page` vượt `totalPages` trả `items: []` và `200`, không phải `404`.

### 2.8 Sắp xếp và lọc

| Quy ước | Dạng | Ví dụ |
|---|---|---|
| Sắp xếp | `sort=<field>:<asc\|desc>`, **một** field, whitelist theo từng endpoint | `sort=enrollmentCount:desc` |
| Lọc chính xác | `<field>=<value>[,<value>]`, phân tách bằng dấu phẩy | `category=lap-trinh,thiet-ke` |
| Lọc khoảng | `<field>Min` / `<field>Max` | `priceVndMin=0&priceVndMax=500000` |
| Tìm kiếm | `q`, `@MaxLength(100)`, trim | `q=react` |

Giá trị `sort` ngoài whitelist trả `VALIDATION_FAILED`, không im lặng bỏ qua. Nút "Phổ biến nhất" trên UI map sang `sort=enrollmentCount:desc`; UI không được tự nghĩ ra field.

`q` được chuẩn hoá bằng **đúng hàm `normalize()`** của `apps/api/src/catalog/search-text.ts` (NFD → bỏ dấu thanh → `đ`/`Đ` → `d` → lowercase → trim), rồi so khớp trên cột đã chuẩn hoá sẵn: `where: { status: 'PUBLISHED', searchText: { contains: qNormalized } }`. Cùng một hàm dùng cho cả lúc ghi `Course.searchText` và lúc đọc `q`, nên gõ "lap trinh" khớp "Lập trình". Không `unaccent`, không `tsvector`, không `$queryRaw` — DATA_MODEL.md §Course và PLAN_SUPPLEMENT.md §4.3 đã chốt, và §4.3 chứng minh bằng lệnh trên PostgreSQL 18.4 rằng `CREATE INDEX ON courses (unaccent(title))` bị từ chối vì `unaccent` là `STABLE`, nên phương án `ILIKE … unaccent()` của bản đầu **không index được ở bất kỳ quy mô nào**.

Ngưỡng nâng cấp: khi `EXPLAIN ANALYZE` của `GET /courses?q=` vượt 50 ms, thêm extension `pg_trgm` và một GIN index trên `courses.search_text`. Đó là thêm một index, không phải đổi thiết kế — `%q%` mở hai đầu không dùng được btree ở bất kỳ quy mô nào, nên lựa chọn thật chỉ là "quét tuần tự" hay "`pg_trgm`".

### 2.9 Mã hoá kiểu dữ liệu

| Kiểu | Quy ước | Ví dụ |
|---|---|---|
| Thời điểm | ISO 8601 UTC, mili giây (mặc định của `JSON.stringify(Date)`, khớp `Timestamptz(3)`) | `"2026-09-01T13:45:00.000Z"` |
| Khoảng thời gian | Số nguyên giây, hậu tố `Seconds` | `"durationSeconds": 754` |
| Tiền | Số nguyên VND, hậu tố `Vnd`. Không float, không string, không đơn vị nhỏ hơn đồng. | `"priceVnd": 499000` |
| Id | UUID string | `"9f1c..."` |
| Slug | ASCII thường, không dấu, `^[a-z0-9-]{3,120}$` | `"lap-trinh-react"` |
| Enum | `SCREAMING_SNAKE_CASE`, đúng giá trị enum Prisma | `"PUBLISHED"` |
| Boolean | Luôn có mặt, không dùng `null` thay `false` | `"isPreview": false` |
| Không có giá trị | `null`. Không dùng chuỗi rỗng, không omit field. | `"ratingAverage": null` |

### 2.10 Idempotency

**Không có header `Idempotency-Key` ở bất kỳ đâu.** Mọi thao tác cần idempotent đều đã có khoá tự nhiên trong database; thêm một cơ chế thứ hai chỉ tạo thêm bảng để đồng bộ.

| Thao tác | Khoá tự nhiên | Hành vi khi gọi lại |
|---|---|---|
| `POST /checkout/{courseSlug}` | `Purchase(userId, courseId)` unique + `PaymentAttempt` còn hạn | Trả lại QR cũ, `200` thay vì `201`. Không tạo giao dịch mới. |
| `POST /payments/{provider}/callback` | `PaymentAttempt.appTransId` unique + chuyển trạng thái một chiều | Trả `return_code: 1`, không cấp `Enrollment` lần hai |
| `POST /admin/enrollments` | `Enrollment(userId, courseId)` unique | Upsert. `201` lần đầu, `200` các lần sau. |
| `PUT /lessons/{id}/progress` | `LessonProgress(userId, lessonId)` unique | Ghi đè. `completedAt` chỉ set một lần, không lùi. |
| `PUT .../order` | Gửi **toàn bộ** danh sách id theo thứ tự | Áp lại cùng thứ tự là no-op. Không có PATCH từng phần tử để tránh đua. |

## 3. Xác thực và phân quyền

### 3.1 Guard và thứ tự chạy

| Guard | Phạm vi | Nhiệm vụ |
|---|---|---|
| `CsrfGuard` | **Toàn cục** (`APP_GUARD`), bỏ qua `GET`/`HEAD`/`OPTIONS` và route gắn `@SkipCsrf()` | Double-submit token |
| `AuthRateLimitGuard` | Theo route, qua `@RateLimit({...})` | Mục 8 |
| `SessionAuthGuard` | Theo route, **chỉ ngoài `/admin/*`** | Cookie → JWT → bản ghi `Session` → `request.auth` |
| `AdminGuard` | Theo route/controller dưới `/admin/*` và `/dev/*`, **thay thế** `SessionAuthGuard` chứ không đứng sau nó | Tự resolve session bằng `AuthService.authenticate`, đặt `request.auth`, và ném `NotFoundException` ở **mọi** nhánh thất bại |

Đổi `CsrfGuard` từ per-route sang toàn cục là thay đổi bắt buộc: với hơn 50 endpoint mutation, quên gắn decorator một lần là đủ để mở lỗ. `@SkipCsrf()` chỉ được dùng ở đúng hai chỗ: `POST /payments/{provider}/callback` (server-to-server, xác thực bằng HMAC, không có cookie) và `PUT /media/local/{key}` (xác thực bằng chữ ký trong URL).

Guard toàn cục chạy trước guard theo route, nên tính chất "CSRF sai không tốn quota rate limit" ở mục 1.4 được giữ nguyên.

Thứ tự trong `@UseGuards`:

| Phạm vi | Thứ tự |
|---|---|
| Route cần đăng nhập, ngoài `/admin/*` | `SessionAuthGuard, AuthRateLimitGuard` |
| `/admin/*` và `/dev/*` | `AdminGuard, AuthRateLimitGuard` — **một** guard xác thực, không phải hai |

Rate limit đứng cuối để có thể đếm theo `userId`.

**Vì sao `/admin/*` chỉ được có một guard.** Nest chạy guard theo thứ tự và dừng ngay ở guard đầu tiên ném exception. Chuỗi `SessionAuthGuard, AdminGuard` nghĩa là request ẩn danh tới `/admin/*` **không bao giờ chạm** `AdminGuard`: `SessionAuthGuard` đã ném `401` trước đó. Đã kiểm chứng bằng một Nest app thật với hai guard stub (ném `Unauthorized` rồi ném `NotFound`): kết quả là `401 {"message":"Unauthorized","statusCode":401}`, không phải `404`. Với thứ tự đó, toàn bộ tính chất "bề mặt admin không quan sát được từ bên ngoài" ở mục 3.3 và 6.3 là **sai**.

`AdminGuard` do đó phải tự làm cả hai việc: gọi `AuthService.authenticate(token)` (dùng lại đúng hàm đang có, không viết lại), rồi `throw new NotFoundException()` cho mọi nhánh — thiếu cookie, JWT hỏng, session bị thu hồi hoặc hết hạn, user không `ACTIVE`, `role !== ADMIN`. Chỉ nhánh thành công mới đặt `request.auth` và cho đi tiếp.

### 3.2 Bảng vai trò theo tiền tố

Đây là quy tắc; cột **Vai trò** trong mục 5 là bảng đầy đủ theo từng endpoint.

| Tiền tố | Guard | Vai trò được phép |
|---|---|---|
| `/health` | không | Công khai |
| `/auth/csrf`, `/auth/register`, `/auth/login`, `/auth/password/*`, `/auth/verify-email/*` | `RateLimit` | Công khai |
| `/auth/me`, `/auth/logout` | `SessionAuth` | `STUDENT`, `ADMIN` |
| `/users/me*` | `SessionAuth` | `STUDENT`, `ADMIN` |
| `/categories*`, `/courses*` | không | Công khai |
| `POST /contact` | `RateLimit` (CSRF như mọi form) | Công khai |
| `/enrollments/me` | `SessionAuth` | `STUDENT`, `ADMIN` |
| `/learn/*`, `/lessons/*` | `SessionAuth` + kiểm tra `Enrollment`; endpoint **đọc** có nhánh bypass cho `ADMIN` (mục 5.5) | `STUDENT`, `ADMIN` |
| `/checkout/*`, `/purchases/*` | `SessionAuth` | `STUDENT`, `ADMIN` |
| `/admin/*` | `AdminGuard` **một mình** (mục 3.1) | `ADMIN`. Mọi vai trò khác, kể cả chưa đăng nhập → `404`. |
| `/dev/*` | `AdminGuard` **một mình**, module chỉ được import khi có driver demo | `ADMIN` |
| `/payments/{provider}/callback` | `@SkipCsrf`, xác minh HMAC | Máy chủ nhà cung cấp |
| `/media/local/{key}` | `@SkipCsrf`, xác minh HMAC trong URL | Bất kỳ ai có URL còn hạn |

### 3.3 Hệ quả của quy tắc `404` trên `/admin/*`

Người dùng `STUDENT` và khách chưa đăng nhập nhận cùng một response cho `/admin/*` như cho một đường dẫn không tồn tại. Hệ quả: admin UI **không** phân biệt được "hết session" với "không có quyền" từ status code. Cách xử lý: layout `/admin` gọi `GET /auth/me` trước, `401` → chuyển sang `/login`, `role !== ADMIN` → `notFound()` (khớp UX_PLAN.md §2.3). Một request thêm cho toàn bộ khu vực admin, đổi lại bề mặt admin không quan sát được từ bên ngoài.

Lời gọi đó phải viết đúng ba thứ, nếu không nó không chạy trên Next 16 App Router:

```ts
const res = await fetch(new URL('/api/v1/auth/me', process.env.API_ORIGIN), {
  headers: { cookie: (await cookies()).toString() },
  cache: 'no-store',
});
```

| Cạm bẫy | Thực tế đã kiểm |
|---|---|
| URL tương đối | Server Component **không** `fetch('/api/v1/auth/me')` được — Node ném `Invalid URL`. Phải dựng URL tuyệt đối từ `API_ORIGIN`. |
| Trông cậy vào rewrite | Rewrite ở mục 1.6 chỉ áp cho request **đi tới** Next server, không áp cho fetch mà Next server **phát ra**. Nó không che được lời gọi này. |
| Cookie | Fetch phía server không tự mang cookie. Phải chuyển tay, và `cookies()` là **async** trên bản này (`next/dist/server/request/cookies.d.ts`: `cookies(): Promise<ReadonlyRequestCookies>`). |

Hệ quả phải chấp nhận: `await cookies()` đẩy toàn bộ layout `/admin` sang dynamic rendering. `/admin/*` **không bao giờ** được prerender tĩnh. Đó là đúng thứ mong muốn cho một khu quản trị, nhưng phải ghi ra để không ai đi tìm cách bật lại ISR ở đó.

## 4. Shape response dùng lại

Định nghĩa một lần, tham chiếu trong mục 5.

Tên field bám đúng [DATA_MODEL.md](./DATA_MODEL.md). API không đổi tên field của database — mỗi lần đổi tên là một chỗ để hai tài liệu trôi khỏi nhau.

```
User            { id, email, displayName, role, status, emailVerifiedAt, createdAt }
AdminUserRow    User + { enrollmentCount, purchaseCount, activeSessionCount }
SessionRow      { id, createdAt, expiresAt, isCurrent }
Category        { id, slug, name, description, icon, position, courseCount }
CourseCard      { id, slug, title, subtitle, coverUrl, priceVnd, compareAtPriceVnd,
                  level, language, lessonCount, totalDurationSeconds,
                  enrollmentCount, ratingAverage, ratingCount, demoStats,
                  category: Category | null }
CourseDetail    CourseCard + { description, learningOutcomes: string[],
                  requirements: string[], targetAudience: string[],
                  publishedAt, updatedAt, sections: SectionOutline[] }
SectionOutline  { id, title, position, lessons: LessonOutline[] }
LessonOutline   { id, title, position, type, durationSeconds, isPreview }
LessonContent   { id, courseId, sectionId, title, type, content,
                  durationSeconds, hasVideo, isPreview, resources: Resource[],
                  progress: Progress | null, prevLessonId, nextLessonId }
Resource        { id, filename, contentType, sizeBytes, position }
Progress        { lastPositionSeconds, completedAt }
CourseProgress  { completedLessons, totalLessons, percent }
EnrollmentItem  { id, course: CourseCard, status, source, grantedAt,
                  progress: CourseProgress, resumeLessonId }
AdminEnrollment { id, user: { id, email, displayName }, course: { id, title },
                  status, source, grantedAt, revokedAt, grantedById }
PurchaseRow     { id, courseId, courseTitle, priceVnd, status,
                  createdAt, paidAt, refundedAt }
                status ∈ PENDING | PAID | REFUND_REQUESTED | REFUNDED | CANCELLED
CheckoutSession { purchaseId, paymentAttemptId, status, amountVnd, provider,
                  qrCode, orderUrl, createdAt, expiresAt }
Playback        { playbackUrl, kind, expiresAt }
SignedUpload    { uploadUrl, method, objectKey, expiresAt, maxBytes }
SignedDownload  { url, filename, expiresAt }
AuditLogRow     { id, actorId, actorEmail, action, entityType, entityId,
                  metadata, ipAddress, createdAt }
Paginated<T>    { items: T[], page, pageSize, total, totalPages }
```

Enum lấy nguyên văn từ DATA_MODEL.md: `LessonType` = `VIDEO` \| `ARTICLE`; `CourseLevel` = `BEGINNER` \| `INTERMEDIATE` \| `ADVANCED` \| `ALL_LEVELS`; `EnrollmentSource` = `PURCHASE` \| `MANUAL_GRANT`; `EnrollmentStatus` = `ACTIVE` \| `REVOKED`; `PurchaseStatus` = `PENDING` \| `PAID` \| `REFUND_REQUESTED` \| `REFUNDED` \| `CANCELLED`; `PaymentAttemptStatus` = `PENDING` \| `SUCCEEDED` \| `FAILED` \| `EXPIRED` \| `CANCELLED`. `Playback.kind` là ngoại lệ duy nhất, viết thường `hls` \| `mp4` vì nó đến từ interface `StreamClient` (DEMO_MODE.md §2), không phải từ database.

`Course.description` và `Lesson.content` chứa **Markdown thô**. API không render HTML.

`CourseDetail` **không có** khối `instructor`. Hệ thống một chủ sở hữu: giảng viên là chủ website, và giới thiệu giảng viên là nội dung tĩnh của trang web, không phải dữ liệu theo từng khoá. Thêm field đó bây giờ là tạo một bảng chỉ có một dòng.

`User` là chính xác kiểu `AuthUser` đang có trong `auth.service.ts`. Không thêm field vào nó mà không đọc mục 6.2.

`demoStats` được trả ra công khai để giao diện gắn nhãn **`Dữ liệu demo`** khi đang chạy seed. Chuỗi nhãn chốt ở DATA_MODEL.md §Quy tắc nhãn dữ liệu demo và UX_PLAN.md §9.5 — không viết "số liệu mẫu" hay "dữ liệu mẫu". Cờ này chỉ nói về **cụm rating**: đúng hai trường `ratingAverage` và `ratingCount` là số bịa, badge chỉ đứng cạnh cụm sao. `enrollmentCount` **không bao giờ bịa** — nó luôn bằng số hàng `Enrollment` `ACTIVE`, ép trong cùng transaction. Ẩn `demoStats` đi là chọn cách hiển thị số bịa mà không nói.

`CheckoutSession.createdAt` tồn tại vì trang `/account/orders/[id]` phải sắp xếp và hiển thị **lịch sử** các lần thanh toán, không chỉ lần cuối. Một `Purchase` có nhiều `PaymentAttempt` là chuyện bình thường: QR hết hạn rồi tạo lại.

## 5. Danh mục endpoint

Cột **Vai trò**: `—` là công khai. Mọi endpoint mutation đều có thể trả thêm `403 CSRF_INVALID`; không lặp lại trong cột lỗi.

### 5.1 Identity

| Method + Path | Vai trò | Trang | Request | 2xx | Lỗi |
|---|---|---|---|---|---|
| `GET /auth/csrf` | — | layout | — | `200 { csrfToken }` | `429` |
| `POST /auth/register` | — | `/register` | `email` `@IsEmail @MaxLength(320)` trim; `password` `@IsString @MinLength(8) @MaxLength(128)`; `displayName` `@IsString @Length(2,80)` trim | `201 { user: User }` + set 2 cookie | `400`, `409 EMAIL_TAKEN`, `429` |
| `POST /auth/login` | — | `/login` | `email`, `password` như trên | `200 { user: User }` + set 2 cookie | `400`, `401 INVALID_CREDENTIALS`, `429` |
| `GET /auth/me` | any | layout | — | `200 { user: User }` | `401` |
| `POST /auth/logout` | any | layout | — | `204` + xoá 2 cookie | `401` |
| `POST /auth/verify-email/request` | any | `/account` | — | `202` | `401`, `429` |
| `POST /auth/verify-email/confirm` | — | `/verify-email` | `token` `@IsString @Length(32,200)` | `204` | `400 TOKEN_INVALID`, `429` |
| `POST /auth/password/forgot` | — | `/forgot-password` | `email` `@IsEmail @MaxLength(320)` | `202` **luôn luôn** | `400`, `429` |
| `POST /auth/password/reset` | — | `/reset-password` | `token` `@IsString @Length(32,200)`; `password` `@MinLength(8) @MaxLength(128)` | `204` + thu hồi **mọi** session | `400 TOKEN_INVALID`, `429` |
| `PATCH /users/me` | any | `/account` | `displayName` `@IsString @Length(2,80)` trim | `200 { user: User }` | `400`, `401` |
| `POST /users/me/password` | any | `/account/password` | `currentPassword` `@IsString`; `newPassword` `@MinLength(8) @MaxLength(128)` | `204` + thu hồi **mọi** session, xoá cookie | `400`, `401 INVALID_CREDENTIALS`, `429` |
| `GET /users/me/sessions` | any | `/account/sessions` | — | `200 { items: SessionRow[] }` | `401` |
| `DELETE /users/me/sessions/{id}` | any | `/account/sessions` | param UUID | `204` | `401`, `404` |
| `DELETE /users/me/sessions` | any | `/account/sessions` | — | `204` (giữ session hiện tại) | `401` |
| `GET /admin/users` | ADMIN | `/admin/users` | `q`, `email` (khớp chính xác, không phân biệt hoa thường), `status`, `role`, `page`, `pageSize`, `sort` ∈ `createdAt`,`email` | `200 Paginated<AdminUserRow>` | `404` |
| `GET /admin/users/{id}` | ADMIN | `/admin/users/[id]` | param UUID | `200 { user: AdminUserRow, enrollments: AdminEnrollment[], purchases: PurchaseRow[] }` | `404` |
| `PATCH /admin/users/{id}` | ADMIN | `/admin/users/[id]` | `status` `@IsEnum(UserStatus)` | `200 { user: AdminUserRow }`; `BLOCKED` thu hồi mọi session, ghi `AuditLog` | `400`, `404`, `409 SELF_ACTION_FORBIDDEN` |

Đổi mật khẩu thu hồi **toàn bộ** session kể cả session hiện tại, đúng như PROJECT_PLAN.md yêu cầu. Web hiển thị "Đổi mật khẩu thành công, vui lòng đăng nhập lại" rồi chuyển sang `/login`.

`POST /auth/password/forgot` và `verify-email/request` luôn trả `202` bất kể email có tồn tại hay không. Xem mục 6.3.

#### Ba loại thư và token của chúng

`@Length(32,200)` chỉ ràng buộc độ dài chuỗi. Phần còn lại của hợp đồng token nằm ở đây, vì nếu không thì link trong thư sẽ trỏ vào trang không tồn tại và không ai biết thư hết hạn sau bao lâu.

| Loại | Tiêu đề tiếng Việt | Link trong thư | TTL | Dùng lại |
|---|---|---|---|---|
| Xác minh email | "Xác minh email của bạn" | `${WEB_ORIGIN}/verify-email?token=` | 24 giờ | Một lần. Dùng xong ghi `consumedAt`. |
| Đặt lại mật khẩu | "Đặt lại mật khẩu" | `${WEB_ORIGIN}/reset-password?token=` | 60 phút | Một lần. Dùng xong ghi `consumedAt`, đồng thời thu hồi mọi token reset khác của cùng user. |
| Xác nhận mua hàng | "Đơn hàng {courseTitle} đã thanh toán" | `${WEB_ORIGIN}/account/orders/{purchaseId}` | — (không có token) | Không giới hạn |

Tên trang lấy từ UX_PLAN.md §2.3 — đó là nguồn chính thức. Link trong thư trỏ tới trang web, **không bao giờ** trỏ thẳng vào endpoint API.

Bấm lại link đã dùng hoặc đã hết hạn: API trả `400 TOKEN_INVALID`, web hiện "Liên kết đã hết hạn hoặc đã được dùng." kèm nút "Gửi lại liên kết" (mục 2.5b). Không phân biệt "đã dùng" với "hết hạn" — cùng một câu, vì người dùng làm cùng một việc trong cả hai trường hợp.

Thân thư dùng chung một khung cho cả ba, đã đặc tả trong DEMO_MODE.md §4. Câu chữ theo UX_PLAN.md §9.

### 5.2 Catalog — công khai

| Method + Path | Vai trò | Trang | Request | 2xx | Lỗi |
|---|---|---|---|---|---|
| `GET /categories` | — | `/`, `/courses` | — | `200 { items: Category[] }` (sắp theo `position` tăng dần) | — |
| `GET /categories/{slug}` | — | `/categories/[slug]` | param `@Matches(/^[a-z0-9-]{3,120}$/)` | `200 Category` | `404` |
| `POST /contact` | — | `/contact` | `name` `@Length(2,80)` trim; `email` `@IsEmail @MaxLength(320)`; `message` `@Length(10,2000)`; `courseSlug?` `@Matches(slug)` | `202` | `400`, `429` |
| `GET /courses` | — | `/`, `/courses` | `q` `@MaxLength(100)`; `category` csv slug; `level` csv enum; `priceVndMin`/`priceVndMax` `@IsInt @Min(0)`; `page`, `pageSize` (catalog dùng `12`); `sort` ∈ `enrollmentCount`, `publishedAt`, `priceVnd`, `ratingAverage` (mặc định `enrollmentCount:desc`) | `200 Paginated<CourseCard>` | `400` |
| `GET /courses/{slug}` | — | `/courses/[slug]` | param `@Matches(/^[a-z0-9-]{3,120}$/)` | `200 CourseDetail` | `404` |

Chỉ trả khoá `status = PUBLISHED`. `DRAFT` và `ARCHIVED` trả `404` giống hệt slug không tồn tại — không có query param `?preview=`.

**Admin xem trước bằng chính `/learn/*` và `/lessons/{id}/content`**, nhờ nhánh bypass theo vai trò ở mục 6.1 bước 4. `GET /admin/courses/{id}` chỉ trả outline (`SectionOutline`/`LessonOutline`): không có `content`, không có `resources`, không có playback token — nên nó không bao giờ là đường xem trước nội dung. Nếu không có bypass đó thì không có cách nào để chủ sở hữu đọc thử bài viết hay xem thử video trước khi publish, trong khi "xem trước" là điều kiện hoàn thành của phase Catalog trong PROJECT_PLAN.md.

`GET /categories/{slug}` tồn tại vì trang `/categories/[slug]` cần `name`, `description` và `courseCount` để dựng tiêu đề, breadcrumb và meta SEO — `GET /courses?category=slug` chỉ trả khoá học, không trả danh mục. Cache như phần còn lại của catalog (mục 2.3).

`POST /contact` gửi qua seam `Mailer` tới `MAIL_FROM`, không lưu database — không có model `ContactMessage`, và một hộp thư đã là nơi đọc tin nhắn tốt hơn một bảng. `courseSlug` là optional vì UX_PLAN.md §5.1 điều hướng `/contact?course=[slug]` khi checkout còn tắt: đây là **lối vào xin cấp quyền học trong lúc chưa có thanh toán**, nên nó không phải trang phụ mà là một mắt xích của luồng bán hàng ngày đầu. Route này **không** gắn `@SkipCsrf`: form nằm cùng origin nên nó có token như mọi form khác.

Trang chủ **không có endpoint riêng**: khối "Khoá học nổi bật" gọi `GET /courses?pageSize=8`, khối danh mục gọi `GET /categories`, ô tìm kiếm điều hướng sang `/courses?q=`. Không xây `/home-feed`.

`ratingAverage` và `ratingCount` không có đường ghi nào từ người dùng cho tới khi có module đánh giá (PROJECT_PLAN.md hoãn tính năng này): giá trị duy nhất khác `null`/`0` là do seed ghi, và những hàng đó mang `demoStats = true`. Card ẩn cụm sao khi `ratingCount = 0` hoặc `ratingAverage = null`, và gắn `Badge` `Dữ liệu demo` cạnh cụm sao khi `demoStats = true`. Không có endpoint gửi đánh giá. Xem mục 9.

### 5.3 Catalog — soạn nội dung (admin)

Mọi endpoint dưới đây: `ADMIN`, sai vai trò → `404`. Mọi mutation ghi một dòng `AuditLog` với `action` lấy từ **bảng từ vựng đóng ở mục 5.7** — không tự đặt chuỗi mới.

| Method + Path | Trang | Request | 2xx | Lỗi |
|---|---|---|---|---|
| `GET /admin/categories` | `/admin/categories`, `/admin/courses/new` | — | `200 { items: Category[] }` theo `position` | `404` |
| `POST /admin/categories` | `/admin/categories` | `name` `@Length(2,80)` trim; `slug?` `@Matches(slug)` — thiếu thì sinh từ `name` theo quy tắc slug ở UX_PLAN.md §9.4; `description?` `@MaxLength(500)`; `icon?` `@MaxLength(40)` — **tên icon Lucide** (`code-2`), không emoji, không SVG (DATA_MODEL.md) | `201 Category` (position = cuối) | `400`, `404`, `409 SLUG_TAKEN` |
| `PATCH /admin/categories/{id}` | `/admin/categories` | tất cả optional: `name`, `slug`, `description`, `icon` — cùng ràng buộc như trên | `200 Category` | `400`, `404`, `409 SLUG_TAKEN` |
| `DELETE /admin/categories/{id}` | `/admin/categories` | — | `204` | `404`, `409 CATEGORY_NOT_EMPTY` |
| `PUT /admin/categories/order` | `/admin/categories` | `categoryIds` `@IsUUID each @ArrayNotEmpty` | `204` | `400 ORDER_MISMATCH`, `404` |
| `GET /admin/courses` | `/admin/courses` | `q`, `status` csv enum, `page`, `pageSize`, `sort` ∈ `updatedAt`,`title`,`enrollmentCount` | `200 Paginated<CourseCard & { status, updatedAt }>` | `400`, `404` |
| `POST /admin/courses` | `/admin/courses/new` | `title` `@Length(3,160)`; `slug?` `@Matches(slug)` — thiếu thì sinh từ title, bỏ dấu tiếng Việt; `categoryId?` `@IsUUID` | `201 CourseDetail` (`DRAFT`) | `400`, `404`, `409 SLUG_TAKEN` |
| `GET /admin/courses/{id}` | `/admin/courses/[id]` | param UUID | `200 CourseDetail + { status, archivedAt, videoAssets: [{ lessonId, provider, externalId, status, durationSeconds }] }` | `404` |
| `PATCH /admin/courses/{id}` | `/admin/courses/[id]` | tất cả optional: `title` `@Length(3,160)`; `slug` `@Matches(slug)`; `subtitle` `@MaxLength(240)`; `description` `@MaxLength(20000)`; `priceVnd` `@IsInt @Min(0) @Max(100000000)`; `compareAtPriceVnd` `@IsInt @Min(0)`; `level` `@IsEnum(CourseLevel)`; `language` `@MaxLength(10)`; `categoryId` `@IsUUID @IsOptional` (null để gỡ); `learningOutcomes`/`requirements`/`targetAudience` `@IsString({each}) @ArrayMaxSize(12) @MaxLength(200,{each})`; `coverImageKey` `@MaxLength(400)` | `200 CourseDetail` | `400`, `404` |
| `POST /admin/courses/{id}/publish` | `/admin/courses/[id]` | — | `200 CourseDetail` (`PUBLISHED`) — nhận `DRAFT` hoặc `ARCHIVED` làm đầu vào | `404`, `422 COURSE_NOT_PUBLISHABLE`, `409 CONFLICT` khi khoá đã `PUBLISHED` |
| `POST /admin/courses/{id}/unpublish` | `/admin/courses/[id]` | — | `200` (`DRAFT`) — nhận **cả** `PUBLISHED` lẫn `ARCHIVED` làm đầu vào | `404`, `409 CONFLICT` khi khoá đang ở `DRAFT`, `409 COURSE_HAS_ENROLLMENTS` khi khoá còn `Enrollment` `ACTIVE` (bản nháp không cho ai học, PLAN_SUPPLEMENT.md §4.10) |
| `POST /admin/courses/{id}/archive` | `/admin/courses/[id]` | — | `200` (`ARCHIVED`) — chỉ nhận `PUBLISHED` làm đầu vào (DATA_MODEL.md §Chuyển trạng thái) | `404`, `409 CONFLICT` khi khoá không ở `PUBLISHED` |
| `DELETE /admin/courses/{id}` | `/admin/courses` | — | `204` | `404`, `409 COURSE_HAS_ENROLLMENTS` |
| `POST /admin/courses/{id}/sections` | `/admin/courses/[id]/curriculum` | `title` `@Length(1,160)` | `201 SectionOutline` (position = cuối) | `400`, `404` |
| `PATCH /admin/sections/{id}` | `/admin/courses/[id]/curriculum` | `title` `@Length(1,160)` | `200 SectionOutline` | `400`, `404` |
| `DELETE /admin/sections/{id}` | `/admin/courses/[id]/curriculum` | — | `204` | `404`, `409 SECTION_NOT_EMPTY` |
| `PUT /admin/courses/{id}/sections/order` | `/admin/courses/[id]/curriculum` | `sectionIds` `@IsUUID each @ArrayNotEmpty` | `204` | `400 ORDER_MISMATCH`, `404` |
| `POST /admin/sections/{id}/lessons` | `/admin/courses/[id]/curriculum` | `title` `@Length(1,160)`; `type` `@IsEnum(LessonType)` | `201 LessonOutline` | `400`, `404` |
| `PATCH /admin/lessons/{id}` | `/admin/courses/[id]/lessons/[lessonId]` | optional: `title` `@Length(1,160)`; `type` `@IsEnum(LessonType)`; `content` `@MaxLength(50000)`; `videoAssetId` `@IsUUID @IsOptional` (null để gỡ); `isPreview` `@IsBoolean` | `200 LessonOutline & { content, videoAssetId }` | `400`, `404`, `409 VIDEO_ALREADY_ATTACHED` |
| `DELETE /admin/lessons/{id}` | `/admin/courses/[id]/curriculum` | — | `204` (xoá kèm `LessonProgress`) | `404` |
| `PUT /admin/sections/{id}/lessons/order` | `/admin/courses/[id]/curriculum` | `lessonIds` `@IsUUID each @ArrayNotEmpty` | `204` | `400 ORDER_MISMATCH`, `404` |
| `POST /admin/lessons/{id}/resources` | `/admin/courses/[id]/lessons/[lessonId]` | `objectKey` `@IsString @MaxLength(400)`; `filename` `@Length(1,200)`; `contentType` `@IsIn(['application/pdf','application/zip','image/png','image/jpeg','text/plain'])`; `sizeBytes` `@IsInt @Min(1) @Max(MAX_UPLOAD_BYTES)` | `201 Resource` | `400`, `404`, `415 UNSUPPORTED_MEDIA_TYPE` |
| `DELETE /admin/resources/{id}` | `/admin/courses/[id]/lessons/[lessonId]` | — | `204` (xoá cả object trong storage) | `404` |

`COURSE_NOT_PUBLISHABLE` trả đầy đủ lý do trong một lần, không bắt admin sửa từng cái rồi bấm lại:

```json
{
  "statusCode": 422,
  "code": "COURSE_NOT_PUBLISHABLE",
  "message": "Course is not ready to publish",
  "error": "Unprocessable Entity",
  "details": {
    "issues": [
      { "field": "coverImageKey", "reason": "MISSING" },
      { "field": "priceVnd", "reason": "MISSING" },
      { "field": "sections", "reason": "EMPTY" },
      { "lessonId": "9f1c...", "field": "videoAsset", "reason": "NOT_READY" }
    ]
  }
}
```

Mỗi issue **luôn** có `field` và `reason`; `lessonId` chỉ xuất hiện ở issue có `field = videoAsset` hoặc `field = lessons`. Cả hai trục là **danh sách đóng** — không được tự chế thêm giá trị, vì `PublishChecklist` ở `/admin/courses/[id]` render từng dòng bằng bảng dưới đây:

| `field` | `reason` | Điều kiện publish | Dòng tiếng Việt trong `PublishChecklist` |
|---|---|---|---|
| `coverImageKey` | `MISSING` | Đã có ảnh bìa | Chưa có ảnh bìa |
| `description` | `MISSING` | `description` không rỗng | Chưa có mô tả khoá học |
| `description` | `TOO_SHORT` | `description` ≥ 200 ký tự | Mô tả cần ít nhất 200 ký tự |
| `priceVnd` | `MISSING` | `priceVnd > 0` | Chưa đặt giá bán |
| `categoryId` | `MISSING` | Đã chọn danh mục | Chưa chọn danh mục |
| `learningOutcomes` | `EMPTY` | `learningOutcomes` ≥ 1 mục | Chưa có mục "Bạn sẽ học được gì" |
| `sections` | `EMPTY` | ≥ 1 section | Khoá học chưa có chương nào |
| `lessons` | `EMPTY` | Mỗi section ≥ 1 lesson (`lessonId` là section rỗng) | Chương "{title}" chưa có bài học nào |
| `videoAsset` | `MISSING` | Mọi lesson `VIDEO` đã gắn `videoAsset` | Bài "{title}" chưa gắn video |
| `videoAsset` | `NOT_READY` | `stream.getStatus()` trả `ready = true` — đọc trực tiếp, không tin cột đã lưu | Video của bài "{title}" đang được xử lý |
| `lessons` | `MISSING` | Mọi lesson `ARTICLE` có `content` không rỗng | Bài "{title}" chưa có nội dung |
| `previewLesson` | `MISSING` | ≥ 1 lesson `isPreview` | Chưa có bài học thử nào |

`field` ∈ `coverImageKey | description | priceVnd | categoryId | learningOutcomes | sections | lessons | videoAsset | previewLesson`. `reason` ∈ `MISSING | EMPTY | TOO_SHORT | NOT_READY`.

Điều kiện giá là **`priceVnd > 0`**, không phải "đã đặt, kể cả `0`". Lý do ở PLAN_SUPPLEMENT.md §5: không có đường ghi danh nào cho khoá 0 đồng — `PURCHASE` cần một đơn ZaloPay không tạo được, và endpoint checkout ở mục 5.8 đã trả `422 COURSE_NOT_PURCHASABLE` cho `priceVnd = 0`. Một khoá `PUBLISHED` giá 0 là một trang bán hàng không có nút mua nào hoạt động. `CHECK (price_vnd >= 0)` ở tầng database **giữ nguyên** — nó chặn giá âm ở mọi trạng thái; `> 0` là luật của cổng publish, không phải của cột.

**Tính lại `lessonCount` và `totalDurationSeconds` xảy ra ở mọi mutation chạm curriculum, không phải ở publish.** Cụ thể: `POST /admin/sections/{id}/lessons`, `PATCH /admin/lessons/{id}` khi đổi `type` hoặc `videoAssetId`, `DELETE /admin/lessons/{id}`, `DELETE /admin/sections/{id}`, và cả hai `PUT .../order`. Cùng một routine, chạy trong cùng transaction với mutation. Publish chỉ là **một caller nữa** của routine đó.

Lý do phải đổi: không endpoint nào ở trên có điều kiện tiên quyết về `status`, nên thêm hoặc xoá một bài trên khoá đang `PUBLISHED` là chuyện bình thường. Nếu chỉ tính lại lúc publish, `CourseCard.lessonCount` sai cho tới khi có ai đó tình cờ publish lại — và mục 2.3 cache thẻ đó `public, max-age=60`, nên con số sai được phục vụ cho mọi khách. Hai cột phi chuẩn hoá này không được phép lệch với curriculum đang hiển thị.

`description` và `Lesson.content` được **lưu và trả về dạng Markdown thô**. API không render HTML. Sanitize xảy ra đúng một lần, ở renderer phía web. Hai nơi sanitize nghĩa là hai bộ quy tắc sẽ lệch nhau.

### 5.4 Enrollment

| Method + Path | Vai trò | Trang | Request | 2xx | Lỗi |
|---|---|---|---|---|---|
| `GET /enrollments/me` | any | `/my-courses`, `/courses/[slug]`, layout | `page`, `pageSize`, `status` ∈ `ACTIVE`,`REVOKED`; `completed` `@IsBoolean @IsOptional`; `courseId` `@IsUUID @IsOptional`; `sort` mặc định `grantedAt:desc` | `200 Paginated<EnrollmentItem>` | `400`, `401` |
| `GET /admin/enrollments` | ADMIN | `/admin/enrollments` | `courseId`, `userId`, `status`, `page`, `pageSize` | `200 Paginated<AdminEnrollment>` | `400`, `404` |
| `POST /admin/enrollments` | ADMIN | `/admin/users/[id]`, `/admin/enrollments` | `userId` `@IsUUID`; `courseId` `@IsUUID`; `note` `@MaxLength(500) @IsOptional` | `201 AdminEnrollment` lần đầu, `200` nếu đã active | `400`, `404` |
| `DELETE /admin/enrollments/{id}` | ADMIN | `/admin/enrollments` | — | `204`, chuyển `status = REVOKED` (soft), giữ bản ghi + `AuditLog` | `404` |

`note` không có cột riêng trên `Enrollment`; nó đi vào `AuditLog.metadata`, còn người cấp lưu ở `Enrollment.grantedById`. Lý do cấp quyền là dữ liệu kiểm toán, không phải thuộc tính của quyền học.

`POST /admin/enrollments` là **cách duy nhất tạo `Enrollment` cho tới khi module Checkout tồn tại**, và vẫn là tính năng vĩnh viễn sau đó (tặng khoá, xử lý hỗ trợ, hoàn tiền). Cả hai đường đều gọi `enrollmentService.grant()` — chữ ký hàm đã định nghĩa trong DEMO_MODE.md §5.

`GET /enrollments/me` phục vụ hai chỗ: trang `/my-courses` và trạng thái "đã mua" mà layout cần để trang chi tiết khoá học hiển thị nút "Vào học" thay vì "Mua ngay". Đây là lý do `GET /courses/{slug}` được phép cache công khai.

Hai filter thêm vào tồn tại vì hai chỗ tiêu thụ đó cần khác nhau:

| Người gọi | Query | Vì sao |
|---|---|---|
| `/my-courses` tab "Đang học" | `?status=ACTIVE&completed=false` | UX_PLAN.md §2.3 có đúng hai tab |
| `/my-courses` tab "Đã xong" | `?status=ACTIVE&completed=true` | `completed` so `progress.completedLessons === progress.totalLessons` |
| `/courses/[slug]` | `?courseId={id}&pageSize=1` | Trang chi tiết chỉ cần biết một khoá. Không có `courseId` thì nó phải tải hết danh sách phân trang rồi tự dò — một request thừa mỗi lần render trên trang đã cache công khai |

### 5.5 Learning

| Method + Path | Vai trò | Trang | Request | 2xx | Lỗi |
|---|---|---|---|---|---|
| `GET /learn/{courseSlug}` | enrollment **hoặc** `ADMIN` | `/learn/[courseSlug]/[lessonId]` | param slug | `200 { course: CourseDetail, progress: CourseProgress, completedLessonIds: string[], resumeLessonId }` | `401`, `403 NOT_ENROLLED`, `404` |
| `GET /lessons/{lessonId}/content` | enrollment, **hoặc** lesson `isPreview`, **hoặc** `ADMIN` | `/learn/...`, `/courses/[slug]`, `/admin/courses/[id]/lessons/[lessonId]` | param UUID | `200 LessonContent` | `401`, `403 NOT_ENROLLED`, `404` |
| `PUT /lessons/{lessonId}/progress` | any + enrollment | `/learn/...` | `lastPositionSeconds` `@IsInt @Min(0) @Max(86400)`; `completed` `@IsBoolean @IsOptional` | `200 { progress: Progress, courseProgress: CourseProgress }` | `400`, `401`, `403 NOT_ENROLLED`, `404`, `429` |

Với lesson `isPreview` mà người gọi chưa có enrollment: `resources` trả `[]` và `progress` trả `null`. Bài preview không sinh `LessonProgress` — tiến độ chỉ có ý nghĩa với người đã có quyền học.

**Nhánh `ADMIN` là đường xem trước, và nó phải im lặng.** `role = ADMIN` đi qua được cả hai endpoint đọc ở trên cho mọi khoá học ở mọi `status`, không cần `Enrollment`. Đổi lại, lượt xem của admin:

- **không** sinh hay cập nhật `LessonProgress` (`PUT /lessons/{id}/progress` **không** có nhánh admin — nó vẫn đòi `Enrollment` thật);
- **không** tính vào `enrollmentCount` hay bất kỳ số liệu nào ở mục 5.7;
- trả `progress: null` và `courseProgress` với `completedLessons = 0`, giống hệt người xem preview.

Không có nhánh này thì chủ sở hữu nhận `403 NOT_ENROLLED` trên chính khoá mình vừa soạn, và không có đường nào để đọc thử nội dung trước khi publish.

`GET /learn/{courseSlug}` trả `403 NOT_ENROLLED` chứ không `404`, vì khoá `PUBLISHED` là thông tin công khai — che giấu nó không giấu được gì mà lại làm UI không hiển thị được nút "Mua khoá học này". Với khoá không `PUBLISHED`, trả `404` như mọi nơi khác.

`resumeLessonId` là lesson có `LessonProgress.updatedAt` mới nhất; nếu chưa học bài nào thì là lesson đầu tiên theo `(section.position, lesson.position)`. Không có endpoint `/resume` riêng — nó đã nằm sẵn trong response của shell.

### 5.6 Media

| Method + Path | Vai trò | Trang | Request | 2xx | Lỗi |
|---|---|---|---|---|---|
| `POST /lessons/{lessonId}/playback-token` | enrollment, preview, hoặc `ADMIN` | `/learn/...`, `/courses/[slug]`, `/admin/courses/[id]/lessons/[lessonId]` | — | `200 Playback` | `401`, `403 NOT_ENROLLED`, `404`, `409 VIDEO_NOT_READY`, `429` |
| `GET /lessons/{lessonId}/resources/{resourceId}/download` | any + enrollment | `/learn/...` | param UUID | `200 SignedDownload` | `401`, `403 NOT_ENROLLED`, `404` |
| `POST /admin/courses/{id}/cover-upload-url` | ADMIN | `/admin/courses/[id]` | `filename` `@Length(1,200)`; `contentType` `@IsIn(['image/jpeg','image/png','image/webp'])`; `sizeBytes` `@IsInt @Min(1) @Max(MAX_UPLOAD_BYTES)` | `201 SignedUpload` | `400`, `404` |
| `POST /admin/lessons/{id}/resources/upload-url` | ADMIN | `/admin/courses/[id]/lessons/[lessonId]` | `filename` `@Length(1,200)`; `contentType` `@IsIn(['application/pdf','application/zip','image/png','image/jpeg','text/plain'])`; `sizeBytes` `@IsInt @Min(1) @Max(MAX_UPLOAD_BYTES)` | `201 SignedUpload` | `400`, `404`, `415 UNSUPPORTED_MEDIA_TYPE` |
| `POST /admin/videos` | ADMIN | `/admin/courses/[id]/lessons/[lessonId]` | `externalId` `@IsString @Length(1,120)` | `201 { id, provider, externalId, status, durationSeconds, thumbnailUrl }` | `400`, `404`, `409 EXTERNAL_ID_TAKEN` |
| `GET /admin/videos/{id}` | ADMIN | `/admin/courses/[id]/lessons/[lessonId]` | — | `200 { id, provider, externalId, status, durationSeconds, thumbnailUrl }` — gọi `getStatus()` rồi ghi lại `status`/`durationSeconds` | `404` |
| `PUT /media/local/{key}` | chữ ký URL | uploader admin | body byte thô | `204` | `403 SIGNATURE_INVALID`, `404` khi `STORAGE_DRIVER != demo`, `413 PAYLOAD_TOO_LARGE`, `415 UNSUPPORTED_MEDIA_TYPE` |
| `GET /media/local/{key}` | chữ ký URL | mọi nơi hiển thị file | query `exp`, `sig` | `200` file | `403 SIGNATURE_INVALID`, `404` khi `STORAGE_DRIVER != demo` |

`objectKey` **do server sinh**, client không bao giờ chọn. Client chỉ gửi tên file gốc; server tạo key theo template trong DEMO_MODE.md §3 và trả về trong `SignedUpload`. Client không tự đặt key nghĩa là client không thể ghi ra ngoài prefix của mình.

Allowlist `contentType` của tài liệu bài học là **đúng năm giá trị** ở DATA_MODEL.md §LessonResource, ép bằng `@IsIn` chứ không `@IsMimeType`. Đây là biên tin cậy: file admin upload được phát lại cho học viên từ một URL đã ký, nên một `text/html` hay `image/svg+xml` lọt vào là một trang chạy script trên chính origin của mình. Ảnh bìa có allowlist riêng, hẹp hơn (`image/jpeg|png|webp`) vì nó được nhúng trong `<img>` trên trang công khai. DEMO_MODE.md §3 bước 4 của đường `PUT` ép đúng hai allowlist này theo prefix key.

Không có webhook Cloudflare Stream. Một chủ sở hữu upload vài video mỗi tháng — polling `GET /admin/videos/{id}` trong lúc màn hình lesson đang mở là đủ, và webhook thì kéo theo endpoint công khai, xác minh chữ ký và một trạng thái nữa để đồng bộ. Thêm webhook khi upload trở thành hàng loạt.

### 5.7 Reporting

| Method + Path | Vai trò | Trang | Request | 2xx | Lỗi |
|---|---|---|---|---|---|
| `GET /admin/reports/overview` | ADMIN | `/admin` | `from`, `to` `@IsISO8601 @IsOptional`, khoảng tối đa 366 ngày | `200 { revenueVnd, paidPurchases, newStudents, activeEnrollments, draftCourses, pendingPaymentAttempts, videoAssetsNotReady, series: [{ date, revenueVnd, purchases }] }` | `400`, `404` |
| `GET /admin/reports/courses` | ADMIN | `/admin` | `from`, `to` `@IsOptional`, `page`, `pageSize` | `200 Paginated<{ courseId, title, revenueVnd, newEnrollments, activeStudents, completionRate }>` | `400`, `404` |
| `GET /admin/audit-logs` | ADMIN | `/admin/audit-logs` | `actorId`, `entityType`, `action`, `from`, `to`, `page`, `pageSize` | `200 Paginated<AuditLogRow>` | `400`, `404` |

Reporting **chỉ đọc**. Không endpoint nào trong nhóm này được phép ghi.

#### Khoảng thời gian và múi giờ

| Điểm | Quyết định |
|---|---|
| `from` / `to` | Optional. Thiếu cả hai → **30 ngày gần nhất**, tính theo `Asia/Ho_Chi_Minh`. Trang `/admin` mở lần đầu không gửi tham số nào. Mặc định này chỉ áp cho `/admin/reports/*`; `GET /admin/audit-logs` thiếu `from`/`to` trả toàn bộ lịch sử (nhật ký kiểm toán không được ẩn hàng cũ). |
| Gom nhóm ngày | `AT TIME ZONE 'Asia/Ho_Chi_Minh'` trong SQL. Gom theo UTC làm doanh thu lúc 07:00 sáng giờ VN rơi vào ngày hôm trước và toàn bộ biểu đồ lệch một ngày so với UX_PLAN.md §9.3 (mọi hiển thị dùng `Asia/Ho_Chi_Minh`). |
| `series[].date` | Chuỗi `"YYYY-MM-DD"`. **Đây là ngoại lệ duy nhất của mục 2.9** — nó là một *ngày lịch* ở một múi giờ cụ thể, không phải một thời điểm, và ép nó thành ISO UTC sẽ tái tạo đúng lỗi lệch ngày ở trên. |
| `completionRate` | Số thực `0`–`1`, làm tròn 4 chữ số. Tử số: số học viên có `completedLessons = totalLessons`. Mẫu số: số `Enrollment` `status = ACTIVE` của khoá. Mẫu số `0` → `null` (không phải `0`). |

Ba số `draftCourses`, `pendingPaymentAttempts`, `videoAssetsNotReady` là **trạng thái hiện tại, không phụ thuộc `from`/`to`**: chúng đếm toàn bộ `Course status = DRAFT`, `PaymentAttempt status = PENDING`, và `VideoAsset status != READY` tại thời điểm gọi. Chúng có mặt vì UX_PLAN.md §3.3 quy định `/admin` hiện đúng năm ô `StatTile` — ba ô đó không có nguồn dữ liệu nào khác ngoài đây, và gọi thêm ba endpoint list chỉ để đọc `total` là ba round-trip cho ba con số.

#### Từ vựng `action` và `entityType`

`AuditLog.action` là `varchar(64)` tự do ở tầng database (DATA_MODEL.md quyết định đúng: enum sẽ cần `ALTER TYPE` cho mỗi hành động mới). Nhưng API cho lọc theo `action`, và `/admin/audit-logs` hiện cột đó cho người đọc — nên tầng ứng dụng phải có một từ vựng đóng, nếu không mỗi module đặt một chuỗi khác và bộ lọc thành vô dụng.

**Bảng từ vựng đầy đủ nằm ở [DATA_MODEL.md](./DATA_MODEL.md) §AuditLog** — schema là chủ đề của tài liệu đó, và trước đây hợp đồng này, DATA_MODEL.md và ROADMAP.md mỗi nơi tự khai một danh sách đóng khác nhau. Bảng ở đó là bảng hợp nhất: quy tắc đặt tên `{entity}.{verb_past}`, `entityType` là danh sách đóng SCREAMING (`COURSE | SECTION | LESSON | RESOURCE | CATEGORY | ENROLLMENT | USER | PURCHASE | PAYMENT_ATTEMPT | VIDEO_ASSET`), hằng số ở `apps/api/src/audit/actions.ts`. Không chép lại ở đây; một hợp đồng nằm ở hai nơi là hai hợp đồng.

Hai ràng buộc của tầng API, và chúng thuộc về hợp đồng này:

- `entityType` viết SCREAMING vì nó là **giá trị lọc trên query string** của `GET /admin/audit-logs`, không phải tên class — cùng quy ước với mọi enum khác trên dây (mục 2.9).
- Một `action` mới chỉ được thêm cùng với dòng của nó trong bảng ở DATA_MODEL.md. Chuỗi không có trong bảng là bug, không phải tính năng.

Mỗi mutation trong mục 5.3–5.4 và 5.8 ghi đúng một dòng `AuditLog`; cột "Ghi ở" của bảng bên DATA_MODEL.md trỏ ngược lại từng endpoint ở đây.


### 5.8 Checkout — đặc tả bây giờ, xây cuối cùng

Nhóm này đóng băng hợp đồng để trang `/checkout/[courseSlug]` và `/account/orders*` thiết kế được ngay, nhưng chỉ triển khai sau khi Catalog, Enrollment và Learning đã xong (quyết định của chủ sở hữu, ghi trong DEMO_MODE.md §5).

Tham số route checkout là **`courseSlug`**, không phải `purchaseId` — UX_PLAN.md §2.2 sở hữu tên trang, và hình dáng endpoint ép nó: `POST /checkout/{courseSlug}` cố ý trả lại QR còn hạn thay vì tạo giao dịch mới, nên tham số của trang phải là thứ người dùng cầm trong tay **trước khi** có `Purchase`. Giữ `purchaseId` trên URL nghĩa là phải gọi API một lần chỉ để biết đi đâu, và mỗi lần bấm lại sinh một URL khác cho cùng một giao dịch.

| Method + Path | Vai trò | Trang | Request | 2xx | Lỗi |
|---|---|---|---|---|---|
| `POST /checkout/{courseSlug}` | any | `/courses/[slug]` → `/checkout/[courseSlug]` | — | `201 CheckoutSession` khi tạo mới, `200` khi trả lại QR còn hạn | `401`, `403 EMAIL_NOT_VERIFIED`, `404`, `409 ALREADY_ENROLLED`, `422 COURSE_NOT_PURCHASABLE`, `429` |
| `GET /purchases/me` | any | `/account/orders` | `page`, `pageSize`, `status` | `200 Paginated<PurchaseRow>` | `401` |
| `GET /purchases/{id}` | any (chủ sở hữu) | `/checkout/[courseSlug]`, `/account/orders/[id]` | param UUID | `200 PurchaseRow & { attempts: CheckoutSession[] }` — sắp `createdAt` giảm dần, `[]` khi chưa có lần nào | `401`, `404`, `429` |
| `POST /purchases/{id}/refund-request` | any (chủ sở hữu) | `/account/orders/[id]` | `reason` `@Length(10,500)` | `202` — đặt `status = REFUND_REQUESTED`, ghi `AuditLog purchase.refund_requested` với `metadata.reason` | `400`, `401`, `404`, `409 PURCHASE_NOT_REFUNDABLE`, `429` |
| `POST /payments/{provider}/callback` | `@SkipCsrf` | hệ thống | payload đúng schema nhà cung cấp | `200 { return_code: 1, return_message: "success" }` | `200 { return_code: -1 }` khi HMAC sai (không dùng 4xx — nhà cung cấp sẽ retry vô ích) |
| `GET /admin/payments` | ADMIN | `/admin/orders` | `status`, `courseId`, `from`, `to`, `page`, `pageSize`, `duplicatePaid` `@IsBoolean @IsOptional` | `200 Paginated<PurchaseRow & { appTransId, providerTransId }>` | `400`, `404` |
| `POST /admin/payments/{attemptId}/reconcile` | ADMIN | `/admin/orders` | — | `200 { status, changed: boolean }` — gọi `queryOrder` rồi chạy đúng `confirmPayment` | `404`, `409 PAYMENT_EXPIRED` |
| `POST /admin/purchases/{id}/refund` | ADMIN | `/admin/orders` | `reason` `@Length(3,500)`; `force` `@IsBoolean @IsOptional` (mặc định `false`) | `200 PurchaseRow` — đánh dấu `REFUNDED`, thu hồi `Enrollment`, ghi `AuditLog` | `400`, `404`, `409 PURCHASE_NOT_REFUNDABLE` |

Trang checkout **chỉ polling `GET /purchases/{id}`**, mỗi 3 giây, tối đa `CHECKOUT_QR_TTL_MINUTES`. Nó không bao giờ tự kết luận thành công từ redirect, query param hay ảnh chụp màn hình (PROJECT_PLAN.md §Thiết kế thanh toán).

Chuyển tiền thật nằm ngoài hệ thống: `refund` chỉ ghi nhận trạng thái và thu hồi quyền học. Không có API hoàn tiền tự động ở bản đầu.

#### `duplicatePaid=true` — danh sách cần xử lý hoàn tiền

PROJECT_PLAN.md đòi "nếu hai QR cũ/mới đều được thanh toán … đưa giao dịch thừa vào danh sách cần xử lý hoàn tiền". Đây là chỗ ở của yêu cầu đó, và nó **không** cần cột mới trên `PaymentAttempt`: giao dịch thừa tự nhận diện được bằng một truy vấn — `PaymentAttempt.status = SUCCEEDED` trên một `Purchase` có **nhiều hơn một** attempt `SUCCEEDED`. `duplicatePaid=true` chạy đúng truy vấn đó và trả các `Purchase` khớp.

Kèm theo, `confirmPayment` ghi `AuditLog payment.duplicate_paid` (DATA_MODEL.md §AuditLog) khi nó gặp attempt `SUCCEEDED` thứ hai của cùng một `Purchase`. Một cột phi chuẩn hoá `needsRefund` cho một sự kiện đếm trên đầu ngón tay là chi phí không đáng, và nó sẽ phải được đồng bộ ở một đường ghi nữa.

#### Ai chuyển `PaymentAttempt` sang `EXPIRED`

Một job, không phải người bấm nút. `POST /admin/payments/{attemptId}/reconcile` là đường bấm tay để xử lý một ca cụ thể; đường thường trực là tác vụ định kỳ mà PROJECT_PLAN.md §Thiết kế thanh toán bắt buộc.

| Điểm | Quyết định |
|---|---|
| Cách chạy | `setInterval` khởi trong `OnModuleInit`, huỷ trong `OnModuleDestroy`. **Không** thêm `@nestjs/schedule` cho một tác vụ (ROADMAP.md đã chốt). |
| Chu kỳ | `RECONCILE_INTERVAL`, mặc định `60s` |
| Bỏ qua attempt mới | `RECONCILE_MIN_AGE`, mặc định `120s` — tránh đua với callback đang bay |
| Việc làm | Quét `PaymentAttempt` `status = PENDING` cũ hơn `RECONCILE_MIN_AGE` → `queryOrder` → `returnCode = 1` thì dựng payload và gọi đúng `confirmPayment`; `= 2` → `FAILED`; `= 3` → để nguyên. Sau đó, attempt còn `PENDING` mà `expiresAt < now` → ghi `EXPIRED`. |
| Ghi vết | Mỗi lần đổi trạng thái ghi một `AuditLog` `payment.reconciled`, `actorId = null` |

**`GET /purchases/{id}` đọc trạng thái đã lưu, không tính lại tại chỗ.** Nghĩa là trong khoảng giữa lúc QR hết hạn và lúc job chạy, endpoint vẫn trả `PENDING`. Client phải tự so `attempts[0].expiresAt` với đồng hồ của mình để dừng polling và chuyển `QrPanel` sang trạng thái `expired` — không được đợi server đổi `status`. Đây là lý do `CheckoutSession.expiresAt` có mặt trong response.

Tên biến chốt là `RECONCILE_INTERVAL` (giây) + `RECONCILE_MIN_AGE` (giây), cả hai có trong `.env.example` ở DEMO_MODE.md §7. Bản đầu của DEMO_MODE.md đặt tên `RECONCILE_CRON` với giá trị chuỗi cron `"*/5 * * * *"` — sai hình dạng, một chuỗi cron không lái được `setInterval` — và đã được sửa; `@nestjs/schedule` cũng đã bị gỡ khỏi danh sách dependency ở đó. Hai việc (đối soát, và đóng attempt quá hạn) nằm trong **cùng một** lượt chạy, theo đúng thứ tự ở hàng "Việc làm" trên.

#### Chính sách hoàn tiền là điều kiện của endpoint, không phải văn bản trang tĩnh

Quy tắc đã có sẵn ở PLAN_SUPPLEMENT.md §4.5 — hợp đồng này chỉ nói backend enforce nó ở đâu.

`POST /admin/purchases/{id}/refund` trả `409 PURCHASE_NOT_REFUNDABLE` khi bất kỳ điều nào đúng: `Purchase.status` không nằm trong `{PAID, REFUND_REQUESTED}`; đã có `refundedAt`; quá 7 ngày kể từ `paidAt`; tiến độ ≥ 20% số bài; enrollment nguồn `MANUAL_GRANT`; `priceVnd = 0`. Kèm đủ dữ liệu để admin quyết định thay vì phải đi tra:

```json
{
  "statusCode": 409,
  "code": "PURCHASE_NOT_REFUNDABLE",
  "message": "Purchase is outside the refund policy",
  "error": "Conflict",
  "details": { "reason": "OUTSIDE_WINDOW", "paidAt": "2026-08-01T02:00:00.000Z",
               "daysSincePaid": 31, "progressPercent": 8 }
}
```

`details.reason` ∈ `NOT_PAID | ALREADY_REFUNDED | OUTSIDE_WINDOW | PROGRESS_TOO_HIGH | NOT_PURCHASED | FREE_COURSE`.

`force: true` bỏ qua **chỉ** ba điều kiện thuộc chính sách (`OUTSIDE_WINDOW`, `PROGRESS_TOO_HIGH`, `FREE_COURSE`) — đó là quyền quyết định của chủ sở hữu, và PLAN_SUPPLEMENT.md §4.5 vốn đã giao khâu duyệt cho con người. Nó **không** bỏ qua `NOT_PAID`, `ALREADY_REFUNDED` hay `NOT_PURCHASED`: ba cái đó là bất biến dữ liệu, không phải chính sách. Mọi lần `force = true` ghi `AuditLog` `purchase.refunded` với `metadata.forced = true`.

`POST /purchases/{id}/refund-request` là đường của học viên, đúng như PLAN_SUPPLEMENT.md §4.5 mô tả ("Học viên gửi yêu cầu trong `/account/orders`"). Nó chuyển `Purchase.status` từ `PAID` sang **`REFUND_REQUESTED`** và ghi một dòng `AuditLog purchase.refund_requested` với `metadata.reason`. Không có cột `refundRequestedAt` hay `refundReason`: PLAN_SUPPLEMENT.md §4.5 chốt lại rằng trạng thái hoàn tiền là **một giá trị enum**, không phải bốn mốc thời gian rời rạc — bốn cột nullable độc lập cho phép `refundedAt` và `refundRejectedAt` cùng có giá trị, và cho phép hoàn tiền một đơn chưa ai yêu cầu.

Duyệt vẫn là thao tác của admin, và nó có đúng hai lối ra, cả hai đã có trong bảng chuyển trạng thái của DATA_MODEL.md §PurchaseStatus:

| Admin làm gì | Chuyển | `AuditLog` |
|---|---|---|
| Duyệt, chuyển tiền tay xong, bấm "Đã hoàn tiền" (`POST /admin/purchases/{id}/refund`) | `REFUND_REQUESTED → REFUNDED` | `purchase.refund_approved` rồi `purchase.refunded` |
| Từ chối | `REFUND_REQUESTED → PAID` | `purchase.refund_rejected` với `metadata.reason` |

`refund-request` áp cùng bộ điều kiện chính sách ở trên và **không** có `force`. Quyền học không đổi khi đơn ở `REFUND_REQUESTED` — `Enrollment` chỉ bị thu hồi ở bước `REFUNDED`.

### 5.9 Hệ thống và dev

| Method + Path | Vai trò | Trang | 2xx | Ghi chú |
|---|---|---|---|---|
| `GET /health` | — | giám sát | `200 { status: "ok", database: "up", uptimeSeconds }` | Thay thế `GET /api/v1` đang trả `Hello World!`. Không lộ tên driver, version hay biến môi trường. |
| `GET /dev/mail` | ADMIN | terminal | `200` HTML | Chỉ tồn tại khi `MAIL_DRIVER=demo` — xem DEMO_MODE.md §4 |
| `GET /dev/mail/{id}` | ADMIN | terminal | `200` HTML | |
| `POST /dev/payments/{appTransId}/confirm` | ADMIN | `/admin/orders`, `/checkout/[courseSlug]` | `200` | Dựng payload callback thật rồi gọi `checkout.confirmPayment()`. Không tự cấp `Enrollment`. |

`GET /api/v1` bị gỡ. Route không khớp phải trả envelope JSON `404 NOT_FOUND`, không phải trang HTML mặc định của Express.

**`/health` phải mô tả cả nhánh hỏng, nếu không cảnh báo sẽ không bao giờ kêu.**

| Tình huống | Response |
|---|---|
| `SELECT 1` thành công | `200 { status: "ok", database: "up", uptimeSeconds }` |
| `SELECT 1` lỗi **hoặc** quá 2 giây | `503 { status: "degraded", database: "down", uptimeSeconds }` |

Tên field chốt là **`database`**, không phải `db`. Bản đầu của ROADMAP.md dùng `{"status":"ok","db":"ok"}` ở bước cài đặt và ở hai dòng acceptance test; cả ba đã được sửa theo tên này, nếu không hai nửa dự án viết hai kiểu và bài test kiểm một chuỗi không tồn tại. Monitoring cảnh báo khi status khác `200` hai lần liên tiếp.

`MAIL_DRIVER` chỉ có hai giá trị: **`demo | smtp`**. `demo` là `DevInboxMailer` — nó ghi thư ra đĩa và chính là thứ làm hai endpoint `/dev/mail*` ở trên có nội dung để hiển thị. Không có giá trị `log`: một driver chỉ in ra stdout thì hai endpoint đó rỗng, và hợp đồng sẽ mô tả một trang trống. Danh sách giá trị chuẩn của cả bốn biến driver nằm ở DEMO_MODE.md §7 (`VIDEO_DRIVER=demo|cloudflare`, `STORAGE_DRIVER=demo|r2`, `MAIL_DRIVER=demo|smtp`, `PAYMENT_DRIVER=demo|zalopay`). E2E test đọc thẳng thư mục của `DevInboxMailer`, không cần driver thứ ba.

## 6. Quy tắc bắt buộc cho endpoint nhạy cảm

### 6.1 `POST /lessons/{lessonId}/playback-token`

Đây là endpoint duy nhất biến "có tài khoản" thành "xem được video trả phí". Thứ tự kiểm tra, **toàn bộ ở server**, không nhánh nào phụ thuộc driver:

1. `SessionAuthGuard` — bắt buộc, kể cả cho bài preview.
2. Load `Lesson` → `Section` → `Course` trong một truy vấn.
3. `Course.status !== PUBLISHED` và người gọi không phải `ADMIN` → `404`.
4. Cho qua nếu `lesson.isPreview === true`, **hoặc** `auth.user.role === ADMIN`, **hoặc** tồn tại `Enrollment` với `(userId, courseId)` và `status = ACTIVE`. Ngược lại → `403 NOT_ENROLLED`.
5. `lesson.videoAssetId == null` → `404 NOT_FOUND`.
6. `(await stream.getStatus(videoAsset.externalId)).ready !== true` → `409 VIDEO_NOT_READY`.
7. `stream.signPlayback(videoAsset.externalId, PLAYBACK_TOKEN_TTL_SECONDS, auth.user.id)`.
8. Trả `{ playbackUrl, kind, expiresAt }` và **không gì khác**.

Ba chỗ trong danh sách này từng sai và phải giữ nguyên như trên:

- **Bước 4 phải có nhánh `ADMIN`.** Bước 3 đã miễn cho admin việc khoá chưa `PUBLISHED`, nhưng nếu bước 4 không miễn tiếp thì chủ sở hữu nhận `403 NOT_ENROLLED` trên mọi bài không phải preview của chính khoá mình vừa soạn — tức là không có đường xem trước, trong khi "tạo, chỉnh sửa, **xem trước**, publish" là phạm vi PROJECT_PLAN.md đã ghi. Lượt xem của admin không sinh `LessonProgress` và không tính vào số liệu (mục 5.5).
- **Bước 5 phải tồn tại.** Lesson `ARTICLE`, hoặc lesson `VIDEO` chưa gắn video, có `videoAssetId = null`. Không có bước này thì bước 6 đọc `videoAsset.externalId` trên `null` → `TypeError` → `500`, trong khi mục 2.5 quy định trường hợp này là `404`.
- **Bước 6 phải có `await`.** `StreamClient.getStatus(uid)` trả `Promise<{ ready, durationSeconds }>` (DEMO_MODE.md §2). `stream.getStatus(x).ready` là `undefined` trên một Promise, nên `!== true` **luôn đúng** và mọi request đều `409 VIDEO_NOT_READY` — video sẵn sàng hay không cũng vậy. DEMO_MODE.md §2 từng có đúng cùng một dòng thiếu `await` và đã chép lại đủ tám bước ở trên.

Ràng buộc kèm theo:

- Frontend **không bao giờ** nhận `VideoAsset.externalId`, `CLOUDFLARE_STREAM_API_TOKEN`, hay private key. `LessonContent` chỉ có `hasVideo: boolean`. `externalId` chỉ xuất hiện trong `/admin/videos*` và `GET /admin/courses/{id}`.
- Token TTL lấy từ `PLAYBACK_TOKEN_TTL_SECONDS`, gắn với đúng một video UID, không tái sử dụng cho video khác.
- `CLOUDFLARE_STREAM_ALLOWED_ORIGINS` giới hạn domain được nhúng player.
- Không cache: `no-store`.
- Bài preview **vẫn yêu cầu đăng nhập**. Đây là quyết định, không phải sơ suất: nó thu hẹp bề mặt ẩn danh trên đường media xuống 0 và biến preview thành lý do tạo tài khoản. Nếu chủ sở hữu muốn preview ẩn danh kiểu Udemy, đổi đúng bước 1 thành "resolve session nếu có" và giữ nguyên bước 2–8 — nhưng phải chấp nhận rate limit theo IP thay vì theo user.

### 6.2 Không endpoint nào trả password hash

Ba lớp, lớp đầu là lớp thật sự có tác dụng:

1. **Cấu hình Prisma client** `omit: { user: { passwordHash: true } }` trong constructor `PrismaClient`. Mặc định toàn cục là không có field đó. Chỉ `AuthService.login` mở lại bằng `findUnique({ where, omit: { passwordHash: false } })` ở đúng một truy vấn — đã kiểm: truy vấn đó khôi phục `passwordHash: string` trên kiểu trả về, nên `login` chạy nguyên xi.

   **Không phải một dòng config thả vào là xong.** Prisma 7.10 gỡ field khỏi cả *kiểu kết quả*, nên `auth.service.ts` hiện tại không compile: `npx tsc --noEmit` cho `TS2741: Property 'passwordHash' is missing` ở `let user: User` + `user.create(...)` trong `register`, và `TS2322` ở `toAuthUser(session.user)` với `include: { user: true }`. Nhận lớp 1 là nhận đúng bốn thay đổi chữ ký sau, không hơn:

   | Chỗ sửa | Từ | Thành |
   |---|---|---|
   | Khai báo kiểu mới | — | `type SafeUser = Omit<User, 'passwordHash'>` |
   | `register` | `let user: User` | `let user: SafeUser` |
   | `issueSession` | `(user: User)` | `(user: SafeUser)` |
   | `toAuthUser` | `(user: User)` | `(user: SafeUser)` |

   Biến cục bộ trong `login` **giữ nguyên** `User` — nó đến từ truy vấn đã mở lại field.
2. Mọi response chứa user đi qua đúng một projection: `toAuthUser()` đang có trong `auth.service.ts`, và `toAdminUserRow()` cho `/admin/users*`. Không controller nào trả trực tiếp entity Prisma.
3. Một test e2e duyệt body của mọi response `2xx` và fail nếu chuỗi `passwordHash` xuất hiện.

Cùng quy tắc áp cho: `Session` (không trả JWT hay token thô), `AuthToken` (chỉ lưu hash, không trả token qua bất kỳ endpoint nào — token chỉ đi qua email), `ZALOPAY_KEY1/KEY2`, `CLOUDFLARE_*`.

### 6.3 Không phân biệt được "không có quyền" với "không tồn tại"

| Tình huống | Quy tắc |
|---|---|
| `/admin/*` với vai trò không phải ADMIN (kể cả chưa đăng nhập) | `404 NOT_FOUND`, body giống hệt route không tồn tại — do **một** `AdminGuard` duy nhất ném `NotFoundException` ở mọi nhánh thất bại (mục 3.1). |
| `GET /purchases/{id}` không thuộc về người gọi | `404`, không phải `403` |
| `DELETE /users/me/sessions/{id}` không thuộc về người gọi | `404` |
| `GET /courses/{slug}` với khoá `DRAFT`/`ARCHIVED` | `404`, giống hệt slug không tồn tại |
| `POST /auth/login` email không tồn tại vs sai mật khẩu | Cùng `401 INVALID_CREDENTIALS`, cùng message. Nhánh không tìm thấy user **phải giữ nguyên** lệnh `hashPassword(input.password)` đang có trong `auth.service.ts` — đó là thứ làm hai nhánh tốn thời gian tương đương. Xoá dòng đó là mở lại lỗ enumeration. |
| Tài khoản `BLOCKED` đăng nhập | Cùng `401 INVALID_CREDENTIALS`, không có code riêng |
| `POST /auth/password/forgot`, `POST /auth/verify-email/request` | Luôn `202`, thời gian phản hồi không phụ thuộc email có tồn tại |
| Tra cứu admin với id không tồn tại | `404` giống hệt id tồn tại nhưng ngoài phạm vi |

**Điều quy tắc này không che được:** thời gian. `AdminGuard` phải chạy `session.findFirst({ include: { user: true } })` để biết `role`, nên một request có cookie hợp lệ tới `/admin/*` luôn tốn một round-trip database mà một đường dẫn thật sự không tồn tại thì không tốn. Che được là **status code và body**, không phải tín hiệu thời gian. Đừng viết vào tài liệu hay test rằng hai thứ đó không phân biệt được bằng đồng hồ.

**Ngoại lệ có chủ ý:** `POST /auth/register` trả `409 EMAIL_TAKEN`. Nó lộ việc một email đã đăng ký. Giữ nguyên vì form đăng ký cần phân biệt "email đã dùng" với "mật khẩu yếu", hành vi này đã được cài đặt và có test e2e, và rate limit 10 request/phút/IP làm việc dò hàng loạt không khả thi. Đây là đánh đổi được ghi nhận, không phải bỏ sót.

### 6.4 Ranh giới tin cậy khác

- `PUT`/`GET /media/local/{key}`: năm bước kiểm tra trong DEMO_MODE.md §3 là bắt buộc và không được rút gọn — đây là chỗ duy nhất API nhận đường dẫn từ client.
- `POST /payments/{provider}/callback`: xác minh HMAC bằng `key2` **trước** mọi truy vấn database; kiểm `app_id`, `app_trans_id`, và số tiền khớp `PaymentAttempt.amountVnd` trước khi cấp quyền.
- Không mở khoá bằng redirect URL, query param hay bất cứ thứ gì client kiểm soát.
- Không giữ transaction PostgreSQL mở trong lúc gọi mạng sang ZaloPay hay Cloudflare.

## 7. OpenAPI

**Thêm `@nestjs/swagger` ngay, ở phase Catalog. Chưa sinh client.**

Lý do: hợp đồng này có hơn 60 endpoint. PROJECT_PLAN.md đặt điều kiện "chỉ sinh client khi số endpoint đủ lớn để việc viết tay trở nên phiền" — điều kiện đó chưa chạm tới việc *mô tả* hợp đồng, mà việc mô tả thì đã cần thiết ngay: một người vừa viết API vừa viết UI cần một chỗ bấm thử được, và tài liệu Markdown không bao giờ được cập nhật cùng nhịp với code.

Cách làm tối thiểu:

| Việc | Chi tiết |
|---|---|
| Dependency | `@nestjs/swagger` |
| Plugin | `"plugins": ["@nestjs/swagger/plugin"]` trong `nest-cli.json` — suy schema từ kiểu TypeScript và decorator `class-validator` đã có, **không** phải gắn `@ApiProperty` lên từng field |
| Mount | `SwaggerModule.setup('api/v1/docs', ...)` trong `configureApp`, bọc bởi `if (process.env.NODE_ENV !== 'production')` |
| Auth trong UI | `DocumentBuilder().addCookieAuth('elearning_session')` |
| Client | **Chưa sinh.** Web dùng fetch wrapper viết tay có kiểu, và **type response viết tay trong `apps/web`** — không import từ `apps/api`. Sinh client khi wrapper vượt ~400 dòng. |

Vì sao không chia sẻ type qua import: hiện tại **không có specifier nào** phân giải được từ web sang api. Đã kiểm: `apps/web/package.json` không khai báo dependency nào tới package api, và `apps/api/package.json` không có `main`, `types`, hay `exports`. Kể cả sau khi nối được, hai `tsconfig` không tương thích cho source dùng chung (api: `module`/`moduleResolution: nodenext` + `experimentalDecorators` + `emitDecoratorMetadata`; web: `moduleResolution: bundler`, không có cờ decorator), và thứ đáng import nhất — DTO trong `auth.controller.ts` — là class gắn `class-validator`, nên một value import kéo `class-validator` và `reflect-metadata` vào bundle trình duyệt.

Viết tay là lựa chọn lười đúng nghĩa: mục 4 đã liệt kê sẵn mọi shape, và wrapper vốn đã dưới ~400 dòng. Nếu về sau thật sự muốn chia sẻ, đó là năm việc chứ không phải một dòng import — `"api": "workspace:*"` trong `apps/web/package.json`; `"exports": { "./contracts": "./src/contracts/index.ts" }` + `"types"` trong `apps/api/package.json`; `interface` không decorator đặt trong `apps/api/src/contracts/`; chỉ dùng `import type`; `transpilePackages: ['api']` trong `next.config.ts`. Làm cả năm hoặc đừng làm.

Điểm cộng riêng của codebase này: vì `whitelist` và `forbidNonWhitelisted` đều bật, schema OpenAPI sinh từ DTO là **chính xác** — không có field nào được chấp nhận mà không khai báo. Tài liệu không thể trôi khỏi hành vi thật.

Không dùng: `zod` + `nestjs-zod` (thay toàn bộ `class-validator` đang chạy), `tRPC` (bỏ REST, hỏng hợp đồng callback ZaloPay), viết file OpenAPI tay (sẽ lệch trong hai tuần).

## 8. Rate limit

Mở rộng `AuthRateLimitGuard` hiện có thành guard đọc metadata từ decorator `@RateLimit({ limit, windowSeconds, key })`, `key` ∈ `ip` \| `user`. Giữ nguyên `Map` trong process, cách lấy IP qua `X-Real-IP`, header `Retry-After`, và ghi chú `ponytail:` đang có. **Không thêm `@nestjs/throttler`**: 60 dòng đã chạy và có test làm đúng việc đó; đổi sang throttler + Redis khi thật sự chạy từ 2 instance API trở lên.

Hai dòng đầu là hiện trạng, giữ nguyên số.

| Endpoint | Khoá | Cửa sổ | Giới hạn | Ghi chú |
|---|---|---|---|---|
| `POST /auth/register` | ip | 60s | 10 | Đã cài đặt, không đổi |
| `POST /auth/login` | ip | 60s | 10 | Đã cài đặt, không đổi |
| `GET /auth/csrf` | ip | 60s | 60 | Layout gọi mỗi lần tải trang — chỉ an toàn sau khi `csrf()` thành idempotent (mục 1.4) |
| `GET /auth/me` | ip | 60s | 120 | Mọi layout được bảo vệ gọi mỗi lần tải trang. Khoá theo `ip` chứ không `user`: người gọi có thể chưa đăng nhập |
| `GET /enrollments/me` | user | 60s | 60 | Layout learner + trang chi tiết khoá học |
| `POST /contact` | ip | 60s | 3 | Gửi email ra ngoài, form công khai |
| `POST /auth/password/forgot` | ip | 60s | 5 | Gửi email ra ngoài |
| `POST /auth/password/reset` | ip | 60s | 10 | Chống dò token |
| `POST /auth/verify-email/request` | user | 300s | 3 | Gửi email ra ngoài |
| `POST /users/me/password` | user | 300s | 5 | Chống dò `currentPassword` |
| `GET /courses`, `GET /courses/{slug}` | ip | 60s | 120 | Chống cào catalog; đã cache 60s nên người dùng thật không chạm tới |
| `POST /lessons/{id}/playback-token` | user | 60s | 30 | Một bài học sinh 1–2 token; 30 là dư cho seek liên tục |
| `PUT /lessons/{id}/progress` | user | 60s | 60 | Player gửi mỗi 15s + khi pause/seek |
| `GET /lessons/{id}/resources/{rid}/download` | user | 300s | 30 | Chống tải hàng loạt tài liệu |
| `POST /checkout/{courseSlug}` | user | 300s | 5 | Tạo QR là thao tác đắt phía nhà cung cấp |
| `GET /purchases/{id}` | user | 60s | 120 | Trang checkout polling mỗi 3s = 20 req/phút |
| `POST /payments/{provider}/callback` | ip, **chỉ đếm request sai HMAC** | 60s | 20 | Callback hợp lệ không bao giờ bị chặn. Chặn callback thật là mất tiền, còn nguy hiểm hơn thứ đang chống. |
| Mọi mutation trên `/admin/*` (`POST\|PATCH\|PUT\|DELETE`) | user | 60s | 120 | Lưới an toàn chống script hỏng, không phải chống tấn công. Viết `POST /admin/*` là bỏ trống đúng những method sửa và xoá dữ liệu: `PATCH /admin/courses/{id}`, `PUT .../order`, `DELETE /admin/lessons/{id}` |
| `GET` trên `/admin/*` và `/courses/{slug}` phía admin | — | — | — | **Không giới hạn, có chủ ý.** Đọc là thao tác rẻ, người gọi đã qua `AdminGuard`, và một bảng admin lọc nhanh không được biến thành `429` |

Bảng này là danh sách đầy đủ. Endpoint không có mặt ở đây thì **không** có rate limit — nếu ai đó cho rằng một endpoint nên có, thêm dòng vào bảng chứ đừng gắn decorator rồi để tài liệu nói khác.

Response khi vượt: `429` với `code: RATE_LIMITED` và header `Retry-After` tính bằng giây. Không thêm header `X-RateLimit-*` — `Retry-After` đã đủ cho mọi client hiện có.

**Điểm phải xác minh trước khi mở bán:** rate limit theo IP chỉ đúng nếu API nhận được IP thật của người dùng. Sau rewrite `/api/:path*` của Next, request tới API xuất phát từ service `web`. Cần kiểm chứng bằng log trên Railway rằng `X-Real-IP` (hoặc `X-Forwarded-For`) đến được API. Nếu không đến, mọi limit theo `ip` trở thành limit toàn cục và sẽ chặn nhầm người dùng thật — khi đó chuyển các endpoint đã đăng nhập sang `key: 'user'` và đưa `/auth/*` ra sau một proxy giữ được IP. Đây là kiểm chứng bằng lệnh, không phải suy luận.

## 9. Điểm cần chủ sở hữu xác nhận

Hàng đầu tiên **đã được chốt** và đã áp dụng vào DEMO_MODE.md §3/§7 cùng PROJECT_PLAN.md; nó ở lại đây vì hai mục 9.1 và 9.2 ghi các ràng buộc bắt buộc đi kèm. Hai hàng còn lại vẫn là điểm cần chủ sở hữu biết.

| Điểm | Tài liệu khác nói | Ở đây | Lý do và việc đã làm |
|---|---|---|---|
| Ảnh bìa khoá học — **đã chốt** | Bản đầu của PROJECT_PLAN.md: "Ảnh bìa và tài liệu PDF dùng R2 private bucket cùng presigned URL". Bản đầu của DEMO_MODE.md §3 đặt key `courses/{courseId}/cover/{uuid}.{ext}` và ký mọi URL. | `CourseCard.coverUrl` là URL **không ký**, key nằm dưới prefix `public/`. Chỉ `LessonResource` mới private + ký. | Ảnh bìa xuất hiện trên trang công khai, ký nó không bảo vệ được gì mà làm hỏng cache CDN và cache trình duyệt của toàn bộ catalog — mọi lần re-sign là một cache miss cho từng ảnh. Một URL không ký trỏ vào private bucket thì trả `401`, nên PROJECT_PLAN.md phải sửa cùng lúc chứ không thể chọn một nửa. **Đã làm:** key đổi thành `public/courses/{courseId}/cover/{uuid}.{ext}` trong DEMO_MODE.md §3; miễn chữ ký **chỉ ở đường đọc**, theo đúng ba dòng ở 9.1; `publicUrl(key)` thêm vào interface `ObjectStorage`; `R2_PUBLIC_BASE_URL` thêm vào DEMO_MODE.md §7; PROJECT_PLAN.md §Dịch vụ video nói rõ chỉ `LessonResource` dùng private bucket. |
| Preview cần đăng nhập | Chưa tài liệu nào nói rõ. DEMO_MODE.md §2 đặt `SessionAuthGuard` ở bước 1. | `POST /lessons/{id}/playback-token` luôn yêu cầu session, kể cả bài preview. | Đường media không có nhánh ẩn danh nào, và preview trở thành lý do tạo tài khoản. Đánh đổi thật: khách vãng lai phải đăng ký mới xem thử được, khác Udemy. **Nếu chủ sở hữu muốn preview ẩn danh:** sửa đúng bước 1 ở mục 6.1 thành "resolve session nếu có cookie", giữ nguyên bước 2–8, và đổi rate limit của endpoint này sang `key: 'ip'`. |
| Rating trên course card | PROJECT_PLAN.md hoãn "bình luận, đánh giá và hỏi đáp". DATA_MODEL.md §quyết định 3 đã thêm `ratingAverage`, `ratingCount`, `demoStats` phi chuẩn hoá. | Thống nhất với DATA_MODEL.md: ba cột đó được đọc ra công khai, **không có endpoint gửi đánh giá**. `demoStats` cũng được trả ra. | Không phải mâu thuẫn, mà là điểm cần chủ sở hữu biết: cho tới khi có module đánh giá, số sao trên card là số do admin/seed nhập. UI phải ẩn cụm sao khi `ratingCount = 0` và gắn nhãn khi `demoStats = true`. Hiển thị số bịa mà không nói là thứ duy nhất không được phép ở đây. |

### 9.1 Prefix `public/` — miễn chữ ký chỉ ở đường đọc

Ba dòng này là bắt buộc và không được rút gọn. Viết "`LocalFileController` bỏ bước kiểm chữ ký khi key bắt đầu bằng `public/`" mà không nói rõ handler nào là mở một lỗ **ghi file tuỳ ý, không cần xác thực**: `PUT /media/local/{key}` nằm trên cùng controller, chữ ký URL là auth duy nhất của nó, và nó đã gắn `@SkipCsrf`. Bỏ luôn bước ký cho `public/` biến `PUT /api/v1/media/local/public/x.svg` thành một lệnh ghi ẩn danh vào gốc storage — không session, không CSRF, không chữ ký — rồi những object đó lại được phục vụ không ký cho mọi trang catalog (stored XSS bằng một file SVG, cộng với việc bơm đầy đĩa).

1. `LocalFileController.get()` bỏ bước 3 và 4 (kiểm `exp`, kiểm HMAC) khi key khớp `^public/`. Hai bước kiểm đường dẫn giữ nguyên — đó mới là biên tin cậy.
2. `LocalFileController.put()` **luôn** chạy đủ các bước, không có ngoại lệ nào cho `public/`.
3. Thêm bước 0 vào đường `PUT`: key khớp `^public/` mà **không** khớp template ảnh bìa do server sinh (`public/courses/{uuid}/cover/{uuid}.{jpg|png|webp}`) → `403 SIGNATURE_INVALID`. Không có bước này, một URL upload đã ký hợp lệ của admin vẫn có thể bị bẻ sang ghi một đường dẫn công khai tuỳ ý.

### 9.2 `ObjectStorage.publicUrl` — method thứ tư

Bản đầu của interface trong DEMO_MODE.md §3 có đúng ba method — `signedUploadUrl`, `signedDownloadUrl`, `delete` — và không method nào trả về URL không ký, nên `coverUrl` không có nguồn. Ba việc dưới đây phải làm **cùng lúc**, và cả ba đã làm:

| Việc | Chi tiết |
|---|---|
| Interface | `publicUrl(key: string): string` trong `ObjectStorage` (DEMO_MODE.md §3) |
| `LocalDiskStorage` | `publicUrl` → `${API_PUBLIC_URL}/api/v1/media/local/${key}`, không tham số `exp`/`sig` |
| `R2ObjectStorage` | `publicUrl` → `${R2_PUBLIC_BASE_URL}/${key}`; `R2_PUBLIC_BASE_URL` đã có trong `.env.example` (DEMO_MODE.md §7), trỏ tới bucket công khai (hoặc custom domain / `r2.dev` bind vào prefix `public/`) |

Kèm theo, PROJECT_PLAN.md §Dịch vụ video đã sửa: ảnh bìa nằm ở bucket/prefix công khai và **chỉ** `LessonResource` dùng private bucket + presigned URL. Không sửa câu đó thì hai tài liệu nói ngược nhau và người cài đặt phải chọn bừa.
