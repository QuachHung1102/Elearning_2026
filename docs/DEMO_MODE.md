# Demo mode — chạy toàn hệ thống không cần tài khoản bên ngoài

Tài liệu này mô tả cách sản phẩm chạy end-to-end trên một laptop chỉ có PostgreSQL: không ZaloPay merchant, không Cloudflare Stream/R2, không nhà cung cấp email. Chuyển sang nhà cung cấp thật chỉ bằng cách đổi biến môi trường, không sửa code nghiệp vụ.

Đọc [PROJECT_PLAN.md](./PROJECT_PLAN.md) trước. Tài liệu này chỉ bổ sung phần còn thiếu.

### Tài liệu này sở hữu cái gì

Bốn tài liệu khác đã chốt những thứ trước đây phải đoán khi đọc riêng file này. Ở đây **không lặp lại** chúng, chỉ tham chiếu:

| Cần biết | Tài liệu sở hữu |
|---|---|
| Enum, cột, index, ràng buộc, số lượng bản ghi seed | [DATA_MODEL.md](./DATA_MODEL.md) |
| Envelope lỗi, danh mục `code`, guard toàn cục, chữ ký từng endpoint | [API_CONTRACT.md](./API_CONTRACT.md) |
| Route web, page inventory, microcopy tiếng Việt, trạng thái rỗng | [UX_PLAN.md](./UX_PLAN.md) |
| Thứ tự phase, definition of done, test bắt buộc mỗi phase | [ROADMAP.md](./ROADMAP.md) |

Tài liệu này sở hữu đúng bốn thứ: **cách wiring driver seam**, **hành vi của bốn lớp demo**, **cách chặn driver demo ở production**, và **runbook chạy local**.

## Quan hệ với PROJECT_PLAN.md

Ba điểm cần nói rõ vì chúng đi khác kế hoạch gốc.

| Điểm | PROJECT_PLAN.md nói | Ở đây | Lý do |
|---|---|---|---|
| Seam nhà cung cấp | “chưa tạo `PaymentProvider` hay `VideoProvider` generic. Chỉ có `ZaloPayClient` và `CloudflareStreamClient`; khi thực sự xuất hiện nhà cung cấp thứ hai mới trích interface” | Trích interface ngay, nhưng interface mang **hình dạng của đúng nhà cung cấp đó** | “Nhà cung cấp thứ hai” đã xuất hiện: nó là bản demo của chính nhà cung cấp đó. Điều kiện của kế hoạch đã thỏa. |
| Thứ tự phase | Thanh toán ở phase 3, Trải nghiệm học ở phase 4 | Thanh toán làm **cuối cùng** | Quyết định của chủ sở hữu. Seam `Enrollment` có từ ngày đầu nên phase học chạy được trước khi có checkout. |
| Hạ tầng ngày đầu | Railway + Cloudflare Stream + R2 + dịch vụ email từ đầu | Chỉ PostgreSQL local | Chưa có tài khoản nào. Mở rộng, không mâu thuẫn. |

Điều kế hoạch thật sự cấm là **lớp trừu tượng generic**: một `PaymentProvider` chung cho ZaloPay/MoMo/Stripe, một registry, một factory chọn plugin. Cái đó vẫn không được xây. Xem phần dưới.

## 1. Seam driver: một token, hai lớp

Nguyên tắc, áp dụng y hệt cho cả bốn dependency:

- **Một** provider token NestJS cho mỗi dependency.
- **Một** interface, đặt tên theo hợp đồng của chính nhà cung cấp thật (`ZaloPayClient`, không phải `PaymentProvider`).
- **Đúng hai** lớp cài đặt: bản thật và bản demo. Không có lớp thứ ba.
- Chọn lớp bằng `useClass` với một biểu thức ba ngôi tại thời điểm khai báo module. Không factory, không registry, không map, không dynamic import.
- Lớp demo là **fake của chính nhà cung cấp đó**, không phải nhà cung cấp thứ hai. Khi MoMo thật sự xuất hiện, viết module mới — không nhét vào seam này.

| Seam | Token | Interface | Lớp thật | Lớp demo | Biến chọn |
|---|---|---|---|---|---|
| Video | `STREAM_CLIENT` | `StreamClient` | `CloudflareStreamClient` | `LocalStreamClient` | `VIDEO_DRIVER` |
| File | `OBJECT_STORAGE` | `ObjectStorage` | `R2ObjectStorage` | `LocalDiskStorage` | `STORAGE_DRIVER` |
| Email | `MAILER` | `Mailer` | `SmtpMailer` | `DevInboxMailer` | `MAIL_DRIVER` |
| Thanh toán | `ZALOPAY_CLIENT` | `ZaloPayClient` | `ZaloPayHttpClient` | `DemoZaloPayClient` | `PAYMENT_DRIVER` |

Bốn biến độc lập, không có một biến `DEMO_MODE` tổng. Lý do: bật video thật trong khi vẫn dùng email demo là tình huống thật khi lên staging từng phần.

### Mẫu wiring chính xác

```ts
// src/media/stream.client.ts
export const STREAM_CLIENT = Symbol('STREAM_CLIENT');

export type PlaybackToken = {
  playbackUrl: string;
  kind: 'hls' | 'mp4';
  expiresAt: Date;
};

export interface StreamClient {
  getStatus(uid: string): Promise<{ ready: boolean; durationSeconds: number }>;
  register(uid: string): Promise<{ ready: boolean; durationSeconds: number }>;
  signPlayback(
    uid: string,
    ttlSeconds: number,
    viewerId: string,
  ): Promise<PlaybackToken>;
}
```

```ts
// src/media/media.module.ts
import 'dotenv/config';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { CloudflareStreamClient } from './cloudflare-stream.client.js';
import { LocalStreamClient } from './local-stream.client.js';
import { MediaService } from './media.service.js';
import { STREAM_CLIENT } from './stream.client.js';

@Module({
  imports: [PrismaModule],
  providers: [
    MediaService,
    {
      provide: STREAM_CLIENT,
      useClass:
        process.env.VIDEO_DRIVER === 'cloudflare'
          ? CloudflareStreamClient
          : LocalStreamClient,
    },
  ],
  exports: [MediaService],
})
export class MediaModule {}
```

```ts
// src/media/media.service.ts — nghiệp vụ chỉ thấy interface
@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STREAM_CLIENT) private readonly stream: StreamClient,
  ) {}
}
```

Ba điểm về mẫu này:

- Mặc định là **demo**. Chỉ chuỗi `'cloudflare'` mới chọn bản thật — mọi giá trị khác, kể cả `''`, `'DEMO'` hay `'cloudfare'` viết sai, đều rơi về demo. Đó là lý do mục 6 dùng allowlist chứ không dùng blacklist. Quên set biến ở production là lỗi ồn ào, không phải im lặng.
- `useClass` chứ không `useFactory`: cả hai lớp tự đọc `process.env` trong constructor, đúng kiểu `PrismaService` hiện có. Không có tham số runtime nào cần tính trước.
- Đọc `process.env` ở thời điểm eval module, đúng kiểu `auth.module.ts` hiện có (`AUTH_JWT_SECRET`). Giữ một quy ước duy nhất trong repo.

Controller chỉ tồn tại ở demo cũng khai báo theo cách này:

```ts
controllers: [
  ...(config.storageDriver === 'r2' && config.videoDriver === 'cloudflare'
    ? []
    : [LocalFileController]),
],
```

Ở production (cả hai driver thật, `assertNoDemoDriversInProduction` bắt buộc) route đó **không tồn tại**, không phải bị guard chặn.

Từ Phase 3 route này còn phục vụ video mẫu đã ký (mục 2), nên điều kiện gồm cả `VIDEO_DRIVER`:

| `STORAGE_DRIVER` | `VIDEO_DRIVER` | `/api/v1/media/local/*` |
|---|---|---|
| `demo` | bất kỳ | Đủ mọi key: tài liệu, ảnh bìa, upload `PUT`, video mẫu `videos/*.mp4` |
| `r2` | `demo` (chỉ ngoài production) | Chỉ key `videos/{base64url}.mp4` của video mẫu; mọi key khác, cả `GET` lẫn `PUT`, trả `404` — file thật nằm trên R2 (`local-file-r2.spec.ts`) |
| `r2` | `cloudflare` | Route không tồn tại |

### CSRF trên các endpoint mới

API_CONTRACT.md §3.1 chốt: `CsrfGuard` chạy **toàn cục** qua `APP_GUARD`, bỏ qua `GET`/`HEAD`/`OPTIONS`. Không endpoint nào trong tài liệu này được gắn `CsrfGuard` thủ công, và không endpoint nào được quên nó.

Đúng hai ngoại lệ, cả hai đều xác thực bằng HMAC chứ không bằng cookie, nên cả hai gắn `@SkipCsrf()`:

| Endpoint | Vì sao miễn | Xác thực bằng gì |
|---|---|---|
| `POST /api/v1/payments/{provider}/callback` | ZaloPay gọi server-to-server, không có cookie nào để gửi kèm | HMAC `key2` trên body (mục 5) |
| `PUT /api/v1/media/local/{key}` | Uploader có thể `PUT` thẳng từ một context không có cookie CSRF, đúng như R2 presigned PUT | HMAC trong query string (mục 3) |

Quên `@SkipCsrf()` ở endpoint callback nghĩa là ZaloPay nhận `403` và **mọi** giao dịch thật rơi vào đường reconcile. Đây là bug im lặng đắt nhất trong danh sách, viết ra để không phải phát hiện nó bằng tiền thật.

### Kiểm thử qua seam

Cả hai nhánh `useClass` đọc `process.env` **lúc module được evaluate**, không phải lúc provider được khởi tạo. Hệ quả trực tiếp: test **không** đổi được driver bằng cách gán `process.env.VIDEO_DRIVER` sau khi đã `import` module. Đây là cùng cái bẫy mà `auth.module.ts` hiện có (`AUTH_JWT_SECRET` đọc ở top level).

Cách duy nhất đúng — override token, không đổi env:

```ts
const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
  .overrideProvider(STREAM_CLIENT)
  .useClass(LocalStreamClient)
  .compile();
```

Nhờ vậy phần "bước 1–5 không có nhánh nào phụ thuộc driver" ở mục 2 mới thật sự kiểm chứng được: một bộ test quyền truy cập, chạy hai lần với hai lớp cài đặt.

Database cho e2e:

| Điểm | Quyết định |
|---|---|
| Chuỗi kết nối | `apps/api/.env.test`, database riêng tên `elearning_test`. Không bao giờ dùng chung với `elearning`. |
| Nạp biến | `vitest.config.e2e.ts` thêm `test.setupFiles: ['./test/setup-e2e.ts']`; file đó gọi `dotenv.config({ path: '.env.test', override: true })` **trước** mọi import ứng dụng |
| Tạo schema | `test.globalSetup` chạy `prisma migrate deploy`. Không dùng `db push` — mục đích là kiểm luôn migration. |
| Dọn giữa các suite | `TRUNCATE ... RESTART IDENTITY CASCADE` trên mọi bảng trừ `_prisma_migrations`, chạy ở `beforeEach` |

`.env.test` được commit: nó không chứa secret thật, và một file cấu hình test mà mỗi máy một khác là nguồn của "chạy được ở máy tôi".

## 2. Video ở demo mode

Chỉ có **nguồn media** là giả. Toàn bộ đường xác thực là code thật, chạy thật, test thật.

### Endpoint (thật, dùng ở mọi môi trường)

`POST /api/v1/lessons/:lessonId/playback-token`

Thứ tự bắt buộc, chép đúng từ API_CONTRACT.md §6.1. Đây là chuỗi **AND**, không phải chuỗi OR có early return:

1. `SessionAuthGuard` xác minh cookie session và bản ghi `Session` trong database. Bắt buộc kể cả với bài preview.
2. Load `Lesson` → `Section` → `Course` trong một truy vấn.
3. `Course.status !== 'PUBLISHED'` và người gọi không phải `ADMIN` → **`404 NOT_FOUND`**.
4. Cho qua nếu `lesson.isPreview === true`, **hoặc** `auth.user.role === 'ADMIN'`, **hoặc** tồn tại `Enrollment` `(userId, courseId)` với `status = ACTIVE`. Ngược lại → `403 NOT_ENROLLED`.
5. `lesson.videoAssetId == null` → **`404 NOT_FOUND`**.
6. `(await stream.getStatus(videoAsset.externalId)).ready !== true` → `409 VIDEO_NOT_READY`.
7. `stream.signPlayback(videoAsset.externalId, PLAYBACK_TOKEN_TTL_SECONDS, auth.user.id)`.
8. Trả `{ playbackUrl, kind, expiresAt }` và không gì khác.

Bước 3 phải đứng **trước** bước 4, và trả `404` chứ không `403`. Nếu đảo lại — "cho qua nếu preview" rồi mới kiểm `status` — thì bất kỳ ai đăng nhập, biết một `lessonId`, đều lấy được playback token cho bài preview của khóa `DRAFT` hoặc `ARCHIVED`. Điều đó phá thẳng điều kiện hoàn thành phase Catalog trong PROJECT_PLAN.md ("khóa draft không xuất hiện công khai"). `403` cũng sai vì nó xác nhận tài nguyên tồn tại.

Ba bước dễ bị đánh rơi khi chép lại, cả ba đã có lý do ở API_CONTRACT.md §6.1:

- **Nhánh `ADMIN` ở bước 4.** Bước 3 đã miễn cho admin khóa chưa `PUBLISHED`; không miễn tiếp ở bước 4 thì chủ sở hữu nhận `403 NOT_ENROLLED` trên chính bài mình vừa soạn, và hàng "`isPreview` / `DRAFT` / admin → `200`" trong ma trận dưới đây không chạy được. Lượt xem của admin không sinh `LessonProgress` và không tính vào số liệu.
- **Bước 5 tồn tại.** Bài `ARTICLE`, và bài `VIDEO` chưa gắn video, có `videoAssetId = null`. Không có bước này thì bước 6 đọc `videoAsset.externalId` trên `null` → `TypeError` → `500`, trong khi hợp đồng quy định trường hợp này là `404`.
- **`await` ở bước 6.** `StreamClient.getStatus(uid)` trả `Promise`, nên `stream.getStatus(x).ready` là `undefined` và `!== true` **luôn đúng**: thiếu `await` thì **mọi** request trả `409 VIDEO_NOT_READY`, video sẵn sàng hay không cũng vậy.

Ma trận test bắt buộc, dùng tài khoản seed ở mục 8:

| Bài | `Course.status` | Người gọi | Kỳ vọng |
|---|---|---|---|
| `isPreview` | `DRAFT` | `student3` | `404` |
| `isPreview` | `DRAFT` | admin | `200` |
| `isPreview` | `PUBLISHED` | `student3` (chưa mua) | `200` |
| trả phí | `PUBLISHED` | `student3` (chưa mua) | `403 NOT_ENROLLED` |
| trả phí | `PUBLISHED` | `student1` (đã có quyền) | `200` |
| trả phí | `PUBLISHED` | chưa đăng nhập | `401` |
| trả phí | `PUBLISHED` | admin (không có `Enrollment`) | `200` |
| `ARTICLE` (không có `videoAssetId`) | `PUBLISHED` | `student1` (đã có quyền) | `404` |

Bước 1–6 không có nhánh nào phụ thuộc driver. Test quyền truy cập viết một lần, chạy hai lần bằng `overrideProvider` ở mục 1.

### Hai lớp cài đặt

| Method | `CloudflareStreamClient` | `LocalStreamClient` |
|---|---|---|
| `getStatus(externalId)` | Gọi Stream API, đọc `readyToStream`, `duration` | Luôn `{ ready: true, durationSeconds: DEMO_VIDEO_DURATION_SECONDS }` |
| `register(externalId)` (chỉ `POST /admin/videos` gọi) | `POST /stream/{uid}` với `{ uid, requireSignedURLs: true }`, đọc trạng thái từ chính câu trả lời; Cloudflare không xác nhận `requireSignedURLs` thì ném lỗi (`502`), không lưu gì — nếu không, ai đọc được `sub` của token là phát được video mãi | Như `getStatus`; URL demo vốn đã ký |
| `signPlayback(externalId, ttl, viewerId)` | Ký JWT bằng signing key, trả `.../{token}/manifest/video.m3u8`, `kind: 'hls'`. Token Cloudflare không gắn với người xem nên `viewerId` bị bỏ qua | Trả `{API_PUBLIC_URL}/api/v1/media/local/videos/{base64url(externalId)}.mp4?exp=…&sig=…`, `kind: 'mp4'`, `expiresAt = exp` |

`externalId` là `VideoAsset.externalId` (DATA_MODEL.md). Ở demo mode mọi `externalId` bắt đầu bằng `demo/` được ánh xạ về cùng một file — 58 hàng `VideoAsset`, một file trên đĩa.

URL của driver demo là URL **đã ký, có hạn thật** trên chính route media dùng chung, không phải một file tĩnh (PLAN_SUPPLEMENT.md §6 rủi ro 3). Chữ ký là HMAC của `local-file:GET:{key}:{exp}:{viewerId}` (`playbackMessage` trong `object-storage.ts`, cạnh `downloadMessage`):

- `key` chứa `externalId`, mỗi bài học có một `VideoAsset` riêng → URL của bài X không mở được bài Y.
- `viewerId` là id người xin token → khi phục vụ, `LocalFileController` đọc người xem từ cookie `elearning_session` qua `AuthService.authenticate` và ký lại với id đó. URL của user A dán sang phiên của user B → `403 SIGNATURE_INVALID` (N3.4). Không có session → `403 SIGNATURE_INVALID`.
- `exp` hết hạn → `403 SIGNATURE_INVALID` (N3.3).

Khi hợp lệ, route trả file `DEMO_VIDEO_FILE` với `Content-Type: video/mp4`, `Content-Disposition: inline`, `Accept-Ranges: bytes`, `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`, và phục vụ một `Range` đơn (`206` + `Content-Range`; khoảng không thỏa → `416` + `Content-Range: bytes */size`) để tua được.

`getStatus` trả `ready: true` là điều kiện để validation “không cho publish khi video chưa sẵn sàng” (PROJECT_PLAN.md, phase Catalog) chạy được ở local mà không cần Cloudflare.

### File media demo

Một file duy nhất, commit vào repo, nằm trong `apps/api` chứ **không** nằm trong `apps/web/public` — file ở `public/` thì ai biết đường dẫn cũng tải được, và khi đó không test nào về hạn dùng hay chữ ký của playback URL có nghĩa:

```
apps/api/assets/demo/sample.mp4       # test pattern tự sinh (ffmpeg testsrc + anullsrc im lặng), H.264 Constrained Baseline 640×360 24 fps + AAC, faststart, 1.948.743 byte, 60 giây
apps/api/assets/demo/LICENSE.txt      # nguồn (tự sinh, không có nội dung bên thứ ba), CC0, số byte, SHA-256, độ dài giây, lệnh sinh
```

Chọn file local thay vì URL công khai trên internet: chạy được khi mất mạng, không phụ thuộc host của người khác, không có request rời máy. `DEMO_VIDEO_FILE` (đường dẫn tương đối so với thư mục làm việc `apps/api`) cho phép trỏ sang file khác mà không phải sửa code.

Khi thay file, đo độ dài bằng lệnh rồi ghi số đo được vào cả `LICENSE.txt` lẫn `DEMO_VIDEO_DURATION_SECONDS`:

```powershell
ffprobe -v error -show_entries format=duration -of csv=p=0 apps/api/assets/demo/sample.mp4
```

`DEMO_VIDEO_DURATION_SECONDS` **chỉ** phục vụ `getStatus()`, tức là số mà màn hình `/admin/courses/[id]/lessons/[lessonId]` ghi vào `VideoAsset.durationSeconds`. Nó **không** tham gia tính tiến độ. Đặt sai thì màn hình admin hiển thị sai độ dài cho tới khi sửa; không có gì hỏng âm thầm. Bản trước của tài liệu này nói sai điều đó — xem mục "Tiến độ" ngay dưới.

### Player phía web

Player đọc `kind` trong response, không đoán từ đuôi URL:

- `kind: 'mp4'` → `<video src={playbackUrl}>` native.
- `kind: 'hls'` → `hls.js` khi trình duyệt không hỗ trợ HLS native (Safari hỗ trợ sẵn). `hls.js` chỉ được `import()` khi đó, nên trang không tải nó cho MP4 hay HLS native.

CSP của web với HLS qua `hls.js`: playlist và segment đi bằng XHR (`connect-src`), video phát qua Media Source (`media-src blob:`, đã có sẵn). Bản ESM của `hls.js` không tạo worker nên không cần `worker-src`. Host phát của Cloudflare Stream (`https://videodelivery.net`, hoặc customer domain nếu dùng) phải nằm trong `CSP_MEDIA_ORIGINS`, nếu không trình duyệt chặn playlist và player rơi vào "Không phát được video".

Một nhánh `if`, đặt trong component player. Không có component riêng cho demo.

#### Tiến độ

Hai con số khác nhau, đừng trộn:

| Số | Nguồn | Dùng ở |
|---|---|---|
| Tiến độ khóa học | `số bài đã hoàn thành / tổng số bài` — `courseProgress` do API trả | Thanh tiến độ, `/my-courses` |
| Vị trí xem | `LessonProgress.lastPositionSeconds` | Tua lại đúng chỗ khi quay lại bài |

Một bài được coi là hoàn thành khi **một trong hai** điều xảy ra: học viên bấm `CompleteToggle`, hoặc `video.currentTime >= 0.95 * video.duration` (hằng số `COMPLETE_THRESHOLD = 0.95`, khớp UX_PLAN.md §4.6 và acceptance A3.7 của ROADMAP.md). Ngưỡng đọc `video.duration` của phần tử `<video>` đang phát — tức là độ dài **thật** của file đang chạy, không phải `VideoAsset.durationSeconds` trong database. Nhờ đó ngưỡng tự đúng ở cả hai driver và không có bất biến nào phải giữ giữa file mp4 demo và cột trong database.

Nhịp ghi, để `PUT /api/v1/lessons/{lessonId}/progress` (API_CONTRACT.md §5.5) không biến thành bão ghi:

- Mỗi 15 giây trong lúc đang phát.
- Trên `pause`, `ended`, và `visibilitychange` khi tài liệu bị ẩn.
- **Không bao giờ** trên `timeupdate` — sự kiện đó bắn 4–66 lần mỗi giây.

#### Playback token hết hạn giữa buổi học

`expiresAt` được trả cho client để client dùng, không phải để trưng bày:

- Trước khi phát tiếp sau khi tạm dừng, nếu `Date.now() > expiresAt - 60_000` thì xin token mới trước.
- Trên sự kiện `error` của `<video>`, xin token mới và thử lại **đúng một lần**; lần thứ hai thất bại thì hiện `ErrorState` với nút thử lại thủ công.

URL của driver demo cũng hết hạn sau `PLAYBACK_TOKEN_TTL_SECONDS`, nên hai nhánh trên chạy được ở local: đặt TTL ngắn trong `.env` là tái hiện được.

### Điểm khác biệt phải biết

URL demo có chữ ký, có hạn và gắn với người xem, nên đường xác thực phát video chạy thật ở local. Cái demo **không** có là hạ tầng: không encode, không adaptive bitrate, không giới hạn origin nhúng, không chống hotlink ở CDN — ai đang có phiên hợp lệ và một URL còn hạn của chính mình vẫn tải được cả file mp4. Đừng dùng demo mode để kết luận về chất lượng phát hay chi phí băng thông.

## 3. File và tài liệu ở demo mode

Ở đây thì signed URL là **thật**, chỉ khác chỗ chứa byte.

### Interface

```ts
export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

export interface ObjectStorage {
  signedUploadUrl(key: string, contentType: string, sizeBytes: number, ttl: number): Promise<string>;
  signedDownloadUrl(key: string, ttl: number): Promise<string>;
  publicUrl(key: string): string;
  delete(key: string): Promise<void>;
}
```

`publicUrl` là method thứ tư, thêm vào theo API_CONTRACT.md §9.1–§9.2: `CourseCard.coverUrl` là URL **không ký**. Ký ảnh bìa không bảo vệ được gì trên một trang công khai mà làm hỏng cache CDN và cache trình duyệt của toàn bộ catalog — mỗi lần re-sign là một cache miss cho từng ảnh.

| Lớp | `publicUrl(key)` trả về |
|---|---|
| `LocalDiskStorage` | `${API_PUBLIC_URL}/api/v1/media/local/${key}`, **không** có `exp` và `sig` |
| `R2ObjectStorage` | `${R2_PUBLIC_BASE_URL}/${key}` — bucket công khai (hoặc custom domain / `r2.dev` bind vào prefix `public/`), không phải bucket private của tài liệu |

Key giống hệt nhau ở hai chế độ, để đổi driver không phải migrate dữ liệu về sau. Ảnh bìa nằm dưới prefix `public/`, tài liệu bài học thì không:

```
public/courses/{courseId}/cover/{uuid}.{ext}
lessons/{lessonId}/resources/{uuid}-{slugified-filename}.{ext}
```

### `LocalDiskStorage`

- Gốc lưu trữ: `apps/api/.storage/` (`STORAGE_LOCAL_DIR`), đã gitignore.
- Cả hai method trả cùng dạng URL: `${API_PUBLIC_URL}/api/v1/media/local/{key}?exp={unix}&sig={hmac}`. Uploader trong admin viết một lần cho cả hai driver (R2 dùng presigned PUT y hệt).

Chữ ký **phải chứa HTTP method**, và chữ ký upload phải chứa cả `contentType` lẫn `sizeBytes` (R2 ký `content-length` y như vậy, nên URL chỉ nhận body đúng độ dài đã khai):

```ts
const hmac = (message: string) =>
  createHmac('sha256', process.env.AUTH_JWT_SECRET!).update(message).digest('base64url');

const downloadMessage = (key: string, exp: number) => `local-file:GET:${key}:${exp}`;
const uploadMessage = (key: string, contentType: string, sizeBytes: number, exp: number) =>
  `local-file:PUT:${key}:${contentType}:${sizeBytes}:${exp}`;
```

Nếu chuỗi ký không chứa method thì hai method sinh ra **đúng cùng một chữ ký**, và mọi signed download URL mà học viên hợp lệ đang cầm cho một file PDF cũng là chữ ký `PUT` hợp lệ cho chính key đó: học viên `PUT` đè lên tài liệu của khóa học trong suốt TTL. R2 ký HTTP method trong SigV4 và bind `Content-Type` khi được ký, nên bản thật không có lỗ này — bỏ hai thứ đó làm driver demo **lỏng hơn** bản thật ở đúng khía cạnh mà mục 9 tuyên bố là mô phỏng trung thực.

Test chốt chặn, một dòng: lấy URL từ `signedDownloadUrl` rồi `PUT` vào chính nó → phải `403`.

Dùng lại `AUTH_JWT_SECRET` thay vì thêm biến mới, có tiền tố `local-file:` để tách miền sử dụng — chữ ký này không thể dùng nhầm sang chỗ khác và ngược lại.

Không ký `maxBytes` vào URL: `MAX_UPLOAD_BYTES` là hằng số phía server, handler đọc trực tiếp. Ký một giá trị mà chỉ server đặt và chỉ server đọc là thêm bề mặt mà không thêm bảo đảm.

### `LocalFileController` (đủ mọi key khi `STORAGE_DRIVER=demo`; chỉ video mẫu khi `r2` + `VIDEO_DRIVER=demo` — bảng ở mục 1)

#### Khai báo route — cú pháp Express 5

Repo dùng `@nestjs/platform-express@12` → `express@5.2.1` → `path-to-regexp@8.4.2`. Cú pháp wildcard kiểu Express 4 làm app **crash lúc đăng ký route**, không phải 404 lúc runtime. Đã chạy thử trên đúng bản đang cài:

| Pattern | Kết quả |
|---|---|
| `media/local/*` | `Missing parameter name at index 14` |
| `media/local/:key(.*)` | `Unexpected ( at index 17` |
| `media/local/:key` | Đăng ký được nhưng chỉ khớp **một** segment — vô dụng vì key có nhiều `/` |
| `media/local/*key` | Đúng |

Viết:

```ts
@Get('media/local/*key')
download(@Param('key') key: string | string[], @Query() query: SignedUrlQuery) {
  const k = Array.isArray(key) ? key.join('/') : key;   // Express 5 trả mảng segment
  ...
}
```

Express 5 trả param wildcard dưới dạng **mảng các segment đã decode**. Đã kiểm bằng request thật: `/media/local/lessons/abc/resources/x.pdf` → `["lessons","abc","resources","x.pdf"]`. Phải `join('/')` **trước** bước 1; nếu không, regex ở bước 1 chạy trên `[object Object]`, luôn khớp, và toàn bộ biên tin cậy thành no-op. Ký và verify trên `k` đã join, không phải trên raw path.

#### `GET /api/v1/media/local/*key` — đường đọc

Kiểm tra theo đúng thứ tự, trước khi chạm đĩa:

1. `k` khớp `^[A-Za-z0-9/_.-]+$` và không chứa `..`.
2. `path.resolve(storageRoot, k)` phải `startsWith(storageRoot + path.sep)`.
3. `exp` là số nguyên và `exp > now` — **bỏ qua khi `k` khớp `^public/`**.
4. So sánh `hmac(downloadMessage(k, exp))` với `sig` bằng `timingSafeEqual` (dùng lại đúng cách so sánh trong `csrf.guard.ts`) — **bỏ qua khi `k` khớp `^public/`**.
5. Đặt header rồi `res.sendFile(absolutePath)`.

Miễn chữ ký cho `^public/` chỉ áp ở **đường đọc**, và đúng hai bước 3–4. Bước 1 và 2 giữ nguyên cho mọi key — đó mới là biên tin cậy. Đường ghi (`PUT`) **không có ngoại lệ nào**: xem dưới.

Bước 3 và 4 thất bại đều trả `403 SIGNATURE_INVALID` — cùng một mã, cùng một câu. "Chữ ký sai" và "URL hết hạn" không được phân biệt: người cầm URL không cần biết cái nào, và trả lời khác nhau là kể cho họ nghe secret đúng hay sai.

Header ở bước 5 — endpoint này phục vụ **cả** ảnh bìa lẫn tài liệu tải xuống, nên không được hardcode:

| Prefix của key | `Content-Type` | `Content-Disposition` |
|---|---|---|
| `public/courses/*/cover/` | Suy từ đuôi file (`.jpg`/`.png`/`.webp`) | `inline` |
| `lessons/*/resources/` | `LessonResource.contentType` đã lưu lúc upload | `attachment; filename="{LessonResource.filename}"` |

Hardcode `attachment` làm mọi ảnh bìa **tải về** thay vì hiện trong `<img>`. Quy tắc này áp y hệt cho header của R2 presigned URL (`ResponseContentType`, `ResponseContentDisposition`) — nếu không, đổi driver là đổi hành vi hiển thị.

#### `PUT /api/v1/media/local/*key` — đường ghi

Đường ghi **luôn** chạy đủ mọi bước; `^public/` không được miễn gì cả. Bỏ chữ ký cho `public/` ở đây biến `PUT /api/v1/media/local/public/x.svg` thành một lệnh ghi ẩn danh vào gốc storage — không session, không CSRF, không chữ ký — rồi những object đó lại được phục vụ **không ký** cho mọi trang catalog: stored XSS bằng một file SVG, cộng với việc bơm đầy đĩa.

0. `k` khớp `^public/` mà **không** khớp template ảnh bìa do server sinh (`public/courses/{uuid}/cover/{uuid}.{jpg|png|webp}`) → `403 SIGNATURE_INVALID`. Không có bước này, một URL upload đã ký hợp lệ của admin vẫn bị bẻ sang ghi một đường dẫn công khai tùy ý.

Bước 1–3 giống hệt đường đọc, nhưng **không** có ngoại lệ `public/`. Từ bước 4 khác:

4. `Content-Type` của request không nằm trong allowlist theo prefix key → `415`:

   | Prefix của key | `Content-Type` được phép |
   |---|---|
   | `public/courses/*/cover/` | `image/jpeg`, `image/png`, `image/webp` |
   | `lessons/*/resources/` | `application/pdf`, `application/zip`, `image/png`, `image/jpeg`, `text/plain` — đúng năm giá trị của DATA_MODEL.md §LessonResource |

5. `Content-Length` thiếu, không phải số nguyên, hoặc `> MAX_UPLOAD_BYTES` → `413`.
6. So sánh `hmac(uploadMessage(k, req.get('content-type'), req.get('content-length'), exp))` với `sig` bằng `timingSafeEqual`. Sai → `403 SIGNATURE_INVALID`. Vì `contentType` và độ dài nằm trong chuỗi ký, gửi kiểu khác hoặc số byte khác lúc xin URL là chữ ký sai — không cần so sánh riêng.
7. `mkdir -p` thư mục cha, ghi file, trả `204` với body rỗng.

Hai allowlist khác nhau vì hai luồng khác nhau: ảnh bìa được nhúng trong `<img>` trên trang công khai nên chỉ nhận ảnh raster; tài liệu bài học được phát lại cho học viên từ một URL đã ký, nên `text/html` hay `image/svg+xml` lọt vào là một trang chạy script trên chính origin của mình.

Bước 5 là kiểm tra thứ hai, không phải kiểm tra duy nhất. Body parser phải tự chặn trước: `express.raw({ type: '*/*', limit: MAX_UPLOAD_BYTES })` chỉ cho route này. Không có nó thì toàn bộ body đã nằm trong RAM trước khi handler chạy, và bước 5 chỉ báo lỗi sau khi thiệt hại đã xảy ra.

Ghi đè key đã tồn tại là **cho phép** và có chủ ý: admin thay ảnh bìa bằng cách upload lại. `objectKey` do server sinh và chứa một UUID (xem template key ở trên), nên client không chọn được key của người khác — API_CONTRACT.md §5.6 ràng buộc điều đó.

`@SkipCsrf()` bắt buộc trên route này. Xem mục 1.

Bước 1 và 2 là biên tin cậy. Đây là chỗ duy nhất trong demo mode nhận **đường dẫn** từ client — nhưng không phải chỗ duy nhất nhận dữ liệu người dùng chạm tới hệ thống file: xem mục 4, tên file `.eml`.

Endpoint tải tài liệu ở tầng trên (`GET /api/v1/lessons/:id/resources/:resourceId/download`) vẫn kiểm tra `Enrollment` theo đúng bước 1–4 của mục 2, rồi mới gọi `signedDownloadUrl`.

## 4. Email ở demo mode

```ts
export const MAILER = Symbol('MAILER');

export interface Mailer {
  send(message: {
    to: string;
    subject: string;
    html: string;
    text: string;
    tag: 'verify-email' | 'reset-password' | 'purchase-receipt' | 'contact';
  }): Promise<void>;
}
```

Union đóng ở **đúng bốn giá trị**: ba loại thư hệ thống trong PROJECT_PLAN.md §Chức năng hệ thống, cộng thư `contact` mà `POST /contact` của API_CONTRACT.md §5.2 bắt buộc gửi. Ba việc còn lại có sinh email ở sản phẩm khác — cấp quyền học thủ công, khóa tài khoản, hoàn tiền — **không** gửi mail ở v1: chúng được thông báo ngoài hệ thống bởi chính chủ sở hữu, người đã biết học viên là ai vì chính anh ta vừa bấm nút. Gặp tag thứ năm nghĩa là đang thêm tính năng, không phải đang lấp chỗ trống: mở union và cập nhật bảng dưới đây trong cùng PR.

| `tag` | Kích hoạt bởi | Subject |
|---|---|---|
| `verify-email` | `POST /auth/register`, `POST /auth/verify-email/request` | `Xác minh email của bạn` |
| `reset-password` | `POST /auth/password/forgot` | `Đặt lại mật khẩu` |
| `purchase-receipt` | `confirmPayment()` sau khi transaction commit | `Biên nhận đơn hàng {courseTitle}` |
| `contact` | `POST /contact` | `Liên hệ mới từ {name}` |

Ba thư gửi cho người dùng giữ đúng một khung: lời chào theo `displayName`, một câu nói rõ việc gì đang xảy ra, **một** nút CTA duy nhất, một dòng "nếu không phải bạn thì bỏ qua email này", và footer có tên sản phẩm. Thư `contact` gửi cho chủ sở hữu chỉ gồm tên, email, khóa học quan tâm nếu có và nguyên văn nội dung đã được escape HTML. Không ảnh, không tracking pixel, không cột. Câu chữ theo quy ước ở UX_PLAN.md §9.

`DevInboxMailer.send()` làm đúng ba việc, không gửi gì ra ngoài:

1. **Một dòng log có cấu trúc**, gồm link để copy thẳng từ terminal:

```json
{"evt":"mail.sent","tag":"verify-email","to":"student1@elearning.local","subject":"Xác minh email của bạn","link":"http://localhost:3000/verify-email?token=8f2c...","at":"2026-09-01T13:20:11.482Z"}
```

Trường `link` rút từ nội dung mail bằng đúng một regex:

```ts
const LINK = /https?:\/\/[^"'\s<>]*[?&]token=[A-Za-z0-9._~-]+/;
```

Không khớp → ghi `"link":null` ở mức `warn` và **đi tiếp**. Không throw, cùng quy tắc với việc 3. Một regex hụt không được phép chặn đăng ký; dòng `warn` là thứ nói cho bạn biết template mail vừa đổi.

2. **Một file `.eml`** tại `apps/api/.mail/{unix}-{6 byte hex}.eml`, định dạng RFC 822 (`From`, `To`, `Subject`, `Date`, `Content-Type: text/html; charset=utf-8`). Mở được bằng Thunderbird, Outlook hoặc trình duyệt, nên kiểm tra được cả layout HTML lẫn dấu tiếng Việt.

```ts
const id = `${Date.now()}-${randomBytes(6).toString('hex')}`;
await writeFile(join(mailDir, `${id}.eml`), rfc822);
```

**Không** nhét `to` vào tên file. `to` là chuỗi người dùng tự nhập lúc đăng ký; `@IsEmail()` của class-validator chấp nhận quoted local-part, nên một địa chỉ chứa `/` hoặc `\` lọt qua và đi thẳng vào đường dẫn hệ thống file — rồi `GET /api/v1/dev/mail/:id` đọc lại theo chính tên đó, khép kín một vòng ghi-rồi-đọc do client kiểm soát. Người nhận đã nằm trong header `To:` bên trong file; đưa nó vào tên file không thêm thông tin, chỉ thêm biên tin cậy.

3. Không throw khi ghi file lỗi — chỉ log `warn`. Email hỏng không được làm hỏng đăng ký.

### Hộp thư dev

`GET /api/v1/dev/mail` — trang HTML thuần do API render: 50 mail gần nhất, mỗi dòng gồm thời gian, `tag`, người nhận, tiêu đề, và nút mở link.
`GET /api/v1/dev/mail/:id` — render `.eml` đó.

`:id` là **tên file không kèm đuôi**. Trước khi chạm đĩa, hai kiểm tra giống hệt mục 3 — cùng biên tin cậy thì cùng cách đối xử:

1. `:id` khớp `^\d{13}-[0-9a-f]{12}$`.
2. `path.resolve(mailDir, id + '.eml')` phải `startsWith(mailDir + path.sep)`.

Định dạng id ở việc 2 tồn tại để bước 1 là một regex chật, không phải một regex đoán.

Chọn API render HTML thay vì thêm route Next: không cần state, không cần auth phía web, không cần fetch chéo, và route này biến mất hoàn toàn ở production cùng `DevModule`.

### Ai mở được hộp thư dev

`/dev/*` chạy sau **một** `AdminGuard` duy nhất (API_CONTRACT.md §3.1–§3.2): guard đó tự gọi `AuthService.authenticate` và ném `NotFoundException` ở mọi nhánh thất bại. Không xếp `SessionAuthGuard` trước nó — Nest dừng ở guard đầu tiên ném exception, nên chuỗi hai guard trả `401` cho khách ẩn danh và làm hỏng tính chất "bề mặt admin không quan sát được từ bên ngoài". Hộp thư dev **không** phải đường đi của học viên, và học viên vừa đăng ký không mở được nó.

Đó là chủ ý, và nó không chặn luồng xác minh vì có hai đường:

| Bạn muốn | Làm gì |
|---|---|
| Lấy link verify của tài khoản vừa đăng ký (mặc định) | Copy trường `link` trong dòng log ở terminal. Không cần đăng nhập gì cả. |
| Xem layout HTML, dấu tiếng Việt, danh sách mail gần đây | Đăng nhập admin (`admin@elearning.local`) rồi mở `/api/v1/dev/mail` |

Người chạy demo là developer, và developer có sẵn tài khoản admin từ seed. Một quy tắc cho toàn bộ `/dev/*` — admin-only, không ngoại lệ — đáng giá hơn một route không guard để tiết kiệm một lần đăng nhập.

## 5. Thanh toán ở demo mode

Thanh toán làm cuối cùng. Chia làm hai giai đoạn.

### Giai đoạn A — trước khi có module thanh toán

Không có gì “thay thế thanh toán”. Có một tính năng thật:

`POST /api/v1/admin/enrollments` — quản trị viên cấp quyền học thủ công (`ManualGrant` trong PROJECT_PLAN.md).
`DELETE /api/v1/admin/enrollments/:id` — thu hồi.

Đây không phải hack demo. Nó là tính năng vĩnh viễn cho hoàn tiền, tài khoản tặng và xử lý hỗ trợ. Nó chỉ tình cờ là cách duy nhất tạo `Enrollment` trong lúc chưa có checkout.

Seam bắt buộc phải tồn tại **từ ngày đầu**, và cả hai đường đều gọi đúng nó. Hai hàm, không phải một — thu hồi cũng là một đường ghi cần audit:

```ts
// src/enrollment/enrollment.service.ts
grant(input: {
  userId: string;
  courseId: string;
  source: EnrollmentSource;   // 'PURCHASE' | 'MANUAL_GRANT'
  purchaseId?: string;
  actorId: string | null;     // admin id; null khi do thanh toán tự động
  note?: string;              // đi vào AuditLog.metadata, không phải cột trên Enrollment
  tx?: PrismaTransaction;     // để callback gọi trong cùng transaction
}): Promise<Enrollment>

revoke(input: {
  enrollmentId: string;
  actorId: string | null;
  reason: string;
  tx?: PrismaTransaction;
}): Promise<Enrollment>
```

`grant`: một upsert theo unique `(userId, courseId)`, một dòng `AuditLog`. Cấp trùng là no-op idempotent. Ghi `Enrollment.grantedById = actorId` và `status = ACTIVE`.

`revoke`: đặt `status = REVOKED` và `revokedAt = now()`, **không bao giờ xóa hàng**, một dòng `AuditLog` với `reason` trong `metadata`. Cả `DELETE /api/v1/admin/enrollments/:id` lẫn luồng hoàn tiền tương lai (`POST /admin/purchases/{id}/refund`) đều gọi đúng hàm này. Giữ hàng lại là điều kiện để trả lời được "vì sao người này từng học được khóa này" sáu tháng sau.

`actorId` **nullable**, khớp `AuditLog.actorId` và `Enrollment.grantedById` trong DATA_MODEL.md (cả hai `onDelete: SetNull`). `null` nghĩa là "hệ thống", tức đường thanh toán. Không tạo user `system@…` giả: một hàng `User` không đăng nhập được, không nhận mail, không có mật khẩu là một tài khoản ma trong bảng người dùng và trong mọi báo cáo đếm học viên. Cột nullable rẻ hơn.

Khi module thanh toán ra đời, nó gọi `grant({ source: 'PURCHASE', actorId: null, ... })` — không viết đường cấp quyền thứ hai. Đây chính là điều PROJECT_PLAN.md yêu cầu (“Không viết hai luồng cấp `Enrollment` độc lập”), chỉ là được thỏa mãn sớm hơn.

Chuỗi guard cho hai route admin, viết rõ vì repo hiện chưa có guard toàn cục nào:

```ts
@UseGuards(AdminGuard)   // MỘT guard duy nhất; CsrfGuard là APP_GUARD, xem mục 1
```

**Một** guard, không phải hai. `AdminGuard` tự gọi `AuthService.authenticate` rồi ném `NotFoundException` ở mọi nhánh thất bại — thiếu cookie, JWT hỏng, session bị thu hồi, user không `ACTIVE`, `role !== ADMIN`. Xếp `SessionAuthGuard` trước nó thì request ẩn danh nhận `401` và không bao giờ chạm `AdminGuard`; API_CONTRACT.md §3.1 đã kiểm chứng điều này bằng một Nest app thật, và đó là lý do chuỗi hai guard bị loại.

### Giai đoạn B — khi module thanh toán đã có, driver `demo`

#### Interface `ZaloPayClient`

Viết ra đầy đủ, vì cả hai lớp cài đặt đều không dựng được nếu thiếu nó. Tên field giữ nguyên `snake_case` của ZaloPay ở chỗ nào đi thẳng ra dây — đổi tên chỉ để cho đẹp là thêm một lớp map để sai:

```ts
// src/checkout/zalopay.client.ts
export const ZALOPAY_CLIENT = Symbol('ZALOPAY_CLIENT');

export type CreateOrderInput = {
  appTransId: string;      // do CheckoutService sinh, KHÔNG do client sinh
  appUser: string;         // `app_user`: học viên đang trả tiền (id người dùng); nhà cung cấp từ chối giá trị rỗng
  amountVnd: number;       // = PaymentAttempt.amountVnd
  description: string;     // hiện trong app ZaloPay
  embedData: { courseId: string; purchaseId: string };
  expiresAt: Date;
};

export type CreateOrderResult = {
  qrCode: string;          // → PaymentAttempt.qrCode
  orderUrl: string;        // → PaymentAttempt.orderUrl
  zpTransToken: string;    // chỉ để log; không lưu cột riêng
};

export type QueryOrderResult = {
  returnCode: 1 | 2 | 3;   // 1 thành công, 2 thất bại, 3 đang xử lý
  returnMessage: string;
  zpTransId?: string;      // → PaymentAttempt.providerTransId khi returnCode = 1
  amountVnd?: number;      // phải khớp amountVnd đã snapshot
};

export type ZaloPayCallbackData = {
  app_id: number;
  app_trans_id: string;
  app_time: number;        // epoch ms
  amount: number;          // VND
  zp_trans_id: string;
  embed_data: string;      // JSON string
  item: string;
};

export interface ZaloPayClient {
  createOrder(input: CreateOrderInput): Promise<CreateOrderResult>;
  queryOrder(appTransId: string): Promise<QueryOrderResult>;
  /** Ném nếu MAC sai. Không bao giờ trả về khi chữ ký không hợp lệ. */
  verifyCallback(body: { data: string; mac: string }): ZaloPayCallbackData;
}
```

Endpoint callback trả về đúng shape ZaloPay chờ đợi, **luôn với HTTP 200** — 4xx chỉ làm nhà cung cấp retry vô ích:

| Tình huống | Body trả về |
|---|---|
| Xử lý xong (kể cả callback lặp) | `{ "return_code": 1, "return_message": "success" }` |
| MAC sai | `{ "return_code": -1, "return_message": "mac not equal" }` |
| Lỗi tạm thời phía mình, muốn ZaloPay gọi lại | `{ "return_code": 0, "return_message": "retry" }` |

#### `app_trans_id` — ai sinh và sinh thế nào

`CheckoutService` sinh, **không phải** `ZaloPayClient`. Đây là điều PROJECT_PLAN.md đã yêu cầu ("Backend tạo `app_trans_id` duy nhất … và gọi API ZaloPay") và là lý do `appTransId` là cột `unique` trên `PaymentAttempt`. Nếu client sinh id thì id chỉ tồn tại sau khi gọi provider: mất response mạng giữa chừng nghĩa là có đơn ZaloPay thật mà database không có `app_trans_id` nào để đối soát — đúng kịch bản mà PROJECT_PLAN.md bắt buộc phải xử lý được.

Thứ tự bắt buộc:

1. Trong một transaction: tạo/cập nhật `Purchase`, tạo `PaymentAttempt` với `appTransId` và `status = PENDING`. Commit.
2. **Ngoài** transaction: gọi `createOrder({ appTransId, ... })`.
3. Cập nhật `qrCode`, `orderUrl` vào hàng vừa tạo.

Bước 2 nằm ngoài transaction vì PROJECT_PLAN.md cấm giữ transaction PostgreSQL mở trong lúc gọi mạng. Bước 2 hỏng thì hàng `PENDING` vẫn ở đó và tác vụ reconcile nhặt được.

Định dạng `yymmdd_{seq}`, duy nhất theo merchant theo ngày:

```ts
const day = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: '2-digit', month: '2-digit', day: '2-digit',
}).format(new Date()).replaceAll('-', '');          // "260902"

const appTransId = `${day}_${randomBytes(4).toString('hex')}`;
```

**Không** dùng `new Date().toISOString()` để lấy `yymmdd`. Server chạy UTC trên Railway; đã kiểm bằng lệnh: lúc `2026-09-01T20:00:00Z`, UTC cho `260901` còn giờ Việt Nam cho `260902`. Nghĩa là từ 00:00 tới 07:00 giờ Việt Nam, tiền tố ngày sẽ là ngày hôm trước và đối soát tìm nhầm ngăn. Thêm `TZ="Asia/Ho_Chi_Minh"` vào khối lõi của `.env.example` (mục 7) cũng không đủ để bỏ `timeZone` tường minh ở đây — biến `TZ` là thứ dễ mất khi đổi nền tảng, còn dòng trên thì không.

`randomBytes(4)` thay vì bộ đếm: một chủ sở hữu bán vài chục đơn mỗi ngày, xác suất trùng trong 4 tỉ giá trị là không đáng kể, và cột `unique` sẽ bắt nốt phần còn lại. Sequence trong PostgreSQL sẽ đúng hơn nhưng thêm một object schema để giải một bài toán chưa tồn tại.

#### `DemoZaloPayClient`

Cài đúng interface trên, không gọi mạng, và **không inject `PrismaService`**:

| Method | Hành vi demo |
|---|---|
| `createOrder(input)` | Ghi `{ appTransId → { status: 'PENDING', amountVnd } }` vào một `Map` trong process. Trả `qrCode` = URL trang confirm dev, `orderUrl` trỏ về trang checkout local, `zpTransToken` là chuỗi ngẫu nhiên. Không I/O mạng. |
| `queryOrder(appTransId)` | Đọc **`Map` của chính nó**, ánh xạ sang `returnCode`. Không đọc database. |
| `verifyCallback(body)` | Kiểm HMAC bằng `ZALOPAY_KEY2` — dùng **cùng một hàm** với bản thật, chỉ khác khóa lấy từ giá trị demo. |

`Map` riêng chứ không đọc `PaymentAttempt` là điểm mấu chốt. Nếu `queryOrder` đọc chính bảng mà tác vụ reconcile sắp cập nhật thì nó không bao giờ trả về trạng thái khác trạng thái local — mà **phát hiện phân kỳ provider/local chính là toàn bộ lý do reconcile tồn tại**. Test reconcile sẽ chạy xanh mà không kiểm chứng gì.

Với `Map` riêng, ca test có ý nghĩa dựng được: đặt `Map` = `SUCCEEDED` trong khi `PaymentAttempt` vẫn `PENDING`, chạy reconcile, khẳng định `Enrollment` được cấp. Đó đúng là kịch bản "callback bị mất" mà PROJECT_PLAN.md bắt buộc phải xử lý được.

```ts
// ponytail: Map in-process, mất khi restart API — đủ cho demo.
// Nâng cấp thành bảng riêng chỉ khi cần test reconcile qua nhiều lần restart.
```

Ánh xạ trạng thái, dùng đúng tên member của `PaymentAttemptStatus` trong DATA_MODEL.md:

| `PaymentAttemptStatus` | `returnCode` | Ý nghĩa ZaloPay |
|---|---|---|
| `PENDING` | `3` | Đang xử lý — reconcile để nguyên và hỏi lại lần sau |
| `SUCCEEDED` | `1` | Thành công — reconcile đưa vào `confirmPayment` |
| `FAILED`, `EXPIRED`, `CANCELLED` | `2` | Thất bại — reconcile đóng attempt, không cấp quyền |

QR hiển thị trên màn hình encode URL trang confirm dev. Nó **không** phải VietQR và app ngân hàng không quét được — mục 9 nói rõ điều đó. Trong demo mode, đường đi là bấm link ngay dưới ảnh QR, không phải giơ điện thoại lên.

#### Một tác vụ định kỳ

`CHECKOUT_QR_TTL_MINUTES` sinh ra hai hành vi theo lịch — đối soát callback bị mất và đóng attempt quá hạn — và hiện **chưa có gì chạy chúng**: PROJECT_PLAN.md đã loại queue.

Cả hai nằm trong **một** vòng lặp `setInterval`, khởi trong `OnModuleInit` của `ReconcileService`, hủy trong `OnModuleDestroy`. **Không** thêm `@nestjs/schedule`: một dependency cho vài dòng `setInterval` là đúng thứ nguyên tắc "không thêm dependency cho việc vài dòng làm được" cấm, và API_CONTRACT.md §5.8 cùng ROADMAP.md §8 đều đã chốt như vậy. Không queue, không Redis, không chuỗi cron — một chuỗi cron không lái được `setInterval`, và đó là lý do biến `RECONCILE_CRON` bị xóa.

| Điểm | Giá trị |
|---|---|
| Chu kỳ | `RECONCILE_INTERVAL`, mặc định `60` giây |
| Bỏ qua attempt mới | `RECONCILE_MIN_AGE`, mặc định `120` giây — để callback thật có cơ hội tới trước; hỏi provider về một đơn vừa tạo 3 giây trước chỉ tốn quota |

Mỗi lượt chạy làm hai việc, theo đúng thứ tự này:

1. Quét `PaymentAttempt` `status = PENDING` cũ hơn `RECONCILE_MIN_AGE` → gọi `queryOrder`; `returnCode = 1` → dựng payload và gọi `confirmPayment`; `= 2` → `status = FAILED`; `= 3` → để nguyên.
2. Attempt còn `PENDING` mà `expiresAt < now()` → ghi `EXPIRED`. Một câu `UPDATE` có điều kiện, dùng đúng index `(status, expiresAt)` đã có trong DATA_MODEL.md.

Đặt việc 2 **sau** việc 1 trong cùng một lượt: nếu đảo lại, một attempt vừa được provider báo `1` có thể bị đánh `EXPIRED` trước khi kịp đối soát. Cùng lý do, attempt mà việc 1 gặp lỗi (gọi `queryOrder` ném ngoại lệ, hoặc `confirmPayment` ném — ví dụ transaction quá 5 s khi DB tải nặng) **không** bị việc 2 đóng trong lượt đó: nó vẫn `PENDING` và được hỏi lại ở lượt sau. Đóng nó ngay thì provider đã thu tiền mà lượt sau (chỉ hỏi `PENDING`) không bao giờ thấy nó nữa. Vì attempt đó vẫn `PENDING`, đơn của nó cũng không bị việc hủy đơn bỏ dở chạm tới.

Vòng lặp chạy trên **mọi** instance. Ở một instance — cấu hình hiện tại — điều đó không có nghĩa gì. Từ hai instance trở lên vẫn an toàn vì `confirmPayment` đã idempotent và việc 2 là một `UPDATE` có điều kiện, nhưng sẽ tốn gấp đôi lượt gọi ZaloPay. Đó là lúc thêm advisory lock của PostgreSQL, không phải bây giờ.

### Endpoint confirm dev

`POST /api/v1/dev/payments/:appTransId/confirm` — `@UseGuards(SessionAuthGuard, AuthRateLimitGuard)`, 10 lần/phút mỗi người dùng. Người gọi phải là **chính người mua** của đơn (attempt → purchase → `userId`) hoặc `ADMIN`; ai khác nhận `404` y như `appTransId` không tồn tại, nên mã đơn của người khác không lộ gì. Đây là route `/dev/*` duy nhất không dùng `AdminGuard`.

Nó **không** tự cấp `Enrollment`. Nó đặt `Map` của `DemoZaloPayClient` sang `SUCCEEDED`, dựng payload callback đúng schema của ZaloPay (ký MAC bằng `ZALOPAY_KEY2` demo) rồi gọi:

```ts
await this.checkout.confirmPayment(payload);
```

Đúng hàm mà callback thật gọi và tác vụ reconcile gọi. Nghĩa là xác minh MAC, xác minh số tiền, idempotency, chuyển trạng thái `PaymentAttempt`, transaction PostgreSQL và `enrollment.grant()` đều được chạy thật. Bấm confirm hai lần vẫn chỉ ra một `Enrollment` — và đó là test có ý nghĩa.

Học viên bấm nút **"Thanh toán"** ngay trên trang `/checkout/[courseSlug]`: màn hình vẫn y như hiện tại (QR, tóm tắt đơn, đồng hồ đếm ngược), chỉ thêm ghi chú "không trừ tiền thật" và nút này thay cho việc quét mã. Bấm xong, trang đọc lại đơn đã lưu và chuyển sang kết quả "Thanh toán thành công" → "Vào học". Không cần admin, không có tiền thật. Admin vẫn xác nhận được mọi đơn từ `/admin/orders` (chọn attempt đang `PENDING`, bấm xác nhận). Không có trang HTML không guard, không có QR quét được bằng điện thoại: route vẫn cần phiên đăng nhập và CSRF như mọi mutation khác.

### Ba lớp chặn ở production

1. `DevModule` chỉ được import khi có ít nhất một driver ở chế độ demo. Ở production route **không tồn tại** → 404.
2. Kiểm tra ở mục 6 làm app không khởi động nổi với bất kỳ driver demo nào ở production.
3. `@UseGuards(AdminGuard)` trên các route `/dev/*` (API_CONTRACT.md §3.1–§3.2), phòng trường hợp ai đó chạy demo mode trên một máy có người khác truy cập được. Ngoại lệ duy nhất là endpoint confirm thanh toán ở trên: nó cần phiên đăng nhập và chỉ chạy cho người mua của đơn hoặc admin.

Lớp 1 là lớp thật sự có tác dụng. Hai lớp còn lại là để phòng cấu hình sai. Hộp thư dev vẫn chỉ admin xem được, xem mục 4.

## 6. Chặn demo driver ở production

Không có escape hatch. Không có `ALLOW_DEMO_IN_PRODUCTION`. Nếu tồn tại một biến để bỏ qua kiểm tra này thì sớm muộn nó sẽ được set.

```ts
// src/config/drivers.ts
import 'dotenv/config';

/** Nguồn sự thật duy nhất: giá trị mà đúng biểu thức `useClass` ở mục 1 chấp nhận. */
const REAL_DRIVER = {
  VIDEO_DRIVER: 'cloudflare',
  STORAGE_DRIVER: 'r2',
  MAIL_DRIVER: 'smtp',
  PAYMENT_DRIVER: 'zalopay',
} as const;

const DEMO_DRIVER = {
  VIDEO_DRIVER: 'demo',
  STORAGE_DRIVER: 'demo',
  MAIL_DRIVER: 'demo',
  PAYMENT_DRIVER: 'demo',
} as const;

/** Chạy ở MỌI môi trường. Giá trị rác không được phép im lặng rơi về demo. */
export function assertDriverValuesAreKnown(): void {
  for (const name of Object.keys(REAL_DRIVER) as (keyof typeof REAL_DRIVER)[]) {
    const value = process.env[name];
    if (value === undefined) continue;
    if (value !== REAL_DRIVER[name] && value !== DEMO_DRIVER[name]) {
      throw new Error(
        `${name}="${value}" is not a valid driver. Expected "${DEMO_DRIVER[name]}" or "${REAL_DRIVER[name]}".`,
      );
    }
  }
}

export function assertNoDemoDriversInProduction(): void {
  const isProduction =
    process.env.NODE_ENV === 'production' ||
    process.env.RAILWAY_ENVIRONMENT_NAME === 'production';

  if (!isProduction) return;

  // Không phải chuỗi chọn bản thật = demo. Bao gồm cả undefined và "".
  const demo = (Object.keys(REAL_DRIVER) as (keyof typeof REAL_DRIVER)[])
    .filter((name) => process.env[name] !== REAL_DRIVER[name]);

  if (demo.length > 0) {
    throw new Error(
      `Refusing to boot in production with demo drivers: ${demo.join(', ')}`,
    );
  }
}

assertDriverValuesAreKnown();
assertNoDemoDriversInProduction();
```

```ts
// src/main.ts
import './config/drivers.js';        // PHẢI là dòng import đầu tiên
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);
  await app.listen(process.env.PORT ?? 3001);
}
await bootstrap();
```

Bốn chi tiết, mỗi cái sửa một lỗi cụ thể:

- **Allowlist, không phải blacklist.** Bản trước lọc `(process.env[name] ?? 'demo') === 'demo'`. `??` chỉ bắt `null`/`undefined`, **không** bắt chuỗi rỗng — mà chính `.env.example` ở mục 7 dạy đúng thói quen viết `VAR=""` cho mọi biến `[PROD]`. Đã chạy thử: với `NODE_ENV=production` và bốn biến driver đặt bằng `""`, danh sách `demo` ra rỗng, kiểm tra **PASS**, app boot bình thường — trong khi mọi biểu thức `useClass` vẫn chọn lớp demo vì `'' !== 'cloudflare'`. Production khởi động thành công với mp4 không bảo vệ trong `public/`, storage ký bằng HMAC tự chế, mailer ghi ra đĩa thay vì gửi, và `DemoZaloPayClient` cấp `Enrollment` mà không có tiền. Allowlist đảo ngược mặc định: thứ gì không **đúng bằng** chuỗi khiến `useClass` chọn lớp thật thì nó là demo. Một nguồn sự thật, cùng một hằng số.
- **Kiểm giá trị hợp lệ ở mọi môi trường.** `VIDEO_DRIVER=cloudfare` (gõ thiếu chữ) hay `STORAGE_DRIVER=true` trước đây lặng lẽ chọn lớp demo ở local, và developer ngồi debug vì sao Cloudflare không được gọi. Tài liệu này lập luận rằng cấu hình sai phải là "lỗi ồn ào, không phải im lặng" — `assertDriverValuesAreKnown` là chỗ áp dụng nó cho trường hợp xảy ra hằng ngày, chứ không chỉ cho production.
- **`RAILWAY_ENVIRONMENT_NAME === 'production'`, không phải `Boolean(RAILWAY_ENVIRONMENT_ID)`.** Railway đặt `RAILWAY_ENVIRONMENT_ID` trong **mọi** environment. Dùng nó nghĩa là service staging/sandbox trên Railway không boot nổi với `MAIL_DRIVER=demo` — trong khi PROJECT_PLAN.md §Triển khai đòi một environment ZaloPay sandbox riêng, và mục 1 tách bốn biến độc lập **chính vì** phải lên staging từng phần. Kiểm theo tên environment giữ nguyên ý định đó. (`auth-rate-limit.guard.ts` vẫn dùng `RAILWAY_ENVIRONMENT_ID` và vẫn đúng: ở đó câu hỏi là "có edge proxy Railway phía trước không", và câu trả lời đúng là "có, ở mọi environment".)
- **Side-effect import, không phải lời gọi hàm trong `bootstrap()`.** `apps/api/package.json` khai `"type": "module"`; toàn bộ đồ thị import được evaluate xong **trước** câu lệnh đầu tiên trong thân `main.ts`. Đã chạy repro: với `import { AppModule }` đứng trước, thứ tự thực tế là `app.module` evaluate (mọi biểu thức `useClass` ở mục 1 chạy ở đây, mảng `controllers` chốt, quyết định import `DevModule` chốt, và `auth.module.ts` có cơ hội ném `AUTH_JWT_SECRET must contain at least 32 bytes` trước — che mất thông báo lỗi driver) rồi mới tới lời gọi kiểm tra. Đặt `import './config/drivers.js'` làm **dòng import đầu tiên** thì ESM evaluate nó trước, đúng theo thứ tự khai báo import.

Điều được đảm bảo là **không provider nào được instantiate và không kết nối nào được mở** — không phải "không module nào được evaluate". Evaluate một file module Nest chỉ chạy decorator và tính metadata; nó không mở socket, không chạm database. Ranh giới đó là ranh giới thật sự quan trọng.

### Sandbox trên Railway

Environment sandbox được phép chạy `MAIL_DRIVER=demo` và `STORAGE_DRIVER=demo` trong khi `PAYMENT_DRIVER=zalopay` trỏ `ZALOPAY_ENDPOINT` vào `https://sb-openapi.zalopay.vn/v2`. Đó chính là hình dạng của giai đoạn chạy bộ test QC của ZaloPay: thanh toán thật với sandbox credentials, mọi thứ còn lại vẫn demo. Chỉ environment đặt tên `production` mới bị chặn.

### Kiểm chứng

```ts
// src/config/drivers.spec.ts
it.each(['', 'DEMO', 'demo ', 'true'])(
  'từ chối boot production khi VIDEO_DRIVER = %j',
  (value) => {
    process.env.NODE_ENV = 'production';
    process.env.VIDEO_DRIVER = value;
    expect(() => assertNoDemoDriversInProduction()).toThrow(/VIDEO_DRIVER/);
  },
);

it('từ chối boot production khi driver chưa được set', () => {
  process.env.NODE_ENV = 'production';
  delete process.env.VIDEO_DRIVER;
  expect(() => assertNoDemoDriversInProduction()).toThrow(/VIDEO_DRIVER/);
});

it('từ chối giá trị lạ ở mọi môi trường', () => {
  process.env.NODE_ENV = 'development';
  process.env.VIDEO_DRIVER = 'cloudfare';
  expect(() => assertDriverValuesAreKnown()).toThrow(/cloudfare/);
});
```

Ca `''` là ca bắt buộc. Chỉ một test `delete process.env.VIDEO_DRIVER` thì không phát hiện được lỗ mà bản trước của tài liệu này mắc phải.

Hai hàm được `export` để test gọi trực tiếp, còn `main.ts` chỉ import file vì side effect. Test phải khôi phục `process.env` trong `afterEach` — module này chạy assert ngay lúc được import.

## 7. `.env.example` đầy đủ

Đánh dấu `[PROD]` = chỉ bắt buộc khi driver tương ứng chạy bản thật; để trống ở local là đúng.

`apps/api/.env.example`:

```dotenv
# ── Lõi (bắt buộc ở mọi môi trường) ───────────────────────────
# Chuỗi kết nối PostgreSQL, dùng bởi Prisma adapter-pg.
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/elearning"
# Cổng NestJS lắng nghe.
PORT=3001
# development | production. Ảnh hưởng cookie Secure và kiểm tra driver.
NODE_ENV=development
# Múi giờ process. Mọi mốc thời gian hiển thị và app_trans_id đều là giờ Việt Nam.
TZ="Asia/Ho_Chi_Minh"
# Secret ký JWT session, tối thiểu 32 byte. Cũng dùng để ký URL file local.
# Sinh bằng: node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
AUTH_JWT_SECRET=""
# Origin người dùng thấy — dùng để dựng link trong email (API_CONTRACT.md §5.1).
WEB_ORIGIN="http://localhost:3000"
# Origin mà TRÌNH DUYỆT thấy, không phải cổng nội bộ của API: /api/* được
# next.config.ts rewrite sang API nên mọi signed URL phải mang origin này,
# nếu không lệnh PUT của uploader thành cross-origin và bị CORS chặn.
API_PUBLIC_URL="http://localhost:3000"

# ── Chọn driver (mặc định demo; production phải set hết) ──────
# demo | cloudflare
VIDEO_DRIVER=demo
# demo | r2
STORAGE_DRIVER=demo
# demo | smtp
MAIL_DRIVER=demo
# demo | zalopay
PAYMENT_DRIVER=demo

# ── Cấu hình driver demo (bỏ qua ở production) ────────────────
# File video mẫu, tương đối so với apps/api. API phục vụ nó qua URL đã ký
# /api/v1/media/local/videos/…, không bao giờ qua thư mục public của web.
DEMO_VIDEO_FILE="assets/demo/sample.mp4"
# Độ dài thật của clip, đo bằng ffprobe. Chỉ dùng cho getStatus(); không tính tiến độ.
DEMO_VIDEO_DURATION_SECONDS=60
# Thư mục lưu file, tương đối so với apps/api. Đã gitignore.
STORAGE_LOCAL_DIR=".storage"
# Thư mục chứa .eml của hộp thư dev. Đã gitignore.
LOCAL_MAIL_DIR=".mail"

# ── Cloudflare Stream — VIDEO_DRIVER=cloudflare ───────────────
# [PROD] Account ID trên Cloudflare Dashboard.
CLOUDFLARE_ACCOUNT_ID=""
# [PROD] API token phạm vi Stream:Read + Stream:Edit.
CLOUDFLARE_STREAM_API_TOKEN=""
# [PROD] ID của signing key dùng ký playback token.
CLOUDFLARE_STREAM_SIGNING_KEY_ID=""
# [PROD] Private key PEM (base64) tương ứng signing key ở trên.
CLOUDFLARE_STREAM_SIGNING_KEY_PEM=""
# Hạn playback token. Ngắn thôi; token rò rỉ chỉ sống được chừng này.
PLAYBACK_TOKEN_TTL_SECONDS=3600

# ── Cloudflare R2 — STORAGE_DRIVER=r2 ─────────────────────────
# [PROD] Endpoint S3-compatible của R2.
R2_ENDPOINT=""
# [PROD] Tên bucket private chứa ảnh bìa và tài liệu.
R2_BUCKET=""
# [PROD] Access key ID của R2 API token.
R2_ACCESS_KEY_ID=""
# [PROD] Secret access key tương ứng.
R2_SECRET_ACCESS_KEY=""
# [PROD] Base URL công khai của prefix public/ (custom domain hoặc r2.dev).
# Dùng bởi ObjectStorage.publicUrl() cho ảnh bìa — không ký, cache được ở CDN.
R2_PUBLIC_BASE_URL=""
# Hạn signed URL cho tải tài liệu. Dùng chung cho cả driver demo.
SIGNED_FILE_TTL_SECONDS=300
# Giới hạn dung lượng upload từ admin, đơn vị byte.
MAX_UPLOAD_BYTES=52428800

# ── Email — MAIL_DRIVER=smtp ──────────────────────────────────
# [PROD] Chuỗi SMTP, ví dụ smtps://user:pass@smtp.provider.com:465
SMTP_URL=""
# [PROD] Địa chỉ gửi; domain phải khớp bản ghi SPF/DKIM đã cấu hình.
MAIL_FROM="E-learning <no-reply@your-domain.com>"
# Hạn dùng của link xác minh email. Dài, vì người ta mở thư vào tối hôm sau.
EMAIL_VERIFY_TTL_MINUTES=1440
# Hạn dùng của link đặt lại mật khẩu. Ngắn, vì nó là chìa khóa tài khoản.
PASSWORD_RESET_TTL_MINUTES=60

# ── ZaloPay — PAYMENT_DRIVER=zalopay ──────────────────────────
# [PROD] AppId do ZaloPay cấp (sandbox trước, production sau QC).
ZALOPAY_APP_ID=""
# [PROD] key1 — ký request tạo đơn.
ZALOPAY_KEY1=""
# [PROD] key2 — xác minh HMAC của callback.
ZALOPAY_KEY2=""
# Endpoint: sb-openapi.zalopay.vn (sandbox) hoặc openapi.zalopay.vn (thật).
ZALOPAY_ENDPOINT="https://sb-openapi.zalopay.vn/v2"
# [PROD] URL callback. Production bắt buộc HTTPS cổng 443, TLS >= 1.2.
ZALOPAY_CALLBACK_URL="https://your-domain.com/api/v1/payments/zalopay/callback"
# Thời gian sống của QR trước khi PaymentAttempt hết hạn.
CHECKOUT_QR_TTL_MINUTES=15
# Chu kỳ setInterval của tác vụ đối soát, đơn vị giây. Không phải chuỗi cron.
RECONCILE_INTERVAL=60
# Attempt trẻ hơn ngần này (giây) bị bỏ qua, tránh đua với callback đang bay.
RECONCILE_MIN_AGE=120
```

`apps/web/.env.example`:

```dotenv
# Đích rewrite /api/* trong next.config.ts. Trình duyệt luôn thấy cùng origin.
API_ORIGIN="http://localhost:3001"
# Bật CTA thanh toán trên trang chi tiết khóa học và hai StatTile doanh thu ở
# /admin. Để false cho tới khi phase Thanh toán xong (UX_PLAN.md §3.1, §3.4).
NEXT_PUBLIC_CHECKOUT_ENABLED=false
```

### `apps/web/next.config.ts`

File này **chưa tồn tại trong repo** — đã kiểm, `apps/web/` không có `next.config.*` nào. Nếu không có nó thì `API_ORIGIN` vô nghĩa và cookie session không hoạt động, vì trình duyệt sẽ thấy hai origin khác nhau. Đây là cấu hình mà PROJECT_PLAN.md §Triển khai yêu cầu ("Dùng rewrite `/api/*` của Next.js sang NestJS để trình duyệt thấy cùng origin"):

```ts
import type { NextConfig } from 'next';

const config: NextConfig = {
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${process.env.API_ORIGIN}/api/:path*` },
    ];
  },
};

export default config;
```

Rewrite chỉ áp dụng cho request **từ trình duyệt**. Server Component chạy trên server, không đi qua rewrite, và không tự động mang theo cookie của người dùng. Quy tắc cho mọi fetch phía server (`/my-courses`, layout `(learner)`, `(admin)`, `(player)`):

```ts
const res = await fetch(`${process.env.API_ORIGIN}/api/v1/auth/me`, {
  headers: { cookie: (await cookies()).toString() },
  cache: 'no-store',
});
```

Ba thứ bắt buộc, thiếu cái nào cũng hỏng theo cách riêng: gọi thẳng `API_ORIGIN` (không phải đường dẫn tương đối — không có origin để phân giải), chuyển tiếp header `cookie` từ `next/headers` (không thì mọi trang cần đăng nhập trả `401`), và `cache: 'no-store'` (không thì một người dùng nhìn thấy dữ liệu đã cache của người khác).

Cố ý **không** đưa vào env: thời hạn session, ngưỡng rate limit, tên cookie. Đó là hằng số trong code (`auth.constants.ts`), không phải cấu hình theo môi trường — thêm biến cho giá trị không bao giờ đổi chỉ tạo thêm chỗ để cấu hình sai.

Cũng không có `SEED_*`: mật khẩu tài khoản demo ghi thẳng trong `prisma/seed.ts` và README (DATA_MODEL.md §Tài khoản demo). Một biến môi trường cho một mật khẩu mà cả thế giới đọc được trong repo chỉ tạo cảm giác an toàn giả; điều thật sự chặn là seed thoát ngay khi `NODE_ENV === 'production'`.

Cần cập nhật `apps/api/.gitignore` thêm hai dòng: `.storage/` và `.mail/`.

## 8. Runbook chạy local

Yêu cầu: Node.js 24 có Corepack, PostgreSQL 16 chạy local. Không cần gì khác.

```powershell
# 1. Nguồn
git clone <repo> ; Set-Location Elearning

# 2. Cấu hình
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
# Dán kết quả vào AUTH_JWT_SECRET trong apps/api/.env

# 3. Dependencies
corepack pnpm install

# 4. Database (bỏ qua nếu database đã tồn tại)
createdb -U postgres elearning

# 5. Migrate + seed
corepack pnpm --filter api prisma:generate
corepack pnpm --filter api prisma:migrate
corepack pnpm --filter api exec prisma db seed

# 6. Chạy
corepack pnpm dev
```

Web tại `http://localhost:3000`, API tại `http://localhost:3001`.

Cần bổ sung khi làm phase nền tảng: devDependency `tsx`, và `migrations.seed = "tsx prisma/seed.ts"` trong `prisma.config.ts` (repo đã có file này, nên lệnh seed khai ở đó chứ không phải trong `package.json` — xem DATA_MODEL.md §Dữ liệu seed). Dùng `tsx` vì file seed import Prisma client sinh ra dưới dạng `.ts` với đuôi `.js` trong specifier — type stripping của Node không giải được, `tsx` giải được.

Tài liệu này **không** yêu cầu dependency mới nào ở phase thanh toán. Tác vụ đối soát ở mục 5 chạy bằng `setInterval` trong `OnModuleInit`: không `@nestjs/schedule`, không queue, không Redis.

### Tài khoản demo

Bảng đầy đủ ở DATA_MODEL.md §Tài khoản demo. Bốn tài khoản, mật khẩu ghi thẳng trong seed:

| Vai trò | Email | Mật khẩu | Vì sao tồn tại |
|---|---|---|---|
| Quản trị | `admin@elearning.local` | `Demo!Admin123` | Soạn nội dung, hộp thư dev, confirm thanh toán dev cho mọi đơn. `emailVerifiedAt` đã đặt. |
| Học viên đang học | `student1@elearning.local` | `Demo!Student123` | Có quyền học C1 + C2, có 9 hàng `LessonProgress` — trạng thái "tiếp tục học" có dữ liệu thật ngay |
| Học viên mới | `student2@elearning.local` | `Demo!Student123` | Có quyền học C1, chưa có tiến độ — trạng thái rỗng của trang học |
| Khách chưa mua | `student3@elearning.local` | `Demo!Student123` | **Đường từ chối**: playback token phải `403 NOT_ENROLLED`, khóa `DRAFT` phải `404` |

`emailVerifiedAt` của cả ba học viên để `null`. Đó là chủ ý, không phải bỏ sót: PLAN_SUPPLEMENT.md §4.1 chốt rằng tài khoản chưa xác minh vẫn đăng nhập và vẫn học được, chỉ bị chặn ở bước tạo thanh toán. Để `null` nghĩa là banner "chưa xác minh email" và luồng xác minh ở mục 4 có dữ liệu để thử ngay từ lần seed đầu tiên.

### Seed tạo gì

Số lượng chính xác từng bảng, phân bổ chương/bài từng khóa, danh sách `Category`, và quy tắc nhãn `demoStats` nằm ở **DATA_MODEL.md §Dữ liệu seed cho bản demo**. Không lặp lại ở đây.

Ba điều chỉ liên quan tới demo mode, và chỉ có ở đây:

- Mọi `VideoAsset` có `provider = DEMO` và `externalId` dạng `demo/c{n}-s{n}-l{n}`. `LocalStreamClient` ánh xạ mọi `externalId` bắt đầu bằng `demo/` về cùng một file `DEMO_VIDEO_FILE` (mặc định `apps/api/assets/demo/sample.mp4`), phục vụ qua URL đã ký ở mục 2. 58 hàng, một file trên đĩa.
- `getStatus()` trả `ready: true` cho mọi hàng đó, nên validation "không cho publish khi video chưa sẵn sàng" chạy thật ở local mà không cần Cloudflare.
- Seed ghi các file `LessonResource` thật vào `.storage/` theo đúng template key ở mục 3, để luồng tải xuống có byte thật đi qua `LocalFileController` chứ không phải một hàng database trỏ vào hư không.

### Việc thường làm

| Việc | Lệnh / đường đi |
|---|---|
| Xem link verify của tài khoản vừa đăng ký | Đọc trường `link` trong log terminal của API |
| Xem hộp thư dev (layout HTML, dấu tiếng Việt) | Đăng nhập admin rồi mở `http://localhost:3001/api/v1/dev/mail` |
| Cấp quyền học thủ công | Đăng nhập admin → `/admin/users/[id]` → `ManualGrantDialog` |
| Thu hồi quyền học | `/admin/enrollments` → `RevokeDialog`. Đặt `status = REVOKED`, không xóa hàng. |
| Xác nhận thanh toán giả | Học viên đã xác minh email → `/checkout/[courseSlug]` → bấm **"Thanh toán"**. Hoặc admin → `/admin/orders` → chọn attempt `PENDING` → xác nhận |
| Reset sạch | `corepack pnpm --filter api prisma migrate reset` rồi `Remove-Item -Recurse apps/api/.storage, apps/api/.mail` |
| Đổi sang video thật | Đặt `VIDEO_DRIVER=cloudflare` + 5 biến `CLOUDFLARE_*`, restart API. Không sửa code. |

## 9. Những gì demo mode cố ý không mô phỏng

Demo mode chứng minh **luồng và quyền**, không chứng minh **hạ tầng**. Danh sách dưới đây phải làm thật trước khi mở bán.

| Hạng mục | Vì sao demo không đủ | Cần trước khi |
|---|---|---|
| Onboarding merchant ZaloPay | Sandbox credentials, bộ test QC, rồi mới cấp production AppId/keys — quy trình có người duyệt, mất thời gian thật | Nhận đồng đầu tiên |
| QR liên thông ngân hàng | Chỉ app ngân hàng thật quét được VietQR thật; QR demo chỉ là URL | Nhận đồng đầu tiên |
| Callback ZaloPay | Bắt buộc HTTPS công khai cổng 443, TLS ≥ 1.2. Không có localhost | Nhận đồng đầu tiên |
| Hoàn tiền, đối soát, hóa đơn, thuế | Không có tiền thật thì không có gì để đối soát | Mở bán |
| Encode và adaptive bitrate | `LocalStreamClient` không encode; chất lượng, thời gian xử lý, buffering trên 3G đều chưa biết | Phase học lên production |
| Bảo vệ video thật | URL demo có chữ ký, có hạn và gắn với người xem, nhưng không có giới hạn origin nhúng hay chống hotlink ở CDN: ai có phiên hợp lệ và URL còn hạn của chính mình vẫn tải được cả file mp4. Những lớp đó chỉ tồn tại ở Cloudflare | Bán khóa học đầu tiên |
| Playback token hết hạn giữa buổi học | URL demo hết hạn sau `PLAYBACK_TOKEN_TTL_SECONDS`, nên đường làm mới `expiresAt` ở mục 2 chạy được ở local (đặt TTL ngắn). Cái demo không tái hiện là token Cloudflare hết hạn giữa chừng khi player HLS còn đang tải segment | Phase học lên production |
| Chi phí Stream/R2 | Ước tính trong PROJECT_PLAN.md chưa được kiểm chứng bằng hóa đơn thật | Định giá |
| Khả năng vào hộp thư | SPF, DKIM, DMARC, danh tiếng domain, quy tắc gửi hàng loạt của Gmail. `.eml` trên đĩa không nói gì về việc mail có vào spam không | Bật xác minh email |
| Bounce và complaint | Không có webhook, không có địa chỉ chết để phát hiện | Bật xác minh email |
| Domain, DNS, chứng chỉ TLS | Không tồn tại ở local | Mọi thứ ở trên |
| Rate limit nhiều instance | Bộ đếm hiện tại nằm trong RAM một process — xem `ponytail:` trong `auth-rate-limit.guard.ts` | Chạy từ 2 instance API trở lên |
| Backup và restore | Bản backup chưa từng restore là backup chưa được xác minh | Mở bán |
| Độ trễ thật từ Việt Nam | Localhost là 0ms | Mở bán |

Ngược lại, những thứ demo mode mô phỏng **trung thực** và có thể tin: kiểm tra quyền học, phân biệt preview và trả phí, tính idempotent của cấp `Enrollment`, chuyển trạng thái `PaymentAttempt`, xác minh HMAC callback, chữ ký và hạn dùng của URL file, tính toán tiến độ học, và toàn bộ validation trước khi publish.

Hai điều kiện để danh sách "trung thực" đó đúng, cả hai đã ghi ở trên và cả hai đều dễ mất khi refactor:

- Chữ ký URL file phải chứa HTTP method và `contentType` (mục 3). Thiếu chúng thì driver demo **lỏng hơn** R2, và "chữ ký URL file" phải rời khỏi danh sách này.
- `DemoZaloPayClient.queryOrder` phải đọc `Map` của chính nó chứ không đọc `PaymentAttempt` (mục 5). Đọc database thì provider không bao giờ bất đồng với local, và "chuyển trạng thái `PaymentAttempt`" cùng tác vụ reconcile phải rời khỏi danh sách này.

## 10. Điểm cần chủ sở hữu chốt

| # | Điểm | Vì sao chưa quyết được |
|---|---|---|
| 1 | Câu chữ thân email | Mục 4 chốt khung, bốn `tag` và tiêu đề; câu chữ chi tiết thuộc UX_PLAN.md §9 và cần chủ sở hữu duyệt giọng văn |

Ba điểm từng nằm trong bảng này đã được chốt và không còn là câu hỏi mở:

- **Clip demo** là `apps/api/assets/demo/sample.mp4`: tự sinh bằng `ffmpeg` (`testsrc` + `anullsrc`), CC0, 1948743 byte, 60 giây. Nguồn, giấy phép, SHA-256 và lệnh sinh ghi ở `apps/api/assets/demo/LICENSE.txt`.
- **Tham số route checkout** là `/checkout/[courseSlug]`, theo UX_PLAN.md §2.2 — tài liệu sở hữu tên trang. `POST /checkout/{courseSlug}` cố ý trả lại QR cũ, nên tham số trang phải là thứ người dùng cầm trước khi có `Purchase`.
- **Driver seam cũ trong tài liệu khác** đã được gỡ: `PLAN_SUPPLEMENT.md` §3 dùng đúng `DevInboxMailer`/`LocalDiskStorage` và đã xóa `ALLOW_DEMO_DRIVERS_IN_PRODUCTION`; `ROADMAP.md` §2.3 đã thay bảng biến của riêng nó bằng một tham chiếu về mục 7 ở đây.
