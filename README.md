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
