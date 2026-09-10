import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Quên mật khẩu" };

export default function ForgotPasswordPage() {
  return (
    <section className="grid gap-8">
      <div className="grid gap-2">
        <h1 tabIndex={-1} className="text-4xl font-bold">
          Quên mật khẩu
        </h1>
        <p className="text-muted-foreground">
          Nhận liên kết đặt lại qua email của bạn.
        </p>
      </div>
      <ForgotPasswordForm />
    </section>
  );
}
