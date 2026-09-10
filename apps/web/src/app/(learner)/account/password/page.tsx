import type { Metadata } from "next";
import { PasswordForm } from "@/components/account-forms";

export const metadata: Metadata = { title: "Đổi mật khẩu" };

export default function PasswordPage() {
  return (
    <section className="grid gap-8">
      <div className="grid gap-2">
        <h1 tabIndex={-1} className="text-4xl font-bold">
          Đổi mật khẩu
        </h1>
        <p className="text-muted-foreground">
          Chọn mật khẩu mới và đăng nhập lại trên các thiết bị của bạn.
        </p>
      </div>
      <PasswordForm />
    </section>
  );
}
