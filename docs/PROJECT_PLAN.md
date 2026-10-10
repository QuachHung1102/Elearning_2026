# Kế hoạch hệ thống E-learning

## Kết luận kiến trúc

Chọn:

- **Next.js** cho giao diện, SEO và khu vực học viên/quản trị.
- **NestJS** làm backend REST duy nhất.
- **Prisma + PostgreSQL**.
- **ZaloPay Gateway** với QR động, callback và truy vấn đối soát.
- **Cloudflare Stream** để lưu trữ, mã hóa và phát video.
- **Cloudflare R2** cho ảnh bìa (prefix công khai) và cho PDF, tài liệu tải xuống (private bucket + presigned URL).
- Triển khai ban đầu trên **server công ty (chưa chọn)** dưới dạng modular monolith, chưa dùng microservice; hiện chạy local.

Giả định ban đầu: mỗi lần mua một khóa học, thanh toán VND một lần và được học lâu dài; chưa có subscription, giỏ hàng, nhiều giảng viên hoặc chia doanh thu.

```text
Trình duyệt
    │
    ▼
Next.js — public pages, SEO, learner UI, admin UI
    │ /api/*
    ▼
NestJS modular monolith
    ├── Prisma ─────────────── PostgreSQL
    ├── Create/query order ── ZaloPay
    ├── Callback ◀──────────── ZaloPay
    ├── Signed playback ───── Cloudflare Stream
    └── Private files ─────── Cloudflare R2
```

## Next.js thuần hay Next.js + NestJS?

| Phương án | Ưu điểm | Nhược điểm |
|---|---|---|
| Next.js + Prisma | Ít dịch vụ, triển khai nhanh, đủ cho website cá nhân đơn giản | Logic thanh toán, callback, scheduler, quản trị và quyền truy cập dễ trộn vào lớp giao diện |
| Next.js + NestJS | Backend độc lập, luồng thanh toán tập trung, dễ kiểm thử, thuận lợi nếu sau này có mobile app | Phải vận hành hai ứng dụng và quản lý hợp đồng API |
| Microservice | Không có lợi ích thực tế ở quy mô hiện tại | Tăng hạ tầng, queue, tracing và lỗi phân tán |

Nếu không có yêu cầu NestJS, Next.js thuần là lựa chọn ngắn nhất. Tuy nhiên, tài liệu Next.js cũng mô tả backend của Next chủ yếu theo mô hình BFF và lưu ý rằng nó không phải sự thay thế đầy đủ cho backend; môi trường lambda còn có giới hạn với tiến trình dài và kết nối lâu dài. [Next.js Backend for Frontend](https://nextjs.org/docs/app/guides/backend-for-frontend)

Vì dự án đã chọn NestJS + Prisma và hệ thống có thanh toán callback, đối soát, phân quyền nội dung, lựa chọn phù hợp là:

> **Next.js + NestJS, nhưng NestJS chỉ là một modular monolith.**

Không dùng custom Next server, GraphQL, CQRS, Kafka, Redis hoặc microservice ở bản đầu.

Cấu trúc tối thiểu:

```text
/
├── apps/
│   ├── web/       # Next.js
│   └── api/       # NestJS + Prisma
├── package.json
└── pnpm-workspace.yaml
```

Chưa cần Nx, Turborepo hay một `packages/shared` lớn. Hợp đồng REST có thể được mô tả bằng OpenAPI của NestJS; chỉ sinh client khi số endpoint đủ lớn để việc viết tay trở nên phiền.

## Chọn PostgreSQL hay MySQL?

Cả PostgreSQL và MySQL đều được Prisma hỗ trợ đầy đủ về khóa chính, khóa ngoại, unique constraint, JSON và transaction. [Ma trận database của Prisma](https://docs.prisma.io/docs/orm/core-concepts/supported-databases)

Chọn **PostgreSQL** vì:

- Mô hình khóa học, thanh toán, quyền học và tiến độ có tính quan hệ rõ ràng.
- `jsonb` phù hợp để lưu phần dữ liệu đã chọn lọc từ phản hồi nhà cung cấp và có thể đánh index khi cần. PostgreSQL còn có UUID, text search và nhiều kiểu dữ liệu native. [PostgreSQL data types](https://www.postgresql.org/docs/current/datatype.html)
- Constraint của database sẽ bảo vệ các bất biến quan trọng như không cấp trùng quyền học, không nhận trùng giao dịch và không có giá âm. [PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)
- Hệ sinh thái PostgreSQL managed phù hợp với Prisma và ứng dụng Node.js.

MySQL không phải lựa chọn sai; chỉ nên đổi sang MySQL nếu đã có hạ tầng hoặc kinh nghiệm vận hành MySQL đáng kể. Với dự án mới hoàn toàn, PostgreSQL có lợi thế hơn nhưng không tạo thêm độ phức tạp.

Quy ước dữ liệu:

- UUID cho khóa nội bộ.
- Tiền lưu bằng số nguyên VND, không dùng `float`.
- Thời điểm lưu bằng `timestamptz`.
- Email chuẩn hóa lowercase trước khi áp unique.
- Khóa học đã có người mua chỉ được `ARCHIVED`, không xóa vật lý.
- Dùng `prisma migrate deploy` khi triển khai, không dùng `db push` trên production.
- Không bọc Prisma bằng generic repository chỉ để chuyển tiếp lời gọi.

## Dịch vụ video: chọn Cloudflare Stream

So sánh ngắn:

| Dịch vụ | Điểm mạnh | Điểm cần cân nhắc |
|---|---|---|
| Cloudflare Stream | Upload, encode, adaptive streaming, player, signed URL và CDN trong một dịch vụ; giá theo phút dễ dự báo | Tối đa 1080p |
| Bunny Stream | Chi phí thấp, encode/player/security bao gồm sẵn, hỗ trợ nhiều độ phân giải | Giá theo dung lượng và khu vực nên khó dự báo hơn |
| Mux | Trải nghiệm developer, analytics, caption và DRM mạnh | Nhiều khả năng hơn nhu cầu hiện tại; gói miễn phí chỉ lưu tối đa 10 video |
| YouTube unlisted | Miễn phí và triển khai nhanh | Không phải cơ chế bảo vệ khóa học trả phí; liên kết có thể bị chia sẻ |

Bunny Stream hiện quảng cáo storage từ `$0.01/GB` và CDN từ `$0.005/GB`; Mux có mức giá theo phút cùng gói miễn phí giới hạn số video. [Bunny Stream Pricing](https://bunny.net/pricing/stream/), [Mux Pricing](https://www.mux.com/pricing)

Tuy nhiên, lựa chọn khuyến nghị vẫn là **Cloudflare Stream** vì một người vận hành cần sự đơn giản và chi phí dễ tính hơn:

- Tự encode adaptive bitrate từ 360p đến 1080p.
- Signed URL/token cho nội dung trả phí.
- Giới hạn domain được phép nhúng.
- Có upload trực tiếp và webhook trạng thái xử lý nếu sau này xây uploader trong admin. [Cloudflare Stream](https://developers.cloudflare.com/stream/), [bảo vệ video](https://developers.cloudflare.com/stream/viewing-videos/securing-your-stream/)

Theo [bảng giá Cloudflare Stream](https://developers.cloudflare.com/stream/pricing/):

- `$5 / 1.000 phút` video lưu trữ.
- `$1 / 1.000 phút` video được phát.
- Encode và bandwidth đã nằm trong mô hình giá.

Ví dụ với giả định thư viện video dài 10 giờ:

- 20 học viên xem toàn bộ: `$5` lưu trữ + `$12` phát = **`$17/tháng`**.
- 100 học viên xem toàn bộ: `$5` lưu trữ + `$60` phát = **`$65/tháng`**.

Đây là ví dụ trước thuế, chưa gồm app, database và email.

Cách làm tối giản khi ra mắt:

- Upload video bằng Cloudflare Dashboard.
- Sao chép `video UID` vào bài học trong trang quản trị.
- NestJS kiểm tra video đã sẵn sàng trước khi cho publish.

Chỉ xây uploader trực tiếp trong admin khi thao tác dashboard thực sự bất tiện. Khi đó trình duyệt upload thẳng lên Cloudflare bằng URL dùng một lần; không chuyển file lớn qua NestJS. Cloudflare hỗ trợ cả direct upload và webhook có chữ ký. [Direct uploads](https://developers.cloudflare.com/stream/uploading-videos/direct-creator-uploads/), [Stream webhooks](https://developers.cloudflare.com/stream/manage-video-library/using-webhooks/)

Tài liệu tải xuống của bài học (`LessonResource`) dùng R2 **private bucket cùng presigned URL**; R2 hỗ trợ API tương thích S3 và URL tạm thời cho upload/download. [R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)

Ảnh bìa khóa học thì **không**: nó nằm ở bucket/prefix công khai (`public/`) và được đọc bằng URL **không ký**. Ảnh bìa xuất hiện trên trang bán hàng công khai, nên ký nó không bảo vệ được gì mà lại làm hỏng cache CDN và cache trình duyệt của toàn bộ catalog — mỗi lần re-sign là một cache miss cho từng ảnh. Upload thì vẫn đi qua presigned PUT như mọi file khác; chỉ **đường đọc** được miễn chữ ký. Chi tiết ở `API_CONTRACT.md` §9.1–§9.2 và `DEMO_MODE.md` §3.

Hạn chế cần hiểu: signed URL ngăn chia sẻ link trực tiếp nhưng không thể ngăn quay màn hình. Chưa cần DRM. Nếu sau này nội dung có giá trị cao hoặc bắt buộc 4K, đánh giá lại Bunny MediaCage hoặc Mux DRM.

## Ngôn ngữ nghiệp vụ

Cần tách ba khái niệm thường bị gọi chung là “đăng ký khóa học”:

- **Purchase**: ý định mua một khóa học của một người dùng.
- **PaymentAttempt**: một lần tạo QR và thử thanh toán qua ZaloPay.
- **Enrollment**: quyền được học khóa học.

Nhấn nút “Đăng ký khóa học” chỉ tạo `Purchase` và `PaymentAttempt`; nó chưa tạo quyền học. “Mở khóa” có nghĩa là tạo hoặc kích hoạt `Enrollment` sau khi backend xác minh thanh toán.

Các thuật ngữ còn lại:

- `Course`: khóa học.
- `Section`: chương/phần.
- `Lesson`: bài học, có thể chứa Markdown, video hoặc cả hai.
- `VideoAsset`: tham chiếu đến video trên Cloudflare Stream.
- `LessonProgress`: vị trí xem gần nhất và trạng thái hoàn thành.
- `ManualGrant`: quyền học do quản trị viên cấp thủ công.

## Phạm vi chức năng

### Khách chưa đăng nhập

- Trang chủ và giới thiệu giảng viên.
- Danh sách khóa học đã xuất bản.
- Trang chi tiết: mô tả, mục tiêu, đối tượng, nội dung, giá và bài xem thử.
- Trang chính sách riêng tư, điều khoản, hoàn tiền và liên hệ.
- Đăng ký, đăng nhập, quên mật khẩu.
- SEO metadata, sitemap và dữ liệu có cấu trúc cho khóa học.

### Học viên

- Xác minh email, đăng nhập và đăng xuất.
- Hồ sơ cá nhân, đổi mật khẩu, quản lý phiên đăng nhập.
- Xem các khóa học đã mua.
- Bắt đầu checkout hoặc tiếp tục QR còn hiệu lực.
- Xem trạng thái chờ thanh toán, thành công, thất bại hoặc hết hạn.
- Lịch sử mua và giao dịch.
- Học theo chương/bài, xem video, đọc nội dung, tải tài liệu.
- Lưu vị trí xem gần nhất.
- Đánh dấu hoàn thành và hiển thị tiến độ theo số bài.
- Tiếp tục học từ bài gần nhất.

### Chủ sở hữu/quản trị viên

- Dashboard doanh thu và giao dịch cơ bản.
- Tạo, chỉnh sửa, xem trước, publish và archive khóa học.
- Quản lý chương, bài học và thứ tự hiển thị.
- Gắn video, ảnh bìa và tài liệu.
- Chỉ cho publish khi nội dung bắt buộc đã hợp lệ và video đã sẵn sàng.
- Xem người dùng, khóa học đã mua và trạng thái thanh toán.
- Cấp hoặc thu hồi quyền học thủ công với audit log.
- Xử lý hoàn tiền theo chính sách.
- Khóa tài khoản có hành vi lạm dụng.

Không cần một `AdminModule` chứa bản sao logic nghiệp vụ. Các route admin gọi trực tiếp vào module Course, Enrollment và Checkout với guard quản trị.

### Chức năng hệ thống

- Nhận callback ZaloPay.
- Chủ động truy vấn trạng thái giao dịch bị mất callback.
- Gửi email xác minh, đặt lại mật khẩu và xác nhận mua hàng.
- Structured logging, health check và cảnh báo.
- Backup, restore và audit hành động liên quan đến thanh toán/quyền học.
- Rate limiting cho đăng nhập, tạo QR và các callback bất thường.

### Để sau khi có nhu cầu thực tế

- Giỏ hàng nhiều khóa học, bundle và subscription.
- Mã giảm giá.
- Quiz, bài tập và chứng chỉ.
- Bình luận, đánh giá và hỏi đáp.
- Drip content.
- Affiliate.
- Ứng dụng mobile.
- Nhiều giảng viên và chia doanh thu.
- Redis, queue riêng, search engine, recommendation engine và DRM.

## Các module NestJS

| Module | Interface chính | Phần phức tạp được che giấu |
|---|---|---|
| Identity | đăng ký, đăng nhập, đăng xuất, current user | password, session, verify/reset token, role guard |
| Catalog | danh sách, chi tiết, chỉnh sửa và publish course | trạng thái publish, thứ tự section/lesson, preview |
| Checkout | bắt đầu checkout, lấy trạng thái, nhận callback, reconcile | giá snapshot, QR, HMAC, idempotency, chuyển trạng thái |
| Enrollment | kiểm tra/cấp/thu hồi quyền học | paid access, manual grant, duplicate prevention |
| Learning | lấy nội dung bài và cập nhật progress | quyền truy cập, resume, hoàn thành |
| Media | kiểm tra video và cấp playback token | Cloudflare credentials, signed token, allowed origins |
| Reporting | báo cáo doanh thu/học viên | truy vấn tổng hợp, không thay đổi nghiệp vụ |

ZaloPay và Cloudflare là dependency bên ngoài nên đặt sau seam rõ ràng, nhưng chưa tạo `PaymentProvider` hay `VideoProvider` generic. Chỉ có `ZaloPayClient` và `CloudflareStreamClient`; khi thực sự xuất hiện nhà cung cấp thứ hai mới trích interface.

Đặc biệt, callback ZaloPay và tác vụ reconcile phải cùng gọi một hàm xác nhận thanh toán. Không viết hai luồng cấp `Enrollment` độc lập.

## Thiết kế thanh toán ZaloPay

Luồng chính:

1. Người dùng đăng nhập và chọn mua khóa học.
2. Backend kiểm tra đã có `Enrollment` chưa.
3. Nếu có QR chưa hết hạn, trả lại QR đó; không tạo giao dịch mới.
4. Nếu chưa có, backend chụp giá hiện tại vào `PaymentAttempt`.
5. Backend tạo `app_trans_id` duy nhất đúng định dạng ngày giờ Việt Nam và gọi API ZaloPay.
6. ZaloPay trả `qr_code`, `order_url` và token giao dịch; frontend hiển thị QR và trạng thái chờ.
7. Trang thanh toán chỉ polling trạng thái nội bộ; không tự tuyên bố thành công.
8. ZaloPay gọi callback server-to-server.
9. Backend xác minh HMAC bằng `key2`, kiểm tra `app_id`, `app_trans_id`, số tiền và giao dịch tương ứng.
10. Trong một transaction PostgreSQL: đánh dấu payment thành công, cập nhật Purchase và upsert Enrollment.
11. Các callback lặp lại vẫn trả thành công nhưng không tạo quyền học lần nữa.
12. Nếu callback bị mất, tác vụ định kỳ dùng Query Order API và chạy lại cùng luồng xác nhận.
13. UI thấy Purchase đã paid và chuyển người dùng sang khóa học.

Create Order API hiện trả trực tiếp `qr_code` và hỗ trợ chọn `zalopay_wallet` hoặc QR đa năng `vietqr`; chỉ bật phương thức nằm trong hợp đồng merchant. [ZaloPay Create Order](https://docs.zalopay.vn/docs/specs/order-create/)

Các nguyên tắc bắt buộc:

- `key1`, `key2` chỉ nằm trong NestJS secret store.
- Không mở khóa bằng redirect URL, query parameter hoặc ảnh chụp thanh toán.
- Callback phải xác minh HMAC; ZaloPay dùng `key2` cho callback. [Truyền dữ liệu an toàn](https://docs.zalopay.vn/docs/developer-tools/security/secure-data-transmission/)
- Query fallback là bắt buộc vì callback có thể bị mất. ZaloPay khuyến nghị truy vấn định kỳ hoặc truy vấn lại sau thời gian chờ thanh toán. [Query Order](https://docs.zalopay.vn/docs/specs/order-query/), [Callback](https://docs.zalopay.vn/docs/developer-tools/knowledge-base/callback/)
- Callback production cần HTTPS trên cổng 443 và TLS 1.2 trở lên. [ZaloPay FAQ](https://docs.zalopay.vn/vi/docs/faq/)
- Không giữ transaction database mở trong lúc gọi mạng sang ZaloPay.
- Nếu hai QR cũ/mới đều được thanh toán, ghi nhận cả hai payment, chỉ tạo một Enrollment và đưa giao dịch thừa vào danh sách cần xử lý hoàn tiền.

Việc đăng ký merchant cần bắt đầu sớm vì ZaloPay cung cấp sandbox credentials, kiểm thử QC rồi mới cấp production AppId/keys. [Quy trình tích hợp ZaloPay](https://docs.zalopay.vn/docs/developer-tools/integration-guide/)

## Mô hình dữ liệu đề xuất

| Model | Dữ liệu chính và constraint |
|---|---|
| `User` | email normalized unique, password hash, display name, role, status, verifiedAt |
| `Session` | id/JWT session id, userId, expiresAt, revokedAt |
| `AuthToken` | verify/reset token hash, type, expiresAt, consumedAt |
| `Course` | slug unique, title, description Markdown, priceVnd, status, publishedAt |
| `Section` | courseId, title, position; unique `(courseId, position)` |
| `Lesson` | sectionId, title, content Markdown, videoAssetId nullable, preview flag, position |
| `VideoAsset` | Cloudflare UID unique, status, duration, thumbnail |
| `LessonResource` | lessonId, object key, filename, content type, size |
| `Purchase` | unique `(userId, courseId)`, trạng thái mua tổng thể |
| `PaymentAttempt` | purchaseId, appTransId unique, amount snapshot, QR, expiry, status, zpTransId unique |
| `Enrollment` | unique `(userId, courseId)`, status, paymentAttemptId hoặc admin grant |
| `LessonProgress` | unique `(userId, lessonId)`, lastPositionSeconds, completedAt |
| `AuditLog` | actor, action, entity type/id, metadata tối thiểu, createdAt |

Các index quan trọng:

- `Course.slug`
- `Section(courseId, position)`
- `Lesson(sectionId, position)`
- `PaymentAttempt(status, expiresAt)`
- `PaymentAttempt.appTransId`
- `PaymentAttempt.zpTransId`
- `Enrollment(userId, courseId)`
- `LessonProgress(userId, lessonId)`
- `Session(userId)` và `Session.expiresAt`

## Authentication và quyền truy cập

Theo quyết định triển khai hiện tại, dùng JWT trong cookie kết hợp bản ghi session PostgreSQL. JWT chỉ chứa `sub` (user id) và `sid` (session id); backend vẫn kiểm tra session trong database ở mỗi request được bảo vệ để có thể thu hồi ngay:

- Cookie `HttpOnly`, `SameSite=Lax`; bật `Secure` trong production.
- JWT ký bằng `HS256`, secret tối thiểu 32 byte và có thời hạn khớp với session.
- Mật khẩu được băm bằng `scrypt` với salt ngẫu nhiên; không bao giờ trả password hash qua API.
- Mỗi lần đăng ký hoặc đăng nhập tạo session mới; đăng xuất đánh dấu session hiện tại đã bị thu hồi.
- Thu hồi toàn bộ session khi đổi mật khẩu hoặc khóa tài khoản.
- Dùng double-submit CSRF token: lấy token từ `GET /api/v1/auth/csrf`, gửi lại bằng header `X-CSRF-Token` và cookie tương ứng cho các thao tác thay đổi dữ liệu.
- Giới hạn request đăng ký/đăng nhập theo IP; chỉ tin `X-Real-IP` khi `TRUST_X_REAL_IP=true` (đặt khi reverse proxy của server triển khai ghi đè header này) và chuyển bộ đếm sang shared storage trước khi chạy nhiều API instance.
- Tài khoản admin được tạo bằng seed/CLI có kiểm soát; người đăng ký đầu tiên không tự động thành admin.

Mỗi lần phát video:

1. NestJS xác minh session.
2. Kiểm tra bài preview hoặc `Enrollment` đang active.
3. Sinh Stream token ngắn hạn.
4. Trả playback URL cho client.

Frontend không được nhận Cloudflare API token hoặc tự quyết định quyền học.

## Triển khai

Hiện chạy local; nơi triển khai là server công ty (chưa chọn). Thành phần cần có:

- Service `web`: Next.js.
- Service `api`: NestJS.
- PostgreSQL.
- Cloudflare Stream và R2.
- Cloudflare DNS/domain.
- Một dịch vụ transactional email qua SMTP/API.

Dùng rewrite `/api/*` của Next.js sang NestJS để trình duyệt thấy cùng origin, giảm vấn đề CORS và cookie. Callback ZaloPay dùng `https://your-domain.com/api/v1/payments/zalopay/callback`.

Không nên dùng Vercel Hobby cho website bán khóa học vì Vercel giới hạn gói Hobby cho mục đích phi thương mại. [Vercel Hobby](https://vercel.com/docs/plans/hobby)

Production cần:

- Environment riêng cho local, ZaloPay sandbox và production.
- Daily database backup cùng bản `pg_dump` ngoài project.
- Thử restore thực tế trước khi mở bán.
- Backup chưa từng restore là backup chưa được xác minh.
- Structured logs chứa request ID, purchase ID và appTransId nhưng không chứa secret/password/session token.
- Health endpoint cho app và database.
- Cảnh báo payment pending quá hạn, callback sai chữ ký, video lỗi và database gần đầy.

## Kế hoạch triển khai

### Nền tảng

- Khởi tạo pnpm workspace với Next.js, NestJS và PostgreSQL local.
- Cấu hình Prisma migrations, lint, typecheck, test và CI.
- Xây Identity, session auth, role guard và tài khoản admin.
- Hoàn thành schema cùng seed course mẫu.

Điều kiện hoàn thành: admin đăng nhập được, endpoint protected từ chối người không có quyền, migration chạy lại trên database sạch.

### Catalog và quản trị nội dung

- Public catalog và course detail.
- CRUD course, section, lesson.
- Reorder, preview, publish, archive.
- Markdown rendering có sanitize.
- Gắn Cloudflare video UID và tài liệu R2.
- Validation không cho publish nội dung chưa sẵn sàng.

Điều kiện hoàn thành: khóa draft không xuất hiện công khai; khóa published hiển thị đúng curriculum và bài preview.

### Thanh toán

- Hoàn tất merchant sandbox.
- Purchase, PaymentAttempt và checkout QR.
- Callback HMAC, transaction cấp Enrollment.
- Polling trạng thái và resume QR.
- Query reconciliation.
- Lịch sử thanh toán và màn hình admin.
- Email xác nhận sau khi commit thành công.

Điều kiện hoàn thành: callback đúng mở khóa; callback lặp không cấp trùng; callback sai MAC/sai số tiền không mở khóa; mất callback vẫn được query khôi phục.

### Trải nghiệm học

- Dashboard “Khóa học của tôi”.
- Lesson player và signed Stream token.
- Curriculum/sidebar.
- Resume playback, hoàn thành bài và progress.
- Tài liệu tải xuống bằng URL tạm thời.
- Chặn truy cập trực tiếp đối với người chưa mua.

Điều kiện hoàn thành: người chưa mua không lấy được playback token; người đã mua học được sau khi callback hoàn tất; refresh trang vẫn giữ đúng tiến độ.

### Hardening và mở bán

- Rate limit, CSRF, security headers và secret rotation.
- Audit log cho thanh toán và thay đổi Enrollment.
- Backup, restore drill và monitoring.
- Accessibility cơ bản và responsive.
- SEO, sitemap, privacy, terms và refund policy.
- Chạy bộ test ZaloPay sandbox, gửi QC và chuyển production credentials.

## Những thứ cố ý không xây ở bản đầu

Bỏ microservice, Redis, queue, generic provider interfaces, DRM, giỏ hàng, coupon, quiz và chứng chỉ. Một NestJS process cùng PostgreSQL đã đủ; chỉ thêm những phần này khi có tải hoặc yêu cầu nghiệp vụ đo được.
