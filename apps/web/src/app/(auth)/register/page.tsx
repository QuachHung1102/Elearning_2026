import { safeNext } from "@/lib/routes";
import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Đăng ký" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const destination = safeNext(next);
  return (
    <section className="grid gap-8">
      <div className="grid gap-2">
        <h1 tabIndex={-1} className="text-4xl font-bold">
          Tạo tài khoản
        </h1>
        <p className="text-muted-foreground">
          Một tài khoản để giữ quyền học và tiến độ của bạn.
        </p>
      </div>
      <RegisterForm next={destination} />
    </section>
  );
}
