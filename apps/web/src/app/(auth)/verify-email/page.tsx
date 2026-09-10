import type { Metadata } from "next";
import Link from "next/link";
import {
  DemoNotice,
  ResendVerificationButton,
  VerifyEmail,
} from "@/components/auth-forms";
import { ErrorState } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Xác minh email" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const valid =
    typeof token === "string" && token.length >= 32 && token.length <= 200;
  return (
    <section className="grid gap-8">
      <div className="grid gap-2">
        <h1 tabIndex={-1} className="text-4xl font-bold">
          Xác minh email
        </h1>
        <p className="text-muted-foreground">
          Liên kết xác minh chỉ dùng được một lần.
        </p>
      </div>
      <div className="grid gap-5">
        {valid ? (
          <VerifyEmail token={token} />
        ) : (
          <ErrorState
            title="Liên kết không hợp lệ"
            description="Mở lại liên kết trong email, hoặc xin một liên kết mới."
            actions={
              <div className="grid gap-3">
                <ResendVerificationButton />
                <Link
                  className="inline-flex min-h-11 items-center text-sm font-semibold text-primary-text hover:underline"
                  href="/login"
                >
                  Đăng nhập
                </Link>
              </div>
            }
          />
        )}
        <DemoNotice />
      </div>
    </section>
  );
}
