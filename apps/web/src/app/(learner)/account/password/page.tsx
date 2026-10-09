import type { Metadata } from "next";
import { PasswordForm } from "@/components/account-forms";

export const metadata: Metadata = { title: "Đổi mật khẩu" };

export default function PasswordPage() {
  return <PasswordForm />;
}
