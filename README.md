# E-learning

Monorepo khởi đầu cho hệ thống bán khóa học trực tuyến:

- `apps/web`: Next.js
- `apps/api`: NestJS + Prisma
- `docs/PROJECT_PLAN.md`: phân tích chức năng và kiến trúc đã thống nhất
- `docs/_STATUS.md`: trạng thái triển khai; `docs/_PLAN.md`: việc còn lại, chia task nhỏ

## Chạy local

Yêu cầu Node.js có Corepack và một PostgreSQL đang chạy tại URL được cấu hình trong `apps/api/.env`.

```powershell
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env.local
corepack pnpm install
corepack pnpm --filter api prisma:generate
corepack pnpm --filter api prisma:migrate
corepack pnpm --filter api seed
corepack pnpm dev
```

Web chạy tại `http://localhost:3000`; API chạy tại `http://localhost:3001`.

Seed tạo năm tài khoản demo (admin, giảng viên, ba học viên); email và mật khẩu được ghi trong `apps/api/prisma/seed.ts`. Seed tự từ chối chạy khi `NODE_ENV=production`.

Tạo `AUTH_JWT_SECRET` bằng lệnh dưới đây rồi lưu kết quả vào `apps/api/.env`:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

## Thử luồng thanh toán (demo)

Mặc định `PAYMENT_DRIVER=demo`: mã QR là giả, không cần tài khoản ZaloPay. `NEXT_PUBLIC_CHECKOUT_ENABLED=true` (đã có ở `apps/web/.env.example`) bật nút "Đăng ký học", `/checkout`, `/account/orders` và `/admin/orders`; biến này được nhúng lúc build nên đổi giá trị thì phải build lại.

1. Đăng nhập `student3@elearning.local`, mở một khóa có giá và bấm "Đăng ký học".
2. Ở một trình duyệt khác, đăng nhập admin, vào `/admin/orders` và bấm "Xác nhận thanh toán".
3. Trang thanh toán của học viên tự chuyển sang "Thanh toán thành công"; `/admin` hiện doanh thu.

Các bước đầy đủ và kết quả mong đợi: `docs/ROADMAP.md` §8 (Demo script). `PAYMENT_DRIVER=zalopay` cần thông tin merchant sandbox và chưa được kiểm chứng (`docs/_PLAN.md`, A4.9).

## API authentication

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/csrf`

Session JWT được gửi bằng cookie `HttpOnly`. Trước các request `POST`, gọi endpoint CSRF rồi gửi token nhận được qua header `X-CSRF-Token`; trình duyệt đồng thời gửi cookie CSRF tương ứng.

## Kiểm tra

```powershell
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm --filter api test:e2e
corepack pnpm build
```

E2E dùng riêng database `elearning_test` với tài khoản PostgreSQL cùng tên, theo `apps/api/.env.test`. Không trỏ file này vào database dev hoặc production.

## Sao lưu và khôi phục

Cần `pg_dump`, `pg_restore`, `psql` (lấy từ `PATH`, nếu không có thì từ `C:\Program Files\PostgreSQL\*\bin`). Phiên bản client phải bằng hoặc mới hơn server. Script không in mật khẩu.

Sao lưu (định dạng custom, không kèm owner/quyền nên restore được vào role khác). File nằm ở `backups/` (đã gitignore):

```powershell
./apps/api/scripts/backup.ps1 -DatabaseUrl "<URL Postgres>"   # bỏ -DatabaseUrl thì dùng $env:DATABASE_URL
```

Trên Railway, lấy `DATABASE_PUBLIC_URL` của service Postgres (URL nội bộ `*.railway.internal` không truy cập được từ máy local).

Diễn tập khôi phục (A5.5) vào một database **trống** có tên chứa `test`/`scratch`/`restore`/`drill`/`tmp`:

```powershell
./apps/api/scripts/restore-drill.ps1 -SourceUrl "<URL nguồn>" -TargetUrl "<URL DB trống>" -RunE2e
# hoặc khôi phục một file có sẵn: -DumpFile backups/<file>.dump
```

Script tự `pg_dump` nguồn (nếu không có `-DumpFile`), `pg_restore` vào đích, rồi kiểm tra `_prisma_migrations` so với `apps/api/prisma/migrations` (migration chưa có trong bản dump chỉ cảnh báo) và số dòng từng bảng so với nguồn. Nó từ chối đích trùng tên nguồn, đích đã có bảng, hoặc tên không giống DB nháp — `-Force` để bỏ qua (trùng cả host lẫn tên thì luôn từ chối). `-RunE2e` chạy e2e của API, vốn đọc `apps/api/.env.test`: sửa `DATABASE_URL` trong đó trỏ vào DB đích trước (e2e sẽ xóa dữ liệu và chạy `prisma migrate deploy`). Nguồn đang có người ghi thì số dòng có thể lệch; so trên bản sao chụp hoặc lúc ít truy cập.
