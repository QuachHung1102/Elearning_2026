# Bổ sung kế hoạch

Tài liệu này chỉ ghi phần **chênh lệch** so với `docs/PROJECT_PLAN.md`. Mọi quyết định trong kế hoạch gốc vẫn còn hiệu lực trừ khi bị gọi tên ở đây. Không lặp lại nội dung kế hoạch gốc.

Bối cảnh mã nguồn tại thời điểm viết: Prisma có 2 model (`User`, `Session`), API có 6 route (5 auth + 1 health), web có 1 trang. Toàn bộ nội dung dưới đây là đặc tả, chưa có code.

## 0. Quyền sở hữu tài liệu và thứ tự ưu tiên

Tài liệu này viết **trước** bốn tài liệu chi tiết dưới đây. Chỗ nào chúng mâu thuẫn với tài liệu này thì **tài liệu chi tiết thắng**, trừ những dòng ghi rõ **chốt lại** trong bản sửa này — đó là quyết định mới và tài liệu kia phải sửa theo.

| Chủ đề | Nguồn sự thật | Tài liệu này còn giữ gì |
|---|---|---|
| Schema, enum, index, cascade, migration, seed | `DATA_MODEL.md` | Chỉ các cột phase 4 chưa có ở đó (§5) |
| Endpoint, envelope lỗi, danh mục mã lỗi, phân trang, sắp xếp/lọc, rate limit | `API_CONTRACT.md` | Chỉ mã lỗi và giới hạn còn thiếu (§4.1) |
| Driver seam, `.env.example`, chặn demo ở production, runbook | `DEMO_MODE.md` | Chỉ nguyên tắc và quyết định (§3) |
| Phase, deliverable, acceptance, Definition of Done | `ROADMAP.md` | Chỉ lý do đảo thứ tự (§2) |
| Route, design token, microcopy tiếng Việt, trạng thái màn hình, a11y | `UX_PLAN.md` | Chỉ ràng buộc phát sinh từ D5 (§1) |

Hệ quả trực tiếp: **không** chép bảng endpoint, bảng enum, bảng copy hay bảng token vào đây. Một hợp đồng nằm ở hai nơi là hai hợp đồng, và cái sai luôn là cái được đọc.

## 1. Năm quyết định mới và tác động lên PROJECT_PLAN.md

| # | Quyết định | Mục của PROJECT_PLAN.md bị ảnh hưởng | Loại tác động |
|---|---|---|---|
| D1 | Catalog hình dạng Udemy: chủ đề rộng, danh mục, tìm kiếm/lọc, thẻ khóa học có rating + số học viên, accordion chương trình học, bài xem thử. Kinh tế vẫn **một chủ sở hữu**. | *Phạm vi chức năng → Khách chưa đăng nhập*; *Các module NestJS → Catalog*; *Mô hình dữ liệu đề xuất* | Mở rộng. Thêm browse/search/filter vào phạm vi công khai; thêm taxonomy vào Catalog và data model. |
| D1 | (tiếp) | *Kết luận kiến trúc* — giả định "mua một lần, học lâu dài, chưa nhiều giảng viên"; *Để sau khi có nhu cầu thực tế* — "nhiều giảng viên và chia doanh thu" | **Không đổi.** Chỉ UX catalog giống Udemy; không có instructor thứ hai, không có revenue share, không có subscription. |
| D2 | Thanh toán làm **cuối cùng**. Seam `Enrollment` tồn tại từ đầu; cấp quyền thủ công là cách có enrollment ở ngày 1. | *Kế hoạch triển khai* | **Đảo thứ tự.** Phase "Thanh toán" và "Trải nghiệm học" hoán vị. Xem §2. |
| D2 | (tiếp) | *Ngôn ngữ nghiệp vụ* — "Mở khóa nghĩa là tạo hoặc kích hoạt `Enrollment` sau khi backend xác minh thanh toán" | **Sửa.** `Enrollment` có hai nguồn hợp lệ ngang nhau: `PURCHASE` và `MANUAL_GRANT`. `ManualGrant` (đã có tên trong kế hoạch) được nâng từ ngoại lệ quản trị thành đường đi chính của giai đoạn đầu. |
| D2 | (tiếp) | *Mô hình dữ liệu* — dòng `Enrollment`: "paymentAttemptId hoặc admin grant" | **Làm rõ.** Thay bằng `source` enum, `purchaseId` và `grantedById`, bất biến ép trong `EnrollmentService.grant()`. Xem §5. |
| D3 | Demo-first: chưa có ZaloPay merchant, Cloudflare, email provider. Mọi phụ thuộc ngoài nằm sau driver seam, chọn bằng env var, có bản demo chạy được. | *Các module NestJS* — "chưa tạo `PaymentProvider` hay `VideoProvider` generic… khi thực sự xuất hiện nhà cung cấp thứ hai mới trích interface" | **Mâu thuẫn được giải bằng chính điều kiện của kế hoạch.** Nhà cung cấp thứ hai đã xuất hiện: bản demo. Điều kiện trích interface đã thỏa mãn nên trích ngay — đây là kích hoạt nguyên tắc đó, không phải vi phạm. Seam chỉ tồn tại ở 4 điểm tích hợp ngoài, không trở thành nguyên tắc chung của codebase. |
| D3 | (tiếp) | *Triển khai*; `apps/api/.env.example` (hiện có đúng 3 biến) | Mở rộng. Thêm biến driver và validate env fail-fast lúc bootstrap. Xem §3. |
| D3 | (tiếp) | *Dịch vụ video: chọn Cloudflare Stream*; *Thiết kế thanh toán ZaloPay* | **Không đổi về lựa chọn.** Cloudflare Stream và ZaloPay vẫn là đích đến. Chỉ hoãn ngày cắm thật; toàn bộ phân tích giá, HMAC, callback, reconcile giữ nguyên và trở thành đặc tả cho driver thật. |
| D4 | Xây đủ cả 5 phase. | *Kế hoạch triển khai*; *Hardening và mở bán* | Xác nhận. Loại bỏ khả năng dừng ở MVP catalog. Thêm hai điều kiện hoàn thành ở phase cuối: thay toàn bộ copy pháp lý placeholder, và tắt mọi demo driver. |
| D5 | UI tiếng Việt. Design system đã chốt (Marketplace/Directory, Flat Design, teal `#0D9488` + CTA `#D97706`, Lexend/Inter, Lucide, 375/768/1024/1440). File thiết kế `design/elearning.pen`. | Toàn bộ kế hoạch gốc — **không có mục nào về UX/UI** | **Lấp chỗ trống.** Không mâu thuẫn với bất kỳ dòng nào. Giá trị token, danh sách màn hình và trạng thái từng màn hình đã được `UX_PLAN.md` chi tiết hóa; `elearning.pen` là bản vẽ, không phải nguồn sự thật. Màn hình chưa có artboard thì **dựng từ token, không nghĩ ra giá trị mới** — không có màu, khoảng cách hay bo góc nào ngoài bảng token. |
| D5 | (tiếp) | *Kế hoạch triển khai → Hardening và mở bán* — "Accessibility cơ bản và responsive" | **Đưa lên sớm.** Sàn a11y (contrast 4.5:1, target 44×44px, focus ring nhìn thấy, điều hướng bàn phím, alt text) là ràng buộc từ component giao diện đầu tiên của Phase 1. Sửa a11y sau khi đã dựng vài chục component là làm lại, không phải sửa. |

## 2. Thứ tự phase sau khi sắp xếp lại

| Cũ | Mới | Thay đổi nội dung |
|---|---|---|
| 1. Nền tảng | 1. Nền tảng | Thêm: 4 driver seam có bản demo, đọc và validate env một lần trong `config.ts` (fail-fast), `AuthToken` + luồng xác minh email chạy trên `MAIL_DRIVER=demo`, design token và layout shell. **Không** thêm taxonomy và **không** thêm `Enrollment` ở đây: cả hai cần bảng `courses`, nên nằm ở migration 3 và 4 của `DATA_MODEL.md`. |
| 2. Catalog và quản trị nội dung | 2. Catalog và quản trị nội dung | Thêm: danh mục, tìm kiếm, bộ lọc, thẻ khóa học, trang chi tiết kiểu Udemy; dùng design token và layout shell đã có từ Phase 1. |
| 3. Thanh toán | 3. Trải nghiệm học | Chạy được đầy đủ với enrollment cấp thủ công. `EnrollmentService.grant()`, `AuditLog` và màn hình admin cấp/thu hồi quyền học ra đời ở đây, cùng migration `add_learning`. Điều kiện hoàn thành của kế hoạch gốc giữ nguyên, trừ mệnh đề "sau khi callback hoàn tất" đổi thành "sau khi có Enrollment active". |
| 4. Trải nghiệm học | 4. Thanh toán | Toàn bộ nội dung và điều kiện hoàn thành của kế hoạch gốc giữ nguyên từng chữ. Thêm: thu thập thông tin xuất hóa đơn, luồng yêu cầu hoàn tiền. |
| 5. Hardening và mở bán | 5. Hardening và mở bán | Thêm: thay copy pháp lý, tắt demo driver, kiểm tra a11y bằng bàn phím và trình đọc màn hình. |

Lý do đảo: phase 3 mới không phụ thuộc gì vào phase 4. Phase 4 thì phụ thuộc vào phase 3 — phải có thứ gì đó để mở khóa. Thứ tự cũ buộc phải chờ hợp đồng merchant mới nhìn thấy sản phẩm chạy.

Bảng trên chỉ ghi **cái gì đổi** so với PROJECT_PLAN.md. Deliverable, file, migration, test và acceptance đầy đủ của từng phase nằm ở `ROADMAP.md` §5–§9; điều kiện chung cho mọi phase (gồm cả `prisma migrate deploy` chạy sạch trên database trống) nằm ở bảng Definition of Done `ROADMAP.md` §4. Một phase được coi là xong khi thỏa cả hai, không phải khi thỏa dòng trong bảng này.

## 3. Driver seam và biến môi trường

Bốn điểm tích hợp ngoài, mỗi điểm **một** interface đặt tên theo nhà cung cấp thật và **đúng hai** lớp cài đặt, chọn bằng `useClass` với một biểu thức ba ngôi lúc khai báo module. Không factory, không registry, không plugin.

Đặc tả đầy đủ của cả bốn seam — tên token, chữ ký từng method, mẫu wiring, cách override trong test — nằm ở `DEMO_MODE.md` §1–§5. Bảng dưới chỉ để đối chiếu nhanh và ghi ba quyết định mà bản đầu của tài liệu này ghi sai.

| Seam | Token / interface | Bản demo | Bản thật |
|---|---|---|---|
| Video | `STREAM_CLIENT` / `StreamClient`: `getStatus`, `signPlayback(externalId, ttl)` | `LocalStreamClient` trả `kind: 'mp4'` và một URL **có chữ ký, có hạn thật** trên route media dùng chung — xem rủi ro 3 ở §6. | `CloudflareStreamClient` |
| File | `OBJECT_STORAGE` / `ObjectStorage`: `signedUploadUrl`, `signedDownloadUrl`, `publicUrl`, `delete` | `LocalDiskStorage` + `GET`/`PUT /api/v1/media/local/*key`, ký HMAC có method trong chuỗi ký. Ảnh bìa nằm dưới prefix `public/` và đọc bằng URL **không ký**; đường `PUT` không có ngoại lệ nào. Header `Content-Type`/`Content-Disposition` suy theo prefix key (`DEMO_MODE.md` §3). | `R2ObjectStorage` |
| Email | `MAILER` / `Mailer`: `send` | `DevInboxMailer`: một dòng JSON ra stdout kèm link đầy đủ, cộng một file `.eml` và hộp thư dev `GET /api/v1/dev/mail`. | `SmtpMailer` |
| Thanh toán | `ZALOPAY_CLIENT` / `ZaloPayClient`: `createOrder`, `queryOrder`, `verifyCallback` | `DemoZaloPayClient` không gọi mạng. Nút "đã trả tiền" gọi `POST /api/v1/dev/payments/:appTransId/confirm`, route này dựng payload callback đúng schema rồi gọi **đúng** `checkout.confirmPayment()` mà callback thật gọi. | `ZaloPayHttpClient` |

Ba đính chính so với bản đầu, **chốt lại**:

1. **Không có khóa HMAC thứ hai.** Bản đầu cho bản demo POST thẳng vào endpoint callback thật với chữ ký bằng `PAYMENT_DEMO_KEY2`. Làm vậy là dạy bộ xác minh callback ở production chấp nhận hai khóa, và ai biết một secret hạng dev sẽ tự mở khóa mọi khóa học trả phí. `verifyCallback` là thành viên của seam, chỉ dùng `ZALOPAY_KEY2`; đường demo đi qua `DevModule` — module này **chỉ được import khi có ít nhất một driver ở giá trị demo**, nên ở production route không tồn tại. Lợi ích đã hứa (idempotency thật, transaction cấp Enrollment thật) giữ nguyên vì cả hai đường cùng gọi một hàm. Biến `PAYMENT_DEMO_KEY2` bị xóa.
2. **Không có cờ bỏ qua kiểm tra.** `ALLOW_DEMO_DRIVERS_IN_PRODUCTION` bị xóa. Một kiểm tra an toàn có công tắc tắt được ghi trong `.env.example` thì sớm muộn sẽ bị tắt. Quy tắc thành vô điều kiện: `NODE_ENV === 'production'` **hoặc** `RAILWAY_ENVIRONMENT_NAME === 'production'`, mà bất kỳ biến driver nào không **đúng bằng** chuỗi chọn bản thật — gồm cả `demo`, chuỗi rỗng và chưa được set — thì `assertNoDemoDriversInProduction()` throw ở dòng đầu `main.ts`, trước `NestFactory.create` (`DEMO_MODE.md` §6). Cần một môi trường giống production nhưng dùng driver demo thì đặt tên environment khác `production`. **Không** kiểm bằng `RAILWAY_ENVIRONMENT_ID`: Railway đặt biến đó ở **mọi** environment, nên dùng nó thì service staging/sandbox không boot nổi với `MAIL_DRIVER=demo` — đúng kịch bản chạy bộ test QC ZaloPay mà `PROJECT_PLAN.md` §Triển khai đòi. Đây là sự thật kiểm chứng được về Railway, và `DEMO_MODE.md` §6 sở hữu quy tắc này.
3. **Cột `provider`/`storage` trên bản ghi không dùng để chọn driver.** Mỗi seam chỉ có một instance, chọn bằng env; `VideoAsset.provider`, `LessonResource.storage`, `Course.coverImageStorage` tồn tại để kiểm toán và để biết cái gì cần chuyển đổi khi cắm dịch vụ thật. Vì thế phase 5 có thêm một mục checklist: **không khóa `PUBLISHED` nào còn tham chiếu asset `DEMO` khi driver thật đã bật** — một truy vấn, chạy trước khi mở bán. Đây là chỗ đau duy nhất của việc chọn driver bằng env, và nó rẻ hơn một bộ resolver theo từng hàng.

`.env.example` đầy đủ, kèm chú thích từng biến và đánh dấu biến nào chỉ bắt buộc ở bản thật, nằm ở `DEMO_MODE.md` §7; thứ tự các biến mọc theo phase nằm ở `ROADMAP.md` §2.3. Không lặp lại danh sách ở đây. Hai bổ sung cho danh sách đó, **chốt lại**:

- Tách `AUTH_TOKEN_TTL_MINUTES` thành `EMAIL_VERIFY_TTL_MINUTES=1440` và `PASSWORD_RESET_TTL_MINUTES=60`. Một biến chung buộc hai loại token có cùng hạn, mà hai loại này không cùng rủi ro: link đặt lại mật khẩu là chìa khóa tài khoản nên phải ngắn, link xác minh email thì người ta mở vào tối hôm sau.
- Credential thật (`ZALOPAY_*`, `CF_*`, `R2_*`, `SMTP_*`) giữ nguyên trong `.env.example` dưới dạng khóa rỗng có nhãn `[PROD]`, không xóa. Biến không được ghi ở đâu là biến sẽ bị quên khi tới lúc cần.

Khi có driver demo đang bật, web hiển thị banner `DemoNotice` ở mọi trang; chuỗi và điều kiện hiển thị lấy ở `UX_PLAN.md` §6.3.

## 4. Khoảng trống kế hoạch chưa xử lý

### 4.1 Xác minh email

**Quyết định: tài khoản chưa xác minh vẫn đăng nhập được và vẫn học được; chỉ bị chặn ở bước tạo thanh toán, kèm banner thường trực.**

| Hành vi | Khi chưa xác minh |
|---|---|
| Đăng nhập, xem catalog, xem bài học thử | Cho phép |
| Học khóa đã có Enrollment (kể cả do admin cấp) | Cho phép |
| Bắt đầu checkout / tạo `PaymentAttempt` | **Chặn**, trả `403` với mã lỗi `EMAIL_NOT_VERIFIED` |
| Nhận Enrollment do admin cấp thủ công | Cho phép |

Bài học thử **vẫn yêu cầu đăng nhập** — không phải yêu cầu xác minh email. Quyết định và lý do ở `API_CONTRACT.md` §6.1; `ROADMAP.md` §6 đã được sửa để dùng cùng quy tắc này.

Lý do: chặn đăng nhập giết luôn luồng demo khi chưa có nhà cung cấp email; chỉ hiện banner thì email dùng cho hóa đơn, hoàn tiền và khôi phục tài khoản có thể sai vĩnh viễn. Chặn đúng tại điểm mà email bắt đầu mang nghĩa vụ tài chính và pháp lý. Vì thanh toán làm cuối cùng, ràng buộc này thực tế không cản trở gì trong phase 1–3.

Chi tiết: `AuthToken` lưu hash token, `type = EMAIL_VERIFICATION` (đúng giá trị enum trong `DATA_MODEL.md`), hạn `EMAIL_VERIFY_TTL_MINUTES=1440`, dùng một lần. Banner đóng được theo phiên nhưng quay lại sau mỗi lần đăng nhập.

Hai điều bản đầu ghi sai, **chốt lại**:

- **`AuthRateLimitGuard` hiện tại không làm được việc này.** Đã đọc `apps/api/src/auth/auth-rate-limit.guard.ts`: `LIMIT = 10` và `WINDOW_MS = 60_000` là hằng số module, khóa đếm là `` `${clientIp}:${request.path}` `` — không có decorator, không có tham số, không có khóa theo user; và `auth.module.ts` khai guard trong `providers` mà **không** `exports`, nên module khác không inject được. Guard phải được **tham số hóa** thành `@RateLimit({ limit, windowSeconds, key })` với `key ∈ 'ip' | 'user'` đúng như `API_CONTRACT.md` §8 đã đặc tả, giữ nguyên `Map` trong process, cách lấy IP qua `X-Real-IP` và ghi chú `ponytail:`. Mỗi `key` một bucket riêng: lưu lượng media không được phép đẩy bộ đếm đăng nhập ra khỏi `Map` khi chạm ngưỡng 10.000 khóa. Bảng endpoint → khóa → cửa sổ → giới hạn là của `API_CONTRACT.md` §8; giá trị cho việc gửi lại thư xác minh là **3 lần / 300 giây / user**, không phải 3 lần/giờ.
- **`EMAIL_NOT_VERIFIED` phải nằm trong danh mục mã lỗi.** Mã này được thêm vào `API_CONTRACT.md` §2.5 với status `403`, kèm một dòng trong bảng dịch §2.5b và một mục trong cột Lỗi của `POST /checkout/{courseSlug}` (§5.8). Envelope, cách frontend map mã sang tiếng Việt và mọi mã còn lại đều do tài liệu đó sở hữu.

Mọi thời hạn khác của hệ thống đã có số cụ thể và có chú thích trong `.env.example` ở `DEMO_MODE.md` §7 (playback token, signed URL tải file, hạn QR, chu kỳ reconcile), không chép lại ở đây. Đúng một con số chưa được ghi ở tài liệu nào: **phiên đăng nhập dài 7 ngày, tuyệt đối, không gia hạn trượt, không có "ghi nhớ đăng nhập"** — đọc từ `SESSION_DURATION_SECONDS` trong `apps/api/src/auth/auth.constants.ts`, là hằng số đang chạy và cũng là `maxAge` của cả hai cookie. Đổi nó là đổi code, không phải đổi env.

### 4.2 Phân loại khóa học

Kế hoạch gốc không có bất kỳ model phân loại nào. Catalog kiểu Udemy cần browse và filter.

**Quyết định: thêm một model `Category` phẳng, cộng các trường vô hướng trên `Course`. Không có bảng `Tag`, không có cây hai cấp.**

- `Category`: `slug` unique, `name`, `description`, `icon` (tên icon Lucide), `position`. **Một cấp.** Bản đầu của tài liệu này đề xuất `parentId` self-relation và bắt `Course.categoryId` trỏ vào danh mục cấp 2; `DATA_MODEL.md` đã bác cả hai và đúng: seed có 8 danh mục, một cây hai cấp trên 8 nút chỉ thêm một quy tắc "phải là lá" phải tự ép ở tầng ứng dụng và một cấp điều hướng rỗng. Cây hai cấp nằm trong danh sách "cố ý chưa đưa vào".
- `Course.categoryId` **nullable**, không bắt buộc. Khóa được tạo ở trạng thái `DRAFT` trước khi biết nó thuộc chủ đề nào; "phải có `categoryId`" là một điều kiện của cổng publish, không phải của việc tạo hàng. Danh sách điều kiện publish đầy đủ ở `API_CONTRACT.md` §5.3.
- **Không có `Course.tags`.** Bản đầu đề xuất `String[]` + GIN index cho tìm kiếm và "khóa liên quan". Không tài liệu nào khác có cột này và không tính năng nào cần nó: tìm kiếm đã có `searchText` (§4.3), còn "khóa liên quan" là cùng `categoryId`. Bỏ.
- `Course.level`: enum `BEGINNER | INTERMEDIATE | ADVANCED | ALL_LEVELS`.
- `Course.language`: mặc định `vi`. Đây là thuộc tính của nội dung khóa học, không liên quan tới i18n giao diện ở §4.9.
- Danh mục do seed tạo từ fixture commit trong repo và có màn hình CRUD trong admin ở phase 2 (`ROADMAP.md` §6). Cây chủ đề cụ thể là dữ liệu seed, thuộc `DATA_MODEL.md`.

Bộ lọc trên trang catalog: danh mục, cấp độ, khoảng giá. Sắp xếp: nhiều học viên nhất (mặc định), mới xuất bản nhất, giá, rating. Cách mã hóa từng tham số (`sort=<field>:<asc|desc>`, lọc csv, `priceVndMin`/`priceVndMax`, `page`/`pageSize`) là quy ước toàn cục của `API_CONTRACT.md` §2.7–§2.8 và bảng endpoint §5.2 — không phát minh cú pháp riêng cho catalog. Hai bộ lọc bị bỏ so với bản đầu: **thời lượng theo nhóm** (không có cột nào để lọc rẻ, và người mua khóa học không lọc theo giờ) và **rating tối thiểu** (mọi khóa thật đều có `ratingAverage = null` cho tới khi có module đánh giá, nên bộ lọc này hoặc ẩn cả catalog hoặc không lọc gì).

### 4.3 Tìm kiếm

**Quyết định, chốt lại: một cột `Course.searchText` lưu sẵn bản đã bỏ dấu và viết thường, truy vấn bằng `contains` của Prisma. Không `tsvector`, không `unaccent`, không `$queryRaw`.** Dòng này thay thế cả ba phát biểu đang mâu thuẫn nhau: §4.3 bản đầu (tsvector), `API_CONTRACT.md` §2.8 ("`ILIKE` … qua `unaccent`, chuyển sang `tsvector` khi vượt ~500 khóa") và `ROADMAP.md` §6. `DATA_MODEL.md` phải thêm cột này vào model `Course`.

Vấn đề cần giải vẫn y nguyên: người Việt gõ không dấu, và "lap trinh" phải khớp "Lập trình". Chỉ là cách giải bằng `tsvector` **không chạy**. Đã kiểm bằng lệnh trên chính PostgreSQL 18.4 đang cài ở máy dev, không phải bằng suy luận:

| Câu lệnh | Kết quả |
|---|---|
| `select provolatile from pg_proc where proname='unaccent'` | `s` — STABLE, không phải IMMUTABLE |
| `select provolatile from pg_proc where proname='array_to_string'` | `s` — STABLE |
| `ALTER TABLE … ADD COLUMN sv tsvector GENERATED ALWAYS AS (to_tsvector('simple', unaccent(title))) STORED` | `ERROR: generation expression is not immutable` |
| `… GENERATED ALWAYS AS (to_tsvector('simple', array_to_string(tags,' '))) STORED` | `ERROR: generation expression is not immutable` |
| `CREATE INDEX ON courses (unaccent(title))` | `ERROR: functions in index expression must be marked IMMUTABLE` |

Câu cuối là câu giết luôn cả phương án dự phòng: bản `ILIKE … unaccent(title)` của `API_CONTRACT.md` cũng không index được. Muốn giữ `tsvector` thì phải viết một wrapper `IMMUTABLE` bọc `unaccent` với từ điển ghi cứng, đặt nó cùng `CREATE EXTENSION` và cột generated vào một `migration.sql` sửa tay sau `prisma migrate dev --create-only`, khai `searchVector` là `Unsupported("tsvector")?`, và chấp nhận rằng `prisma migrate diff` đọc biểu thức generated thành một `DEFAULT` nó không biểu diễn được rồi sinh ra `ALTER COLUMN … DROP DEFAULT` — câu lệnh mà PostgreSQL từ chối thi hành trên cột generated. Nghĩa là mỗi lần `prisma migrate dev` sau đó lại đẻ một migration làm hỏng `prisma migrate deploy` trên database trống, tức là phá đúng điều kiện hoàn thành D6 của `ROADMAP.md` §4. Đó là ba cơ chế mới và một cái bẫy CI, cho một catalog dưới vài trăm khóa.

Cách làm thay thế, toàn bộ là một cột và một hàm mười dòng:

- `Course.searchText`: `title + ' ' + subtitle` đã qua chuẩn hóa NFD → bỏ dấu thanh → `đ`/`Đ` thành `d` → chữ thường. Đúng hàm đã dùng để sinh slug (`UX_PLAN.md` §9.4), chỉ khác là không thay khoảng trắng bằng gạch ngang.
- Ghi lại trong cùng transaction với mọi thao tác tạo/sửa `Course` chạm `title` hoặc `subtitle`. Không trigger, không extension.
- Truy vấn: chuẩn hóa `q` bằng chính hàm đó rồi `where: { status: 'PUBLISHED', searchText: { contains: qNormalized } }`. Nằm trong query builder có kiểu của Prisma, nên không có bề mặt SQL injection trên endpoint công khai và không thể quên mệnh đề `status` — hai rủi ro có thật của phương án `$queryRaw`.
- Không index ở bản đầu. Seq scan trên vài trăm hàng ngắn là micro giây. Ngưỡng nâng cấp: khi `EXPLAIN ANALYZE` của `GET /courses?q=` vượt 50 ms, thêm `pg_trgm` + một GIN index trên đúng cột này — không phải đổi thiết kế, chỉ thêm index.

Ngưỡng đánh giá lại vẫn như cũ: cần chịu lỗi chính tả, gợi ý "có phải bạn tìm" hoặc xếp hạng theo facet thì đó là lãnh địa của search engine, và kế hoạch gốc đã hoãn.

### 4.4 Rating và đánh giá

Kế hoạch gốc hoãn "bình luận, đánh giá và hỏi đáp". Thẻ khóa học kiểu Udemy lại hiển thị rating. Cách xử lý trung thực gồm ba phần:

1. **Thêm trường tổng hợp ngay bây giờ**: `Course.ratingAverage Decimal(2,1)?` và `Course.ratingCount Int @default(0)`. Chưa có đường ghi nào. Mặc định `null` / `0`. Kiểu `Decimal` chứ không `Float`, theo đúng quy ước "không dùng float" của kế hoạch gốc.
2. **Chưa xây tính năng viết đánh giá** — giữ nguyên quyết định hoãn của kế hoạch gốc. Khi tính năng đó ra đời, nó chỉ thêm bảng `Review` và một đường cập nhật hai trường trên; bố cục thẻ khóa học không phải sửa.
3. **Không bao giờ bịa số mà không có nhãn.** `ratingCount = 0` thì thẻ **không** vẽ sao (`UX_PLAN.md` §6.3 chốt là ẩn hẳn cụm sao, không hiện "Chưa có đánh giá").

Dữ liệu seed: cờ tên là **`Course.demoStats`**, không phải `isSeed`. Hai cái không cùng nghĩa — "do seed tạo ra" khác "đang mang số bịa" — và cái cần cho UI là cái thứ hai. `DATA_MODEL.md` §Quy tắc nhãn dữ liệu demo sở hữu quy tắc này; ba điểm phải nhớ ở đây:

- Số bịa gồm đúng **hai** trường: `ratingAverage` (4,4–4,9) và `ratingCount` (35–420). **`enrollmentCount` không bao giờ bịa** — seed ghi đúng số hàng `Enrollment` `ACTIVE` mà chính nó tạo ra, rồi từ đó cột này tăng/giảm trong cùng transaction như mọi khóa khác. Bất biến "`enrollmentCount` = số hàng `Enrollment` `ACTIVE`" phải đúng ở **mọi** thời điểm, kể cả ngay sau khi seed; bịa nó nghĩa là sau lần cấp quyền tay đầu tiên giá trị thành "bịa + thật", một con số không trả lời được câu hỏi nào và không có phép tính nào tách lại được.
- Badge "Dữ liệu demo" đứng **chỉ ngay cạnh cụm sao**, không đứng cạnh số học viên — số học viên là số thật nên gắn nhãn demo lên nó là nói dối theo chiều ngược lại. Mọi DTO khóa học trả `demoStats`; không tầng nào được lọc bỏ.
- Tắt cờ là một thao tác admin tường minh, và nó đặt lại `ratingAverage = null`, `ratingCount = 0`. Nó **không** đụng `enrollmentCount` — không có gì để tính lại. Đó là thứ biến quy tắc thành cấu trúc thay vì lời hứa.

Ngoài dữ liệu seed, `enrollmentCount` là số thật: tăng/giảm trong cùng transaction với việc `Enrollment` **chuyển vào hoặc rời khỏi** `ACTIVE` — theo trạng thái, không theo việc chèn hàng. Cấp lại quyền cho một hàng đã `REVOKED` là một lần `UPDATE` trên hàng cũ (unique `(userId, courseId)`), nên đếm theo lần chèn sẽ đếm thiếu, còn đếm theo mọi lần gọi `grant()` sẽ đếm thừa.

### 4.5 Chính sách hoàn tiền

| Khoản | Giá trị |
|---|---|
| Cửa sổ | 7 ngày kể từ `Purchase.paidAt`, tính theo **`Asia/Ho_Chi_Minh`** — đây là con số đăng trên trang `/refund` nên phải khớp múi giờ người đọc đang sống |
| Điều kiện | `completedLessons / Course.lessonCount < 0.20`, so sánh **chặt, không làm tròn** (đếm `LessonProgress.completedAt`). Khóa 7 bài: 1 bài xong là 14,3% — vẫn được hoàn; 2 bài là 28,6% — không |
| Không áp dụng | Enrollment cấp thủ công (không có đơn hàng để hoàn); tài khoản bị khóa do lạm dụng |
| Quy trình | Học viên gửi yêu cầu trong `/account/orders` → admin duyệt hoặc từ chối → admin **chuyển tiền thủ công** qua portal merchant → admin bấm "Đã hoàn tiền" |
| Hệ quả với Enrollment | `status = REVOKED` ngay khi admin duyệt. Không xóa bản ghi. |
| Hệ quả với dữ liệu học | `LessonProgress` **giữ nguyên**, để nếu mua lại thì tiến độ còn nguyên |
| Ghi vết | Một `AuditLog` cho mỗi lần yêu cầu, duyệt, từ chối và đánh dấu đã hoàn, kèm actor và lý do |
| Thông báo | Duyệt và từ chối đều gửi một email qua `MAILER` (tag mới `refund-resolved`). Gửi yêu cầu thì không — người dùng vừa bấm nút, họ đang nhìn màn hình |

Không gọi Refund API của cổng thanh toán ở bản đầu. Với lưu lượng một chủ sở hữu, hoàn tiền là sự kiện hiếm, và thao tác trên portal an toàn hơn một đường code hiếm khi được chạy.

**Trạng thái hoàn tiền là một cột, không phải bốn mốc thời gian rời rạc.** Bản đầu đề xuất `refundRequestedAt`, `refundReason`, `refundedAt`, `refundRejectedAt` nằm cạnh nhau trên `Purchase` — bốn cột nullable độc lập mã hóa một máy trạng thái năm trạng thái, cho phép cả `refundedAt` lẫn `refundRejectedAt` cùng có giá trị, và cho phép hoàn tiền một đơn chưa ai yêu cầu. Thay bằng: thêm đúng **một** giá trị `REFUND_REQUESTED` vào enum `PurchaseStatus` đã có (`PENDING | PAID | REFUND_REQUESTED | REFUNDED | CANCELLED`), giữ `paidAt`/`refundedAt` như `DATA_MODEL.md` đã có, và **không** thêm cột nào khác. Chuyển trạng thái hợp lệ:

```
PAID → REFUND_REQUESTED → REFUNDED        (admin duyệt rồi chuyển tiền)
PAID → REFUND_REQUESTED → PAID            (admin từ chối)
```

Lý do của học viên và ghi chú của admin đi vào `AuditLog.metadata`, đúng theo tiền lệ đã chốt cho `note` của cấp quyền thủ công (`API_CONTRACT.md` §5.4): lý do là dữ liệu kiểm toán, không phải thuộc tính của đơn hàng. Không có model `RefundRequest`, không có cột `refundReason`.

Bốn nhãn tiếng Việt cho cột trạng thái ở `/account/orders` và tên endpoint tương ứng thuộc `UX_PLAN.md` và `API_CONTRACT.md`; điều tài liệu này chốt là **có bốn trạng thái**, không phải bốn cột.

### 4.6 Thuế GTGT và hóa đơn điện tử

**Nghĩa vụ:** bán khóa học trực tuyến cho người mua tại Việt Nam là cung cấp dịch vụ có thu tiền. Người bán phải đăng ký kinh doanh, kê khai nghĩa vụ thuế theo loại hình đã đăng ký, và xuất hóa đơn điện tử cho giao dịch theo quy định hiện hành. Cổng thanh toán cũng yêu cầu pháp nhân hoặc hộ kinh doanh hợp lệ trong hồ sơ merchant — nên nghĩa vụ này chặn cả việc mở thanh toán thật, không chỉ chặn phần kế toán.

Thuế suất áp dụng, ngưỡng doanh thu và loại hình đăng ký phù hợp **không được quyết trong tài liệu kỹ thuật**; phải hỏi kế toán trước khi mở bán.

**Bản demo sẽ làm:**

- `Course.priceVnd` là **giá gộp** — đúng số tiền người mua trả. Không tách VAT ở tầng ứng dụng, không có trường `priceExVat`.
- `Purchase` chụp thông tin xuất hóa đơn tại thời điểm checkout: `buyerName`, `buyerEmail`, `buyerTaxCode` (nullable), `buyerAddress` (nullable), `invoiceRequested Boolean`. `buyerName` và `buyerEmail` **bắt buộc**, điền sẵn từ `User.displayName`/`User.email` và sửa được; hai trường còn lại chỉ hiện và chỉ bắt buộc khi `invoiceRequested` được tick.
- Admin có nút export CSV danh sách `Purchase` trạng thái `PAID` trong một khoảng ngày. Đây là artifact duy nhất rời khỏi hệ thống và đi kèm một nghĩa vụ pháp lý, nên đặc tả không được dừng ở "đủ cột":

| Khoản | Giá trị |
|---|---|
| Cột, đúng thứ tự | `paidAt`, `appTransId`, `providerTransId`, `buyerName`, `buyerTaxCode`, `buyerAddress`, `buyerEmail`, `courseTitle`, `amountVnd`, `invoiceRequested`, `status` |
| Header | Tiếng Việt, một dòng: `Thời điểm thanh toán,Mã giao dịch,Mã cổng thanh toán,Tên người mua,Mã số thuế,Địa chỉ,Email,Khóa học,Số tiền,Yêu cầu hóa đơn,Trạng thái` |
| `paidAt` | `dd/mm/yyyy HH:mm`, `Asia/Ho_Chi_Minh` — khớp định dạng ngày giờ ở `UX_PLAN.md` §9.3 |
| `amountVnd` | Số nguyên trần, không dấu ngăn nghìn, không ký hiệu `₫`. Excel phải đọc ra số |
| Mã hóa | **UTF-8 có BOM** (`﻿` ở byte đầu), phân tách bằng dấu phẩy, `CRLF` |
| Tên file | `hoa-don-{from}-{to}.csv`, ngày dạng `yyyy-mm-dd` |

BOM không phải chi tiết vặt: Excel trên Windows mở CSV UTF-8 không BOM bằng codepage hệ thống, và toàn bộ tên người mua tiếng Việt thành ký tự rác. Đó chính là kịch bản hỏng mặc định của đúng deliverable này.

**Bản demo sẽ không làm:** tích hợp API nhà cung cấp hóa đơn điện tử; tính hoặc tách VAT; sinh PDF hóa đơn; gửi hóa đơn qua email; lưu trữ hóa đơn.

Các trường trên ra đời cùng phase 4 (Thanh toán), không sớm hơn — trước đó không có `Purchase` nào để chụp.

### 4.7 Trang pháp lý

**Quyết định: 5 trang, nội dung là file Markdown trong repo, không phải bảng database.**

| Route | Trang |
|---|---|
| `/terms` | Điều khoản sử dụng |
| `/privacy` | Chính sách bảo mật và xử lý dữ liệu cá nhân |
| `/refund` | Chính sách hoàn tiền (đúng các điều khoản ở §4.5) |
| `/payment` | Chính sách thanh toán và giao nhận dịch vụ số |
| `/contact` | Thông tin liên hệ và chủ sở hữu |

Slug tiếng Anh chứ không phải `/dieu-khoan`, `/bao-mat`… như bản đầu: bảng route đầy đủ của sản phẩm nằm ở `UX_PLAN.md` §2.3 và toàn bộ dùng slug tiếng Anh (`/courses`, `/my-courses`, `/checkout/[purchaseId]`). Năm URL tiếng Việt lẻ loi giữa ba mươi URL tiếng Anh chỉ tạo ra một quy tắc phải nhớ. Việc này cũng gỡ luôn một va chạm: bản đầu chiếm `/thanh-toan` cho trang **chính sách**, trong khi đó là slug tự nhiên nhất của màn hình **thanh toán** — phát hiện ra ở phase 4, sau khi URL pháp lý đã publish và đã được index, là quá muộn.

Kế hoạch gốc đã liệt kê 4 trang đầu trong phạm vi công khai nhưng không nói ai viết, để ở đâu, và trạng thái ban đầu là gì. `/payment` là bổ sung: hồ sơ merchant của cổng thanh toán thường soi website xem có chính sách thanh toán, hoàn tiền và bảo mật hay không. `UX_PLAN.md` §2.2–§2.3 đã liệt kê đủ cả bốn `/terms`, `/privacy`, `/refund`, `/payment`.

Nội dung nằm ở `apps/web/src/content/legal/*.md`, sửa bằng commit. Không CMS — 5 file thay đổi vài lần một năm.

**Quy tắc placeholder:** mỗi file có frontmatter `isPlaceholder: true`. Khi cờ bật, layout render banner "BẢN NHÁP — chưa có hiệu lực pháp lý, chỉ dùng để demo" ở đầu trang, trang bị đánh `noindex` và bị loại khỏi sitemap. Một mục trong phase 5 là gỡ cả 5 cờ sau khi copy đã qua rà soát. Cờ là điều kiện kỹ thuật, không phải lời nhắc trong đầu ai đó.

### 4.8 Analytics và telemetry

**Quyết định: bản demo không có analytics nào ngoài structured server log mà kế hoạch gốc đã yêu cầu.** Không GA4, không Vercel Analytics, không PostHog, không Sentry, không heatmap, không pixel.

Lý do: mọi số liệu cần cho giai đoạn này — số học viên, tỉ lệ hoàn thành, bài bị bỏ giữa chừng, doanh thu — đều là truy vấn PostgreSQL thuộc module `Reporting` mà kế hoạch gốc đã định nghĩa. Thêm SDK bên thứ ba là đổi con số đã có sẵn trong database của mình lấy một nghĩa vụ thông báo và xin đồng ý theo pháp luật bảo vệ dữ liệu cá nhân Việt Nam, một cookie banner, và một điểm phụ thuộc mới.

Định dạng log giữ nguyên yêu cầu của kế hoạch gốc: một dòng JSON mỗi request với `requestId`, `userId`, route, status, duration; không chứa secret, password hay session token.

Ngưỡng thêm sau: cần biết **nguồn** traffic — thứ database không trả lời được — thì thêm một công cụ đo lường không dùng cookie kèm trang thông báo. Cần theo dõi lỗi production thì thêm Sentry, sau khách hàng trả tiền đầu tiên.

### 4.9 Đa ngôn ngữ

**Quyết định: chỉ tiếng Việt. Không cài `next-intl` hay bất kỳ thư viện i18n nào bây giờ.**

**Một quy tắc cấu trúc duy nhất giữ cho locale thứ hai còn rẻ: không có chuỗi hiển thị nào viết thẳng trong JSX.** Mọi copy nằm trong `apps/web/src/messages/vi.ts` — một object phẳng, key theo namespace (`course.card.students`, `checkout.error.emailNotVerified`), truy cập qua một hàm `t()` mười dòng. Thêm locale sau đó là thêm một file và bọc một provider, không phải đọc lại từng component.

**Nội dung của file đó không phải việc bịa ra lúc dựng component.** `UX_PLAN.md` §6.2 và §6.3 đã cho chuỗi thật của mọi trạng thái rỗng, lỗi và giảm cấp; §6.4 cho từng thông báo lỗi form khớp một-một với DTO đang chạy; §9.1–§9.3 cho giọng văn, quy tắc viết hoa và định dạng số/tiền/thời gian; §9.5 là bảng từ vựng bắt buộc — một khái niệm đúng một cách gọi, và nó đã giải quyết chỗ nhập nhằng mà kế hoạch gốc nêu ra: "đăng ký học" chỉ dùng cho hành động mua, "mở khóa" chỉ dùng khi thật sự tạo `Enrollment`, "ghi danh" không xuất hiện trên giao diện. Việc còn lại của `vi.ts` là đặt key cho những chuỗi đó, không phải viết lại chúng.

Hai thói quen đi kèm, miễn phí vì đều là API native: tiền định dạng bằng `Intl.NumberFormat('vi-VN')`, ngày bằng `Intl.DateTimeFormat('vi-VN')`. Cả hai đã nhận locale làm tham số nên sau này không phải sửa.

Không thêm segment `[locale]` vào route bây giờ — đó là cấu trúc suy đoán, và khi cần thì nó là một lần di chuyển thư mục cơ học.

Nội dung khóa học trong database (`title`, `description`, `learningOutcomes`) **không** đa ngôn ngữ. Locale thứ hai cho nội dung cần một bảng `CourseTranslation`; nằm ngoài phạm vi và không được giả vờ là rẻ.

### 4.10 Khóa `ARCHIVED` và người đã mua nó

Hai tài liệu con đang nói ngược nhau và phải chốt ở đây, vì đây là một lời hứa với người đã trả tiền.

`DATA_MODEL.md` §Xóa mềm và archive: "khóa archived biến mất khỏi catalog, khỏi sitemap và khỏi tìm kiếm, nhưng người đã có `Enrollment` vẫn học bình thường". `API_CONTRACT.md` §5.5: "với khóa không `PUBLISHED`, trả `404` như mọi nơi khác" — nghĩa là học viên đã mua mở `/learn/[courseSlug]` sẽ nhận 404. Không thể cùng đúng.

**Chốt: quyền học thắng trạng thái khóa.** Kế hoạch gốc cấm xóa cứng khóa đã có người mua chính vì lý do này; archive rồi khóa cửa người đã mua thì cấm xóa cũng vô nghĩa.

| Route | Khóa `ARCHIVED`, người gọi có `Enrollment` `ACTIVE` | Khóa `ARCHIVED`, người gọi không có |
|---|---|---|
| `GET /courses/{slug}` (trang bán) | `404` | `404` |
| `GET /learn/{courseSlug}` và toàn bộ đường học, playback, tài liệu | `200`, đầy đủ | `404` |
| `/my-courses` | Vẫn hiện, kèm `Badge` "Đã ngừng bán" | — |

Nghĩa là bước 3 của luồng cấp playback token (`API_CONTRACT.md` §6.1) đọc thành: `status !== PUBLISHED` **và** người gọi không phải ADMIN **và** không có `Enrollment` `ACTIVE` → `404`. Trạng thái `DRAFT` không được hưởng ngoại lệ này — không ai mua được một bản nháp, nên không có `Enrollment` hợp lệ nào để bảo vệ.

## 5. Delta mô hình dữ liệu

**Bảng delta của bản đầu đã bị thay thế.** `DATA_MODEL.md` là schema đích duy nhất: 14 bảng, 14 enum, 30 index/unique, 17 FK, đã kiểm bằng `prisma validate` và `prisma migrate diff` để chứng minh không phá migration `add_user_auth` đang chạy. Mọi tên field, kiểu và enum đọc ở đó, không đọc ở đây. Bản đầu của mục này lệch với nó ở tám chỗ (`outcomes`/`learningOutcomes`, `audience`/`targetAudience`, `durationMinutes`/`totalDurationSeconds`, `isSeed`/`demoStats`, `Float`/`Decimal(2,1)`, `Lesson.kind`/`Lesson.type`, `driver`/`provider`, `paymentAttemptId`/`purchaseId`) và thêm hai cột không tồn tại ở đâu khác (`tags`, `searchVector`) — dùng nó làm nguồn thi công là hỏng.

Còn lại đúng ba thứ tài liệu này **chốt lại** và `DATA_MODEL.md` phải thêm:

| Model | Thêm | Migration | Vì |
|---|---|---|---|
| `Course` | `searchText` (chuỗi đã bỏ dấu, viết thường) | `add_catalog` | §4.3 |
| `Purchase` | `buyerName`, `buyerEmail`, `buyerTaxCode?`, `buyerAddress?`, `invoiceRequested` | `add_payment` | §4.6 |
| `PurchaseStatus` | thêm giá trị `REFUND_REQUESTED` | `add_payment` | §4.5 |

Ba điểm bản đầu ghi sai, ghi lại cho khỏi bị chép lại:

- **Không gộp một migration.** Bản đầu đề xuất dồn Catalog + Enrollment + Learning vào một migration đầu phase 2 với lý do "rẻ hơn sáu migration vá dần trên bảng đã có dữ liệu thật". Lý do đó không đứng được: năm migration của `DATA_MODEL.md` đều chạy trên bảng rỗng, nên khoản tiết kiệm bằng không. Và nó tự mâu thuẫn với chính §2 — không thể tạo `enrollments` ở phase 2 khi bảng `purchases` chưa tồn tại. Theo đúng năm migration của `DATA_MODEL.md`, trong đó `enrollments.purchase_id` là cột duy nhất đến muộn.
- **Bất biến của `Enrollment` ép ở tầng ứng dụng, không ở CHECK constraint.** Bản đầu đặt CHECK hai chiều và tự khen là "đúng loại bất biến mà database phải bảo vệ". Prisma không khai được CHECK trong schema, nên nó phải là SQL viết tay; và một nửa của nó (`source='PURCHASE'` ⇒ có đơn hàng) tham chiếu bảng `purchases` chưa tồn tại ở migration 4. `DATA_MODEL.md` ép bằng ứng dụng, trong đúng một hàm `EnrollmentService.grant()` là đường duy nhất tạo `Enrollment` — cùng một sự bảo vệ, không có SQL mồ côi. Cái mà database vẫn ép là hai unique thật sự chặn nhân đôi: `(userId, courseId)` và `purchaseId`.
- **Không có khóa miễn phí ở bản demo.** Bản đầu viết "`priceVnd = 0` nghĩa là khóa miễn phí" nhưng không có đường nào ghi danh vào một khóa như vậy: `PURCHASE` cần một đơn hàng mà ZaloPay không tạo nổi cho 0 đồng, `MANUAL_GRANT` cần một admin bấm nút. `API_CONTRACT.md` cũng đã trả `422 COURSE_NOT_PURCHASABLE` cho `priceVnd = 0`. Chốt: cổng publish yêu cầu **`priceVnd > 0`**, và bộ lọc "miễn phí" biến khỏi catalog (§4.2). Khi thật sự muốn bán khóa miễn phí, đó là một giá trị enum `EnrollmentSource.FREE` cộng một endpoint tự phục vụ — thêm lúc có nhu cầu, không dựng sẵn cái khung rỗng bây giờ.

Ba bộ đếm phi chuẩn hóa (`lessonCount`, `totalDurationSeconds`, `enrollmentCount`) giữ nguyên lý do tồn tại: không có chúng thì mỗi lưới thẻ khóa học là N truy vấn tổng hợp. Nhịp tính lại thì rộng hơn bản đầu viết — `DATA_MODEL.md` đã chốt là **mọi** thao tác tạo/sửa/xóa `Lesson` và gắn/gỡ `VideoAsset`, không chỉ lúc publish. Đây không phải chi tiết vặt: §4.5 chia cho `lessonCount` để quyết ai được hoàn tiền, nên một bộ đếm cũ là một quyết định hoàn tiền sai.

## 6. Rủi ro kế hoạch đánh giá thấp

| Hạng | Rủi ro | Kế hoạch gốc thiếu ở đâu | Giảm thiểu, trong phạm vi |
|---|---|---|---|
| 1 | **Demo driver lọt vào production.** `PAYMENT_DRIVER=demo` mở khóa học miễn phí cho bất kỳ ai bấm nút. Một biến môi trường sai là mất toàn bộ doanh thu và làm bẩn dữ liệu Enrollment. | Rủi ro này không tồn tại trong kế hoạch gốc vì kế hoạch gốc không có driver seam. Nó do D3 tạo ra. | `assertNoDemoDriversInProduction()` ở dòng đầu `main.ts`, **không có cờ bỏ qua**, và biến chưa set cũng bị tính là demo; `DevModule` chỉ được import khi có driver demo nên ở production route confirm không tồn tại; banner demo toàn site; hai mục trong checklist phase 5 (tắt driver demo, và không khóa `PUBLISHED` nào còn trỏ vào asset `DEMO`). Xem §3. |
| 2 | **Seam `Enrollment` hỏng vì thanh toán làm cuối.** Nếu không có gì ép, `paymentAttemptId` thành FK nullable không ai kiểm, và luồng cấp quyền thật bị chắp vá vào sau. | Kế hoạch gốc viết `Enrollment` là "paymentAttemptId hoặc admin grant" — một câu, không ràng buộc. Với thứ tự cũ thì vô hại; với thứ tự mới thì đây là seam quan trọng nhất của dự án. | **Một** hàm `EnrollmentService.grant({source, ...})` là đường duy nhất tạo Enrollment, đúng theo nguyên tắc "không viết hai luồng cấp Enrollment độc lập" mà kế hoạch gốc đã đặt cho callback và reconcile; unique `(userId, courseId)` và unique `purchaseId` chặn nhân đôi ở tầng database. Không dùng CHECK constraint — lý do ở §5. |
| 3 | **Driver video demo không tái hiện ràng buộc thật.** Phát MP4 local không có token, không hạn, không allowed-origin — nên toàn bộ tầng phân quyền phát video chưa từng bị kiểm thử cho tới lúc cắm Cloudflare, tức là ở phase muộn nhất. | Kế hoạch gốc mô tả đúng luồng 4 bước cấp playback token nhưng giả định luôn có Cloudflare. | Tám bước kiểm tra ở `API_CONTRACT.md` §6.1 không có nhánh nào phụ thuộc driver, nên ma trận test quyền truy cập chạy đủ giá trị trên driver demo. Thêm một ràng buộc, **chốt lại**: `playbackUrl` của driver demo trỏ vào **cùng route media có chữ ký** đang dùng cho tài liệu (`/api/v1/media/local/*key`, ký HMAC gồm method + `exp`, so bằng `timingSafeEqual`), chứ không phải một URL file tĩnh trần. `DEMO_MODE.md` §2 hiện cho `DEMO_VIDEO_URL` trỏ thẳng vào `apps/web/public`; `ROADMAP.md` §7 lại có test N3.3 "gọi URL playback sau TTL → 403" — chỉ phương án ký mới làm test đó chạy được, và nó không thêm cơ chế nào vì cơ chế ký đã tồn tại cho seam file. Express phục vụ `Range` sẵn trong `res.sendFile`, nên tua video vẫn chạy. |
| 4 | **Chênh lệch giữa 2 model đang có và ~19 model sẽ có.** Bảng data model của kế hoạch là danh sách mong muốn; không có gì ép nó thành hiện thực, và mỗi phase dễ đẻ thêm một migration vá. | Kế hoạch gốc liệt kê 13 model nhưng không gắn model nào vào phase nào. | Năm migration gắn cứng vào năm phase theo bảng của `DATA_MODEL.md` §Chiến lược migration; điều kiện D6 trong Definition of Done (`ROADMAP.md` §4) bắt `prisma migrate deploy` chạy sạch trên database trống **ở mọi phase**, không chỉ phase cuối. |
| 5 | **Chi phí Cloudflare Stream trôi theo phút phát, không theo doanh thu.** Ví dụ `$17`/`$65` trong kế hoạch giả định mỗi học viên xem đúng một lần. Xem lại nhiều lần, hoặc một script kéo video, không bị chặn bởi giả định đó. | Kế hoạch gốc tính chi phí nhưng không có cơ chế nào giới hạn số lần cấp token. | Rate limit trên endpoint cấp playback token theo `userId` (30 lần/60 giây, `API_CONTRACT.md` §8). Guard hiện có **chưa làm được** — nó ghi cứng 10 lần/60 giây và chỉ đếm theo IP, nên phải tham số hóa trước, xem §4.1; đếm theo IP ở đây còn chặn nhầm cả một văn phòng sau NAT. Không thêm bảng, không thêm dependency. Theo dõi chi phí bằng dashboard Cloudflare — đã tồn tại và miễn phí. |
| 6 | **Sàn a11y và design token bị hoãn tới phase 5.** 12 giá trị màu và 2 font sẽ nằm rải rác trong vài chục component nếu không có nơi ở từ đầu; và sửa contrast, focus ring, touch target sau khi UI đã dựng xong là làm lại, không phải sửa. | Kế hoạch gốc không có mục UX/UI nào và xếp "accessibility cơ bản và responsive" vào phase cuối. | Toàn bộ token nằm trong `apps/web/src/app/globals.css` theo **hai khối, đúng thứ tự**: `@import "tailwindcss"` → `@theme static { …giá trị token… }` (`UX_PLAN.md` §1.1, có bảng giá trị đầy đủ; sản phẩm chỉ có giao diện sáng). Phải là `@theme static`: dưới `@theme` thường, biến nào không được một tiện ích nào sinh ra sẽ bị loại khỏi `:root`, và khối `prefers-reduced-motion` ở `UX_PLAN.md` §1.6 không còn biến nào để ghi đè. Ràng buộc a11y áp từ component giao diện đầu tiên của Phase 1; cặp màu phải đo nằm ở `UX_PLAN.md` §8.1 và đo bằng `design/contrast-check.py` đã có trong repo. |
| 7 | **Dev trên Windows, chạy trên Linux.** Khác biệt phân biệt hoa thường trong đường dẫn và import ESM chỉ lộ ra khi deploy. | Kế hoạch gốc chọn Railway nhưng không nói gì về môi trường dev. | CI chạy `ubuntu-latest` từ phase 1 — kế hoạch gốc đã yêu cầu có CI, chỉ cần chốt runner. Import luôn kèm đuôi `.js`, tên file chữ thường và gạch nối. |
| 8 | **Xác minh email không bao giờ được kiểm thử vì chưa có nhà cung cấp email.** | Kế hoạch gốc liệt kê "gửi email xác minh" như việc đương nhiên chạy được. | `MAIL_DRIVER=demo` (`DevInboxMailer`) in link đầy đủ ra stdout, ghi file `.eml` và mở hộp thư dev `GET /api/v1/dev/mail`; e2e test đọc token từ đúng dòng log đó. Luồng verify được kiểm thử tự động từ phase 1 dù chưa có SMTP. |


## 7. Cố ý không làm ở bản demo

Nối tiếp danh sách của kế hoạch gốc (microservice, Redis, queue, DRM, giỏ hàng, coupon, quiz, chứng chỉ — tất cả vẫn giữ nguyên).

Một đính chính: mục "generic provider interfaces" trong danh sách gốc nay chỉ còn áp dụng **ngoài** 4 seam ở §3. Không có seam thứ năm cho tới khi xuất hiện nhà cung cấp thứ hai thật của một thứ khác.

Bổ sung:

- Tài khoản thật của ZaloPay, Cloudflare Stream/R2 và nhà cung cấp email. Mọi thứ chạy trên PostgreSQL local.
- Refund API tự động của cổng thanh toán. Hoàn tiền thủ công qua portal (§4.5).
- Tích hợp API hóa đơn điện tử, tách VAT, sinh và gửi PDF hóa đơn (§4.6).
- Analytics bên thứ ba, cookie consent banner, Sentry/APM (§4.8).
- Locale thứ hai và dịch nội dung khóa học (§4.9).
- Search engine ngoài, chịu lỗi chính tả, gợi ý "có phải bạn tìm" (§4.3).
- Gợi ý khóa học bằng ML. "Khóa liên quan" là truy vấn cùng `categoryId`, sắp theo `enrollmentCount`.
- Viết đánh giá, hỏi đáp, bình luận — giữ nguyên quyết định hoãn của kế hoạch gốc; chỉ có trường tổng hợp (§4.4).
- Uploader video trực tiếp trong admin. Kế hoạch gốc đã hoãn; bản demo dùng đúng **một** file mẫu commit trong repo (`apps/web/public/demo/sample.mp4`) mà 58 hàng `VideoAsset` cùng trỏ tới.
- Lưu trữ bền cho file upload ở chế độ demo. `STORAGE_LOCAL_DIR` nằm trên đĩa của container, và Railway xóa sạch nó sau mỗi lần deploy — nên thư mục này chỉ dùng cho máy local và cho fixture seed. File nào phải sống qua một lần deploy thì phải nằm trên R2. Trên môi trường triển khai, upload ở chế độ demo là mất dữ liệu có thể đoán trước, không phải lỗi.
- Wishlist, so sánh khóa học, "học viên cũng xem".
- Ứng dụng mobile, PWA, tải bài học về xem offline.
- Chạy nhiều instance API. Bộ đếm rate limit vẫn nằm trong process; kế hoạch gốc đã ghi điều kiện phải đổi trước khi scale.
- Scheduler ngoài. Tác vụ reconcile và dọn dẹp chạy bằng interval trong chính process API.
