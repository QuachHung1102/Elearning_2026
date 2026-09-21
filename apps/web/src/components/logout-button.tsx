"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import { apiFetch } from "@/lib/api";

export function LogoutButton() {
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
          // A full load: every island cached the signed-in viewer.
          window.location.replace("/");
        }
      }}
    >
      <LogOut aria-hidden="true" className="size-4" strokeWidth={1.75} />
      Đăng xuất
    </button>
  );
}
