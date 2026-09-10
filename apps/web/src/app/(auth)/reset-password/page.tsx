import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth-forms";
import { buttonClass } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Đặt lại mật khẩu" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const valid =
    typeof token === "string" && token.length >= 32 && token.length <= 200;
  return (
    <section className="grid gap-8">
      {valid ? (
        <>
          <div className="grid gap-2">
            <h1 tabIndex={-1} className="text-4xl font-bold">
              Đặt lại mật khẩu
            </h1>
            <p className="text-muted-foreground">
              Chọn mật khẩu mới cho tài khoản của bạn.
            </p>
          </div>
          <ResetPasswordForm token={token} />
        </>
      ) : (
        <ErrorState
          title="Liên kết không hợp lệ"
          description="Mở lại liên kết trong email, hoặc xin một liên kết mới."
          actions={
            <Link href="/forgot-password" className={buttonClass("primary")}>
              Xin liên kết mới
            </Link>
          }
        />
      )}
    </section>
  );
}
