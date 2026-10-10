import type { Metadata } from "next";
import { ProfileForm } from "@/components/account-forms";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Hồ sơ cá nhân" };

export default async function AccountPage() {
  const user = await getSession();
  if (!user) return null;
  return <ProfileForm user={user} />;
}
