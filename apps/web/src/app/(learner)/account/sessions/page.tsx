import type { Metadata } from "next";
import { SessionsTable } from "@/components/account-forms";
import { serverFetch, type SessionRow } from "@/lib/session";

export const metadata: Metadata = { title: "Phiên đăng nhập" };

export default async function SessionsPage() {
  const response = await serverFetch("/users/me/sessions");
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("Unable to load sessions");
  const { items } = (await response.json()) as { items: SessionRow[] };
  return (
    <section className="grid gap-8">
      <div className="grid gap-2">
        <h1 tabIndex={-1} className="text-4xl font-bold">
          Phiên đăng nhập
        </h1>
        <p className="text-muted-foreground">
          Đóng những phiên bạn không còn sử dụng.
        </p>
      </div>
      <SessionsTable initialItems={items} />
    </section>
  );
}
