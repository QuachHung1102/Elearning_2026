import type { Metadata } from "next";
import { SessionsTable } from "@/components/account-forms";
import { serverFetch, type SessionRow } from "@/lib/session";

export const metadata: Metadata = { title: "Phiên đăng nhập" };

export default async function SessionsPage() {
  const response = await serverFetch("/users/me/sessions");
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("Unable to load sessions");
  const { items } = (await response.json()) as { items: SessionRow[] };
  return <SessionsTable initialItems={items} />;
}
