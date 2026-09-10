# Web

Ứng dụng Next.js cho giao diện E-learning. Cấu hình local nằm trong `.env.example`; API được gọi qua rewrite `/api/*` để cookie và CSRF hoạt động cùng origin.

```powershell
Copy-Item .env.example .env.local
corepack pnpm dev
```

Chạy kiểm tra từ thư mục gốc bằng `corepack pnpm lint`, `corepack pnpm typecheck` và `corepack pnpm build`.
