"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/api";

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="flex min-h-11 w-full items-center gap-2 rounded-md px-3 text-left text-sm font-medium hover:bg-muted"
      disabled={busy}
      aria-busy={busy || undefined}
      onClick={async () => {
        setBusy(true);
        try {
          await apiFetch("/auth/logout", { method: "POST" });
        } finally {
          router.replace("/");
          router.refresh();
        }
      }}
    >
      <LogOut aria-hidden="true" className="size-4" strokeWidth={1.75} />
      Đăng xuất
    </button>
  );
}
