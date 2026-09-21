import { safeNext } from "@/lib/routes";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Đăng nhập" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; passwordChanged?: string }>;
}) {
  const params = await searchParams;
  return (
    <section className="grid gap-8">
      <div className="grid gap-2">
        <h1 tabIndex={-1} className="text-4xl font-bold">
          Đăng nhập
        </h1>
        <p className="text-muted-foreground">
          Tiếp tục từ nơi bạn đã dừng lại.
        </p>
      </div>
      <LoginForm
        next={safeNext(params.next)}
        passwordChanged={params.passwordChanged === "1"}
      />
    </section>
  );
}
