# E-learning

Monorepo khởi đầu cho hệ thống bán khóa học trực tuyến:

- `apps/web`: Next.js
- `apps/api`: NestJS + Prisma
- `docs/PROJECT_PLAN.md`: phân tích chức năng và kiến trúc đã thống nhất

## Chạy local

Yêu cầu Node.js có Corepack và một PostgreSQL đang chạy tại URL được cấu hình trong `apps/api/.env`.

```powershell
Copy-Item apps/api/.env.example apps/api/.env
corepack pnpm install
corepack pnpm --filter api prisma:generate
corepack pnpm dev
```

Web chạy tại `http://localhost:3000`; API chạy tại `http://localhost:3001`.

## Kiểm tra

```powershell
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```
