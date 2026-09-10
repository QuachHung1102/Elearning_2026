import type { Metadata } from "next";
import { ProfileForm } from "@/components/account-forms";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Hồ sơ" };

export default async function AccountPage() {
  const user = await getSession();
  if (!user) return null;
  return (
    <section className="grid gap-8">
      <div className="grid gap-2">
        <h1 tabIndex={-1} className="text-4xl font-bold">
          Hồ sơ
        </h1>
        <p className="text-muted-foreground">
          Cập nhật tên hiển thị trong tài khoản của bạn.
        </p>
      </div>
      <ProfileForm user={user} />
    </section>
  );
}
