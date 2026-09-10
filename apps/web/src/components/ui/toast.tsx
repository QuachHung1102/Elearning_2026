"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Toast = {
  id: number;
  message: string;
  variant: "success" | "error" | "info";
};

const EVENT = "elearning:toast";

export function showToast(message: string, variant: Toast["variant"] = "info") {
  window.dispatchEvent(
    new CustomEvent(EVENT, { detail: { message, variant } }),
  );
}

export function Toaster() {
  const router = useRouter();
  const [items, setItems] = useState<Toast[]>([]);

  useEffect(() => {
    function add(event: Event) {
      const detail = (event as CustomEvent<Omit<Toast, "id">>).detail;
      const toast = { ...detail, id: Date.now() };
      setItems((current) => [...current.slice(-2), toast]);
      if (toast.variant !== "error") {
        window.setTimeout(
          () =>
            setItems((current) => current.filter(({ id }) => id !== toast.id)),
          5_000,
        );
      }
    }
    function sessionExpired(event: Event) {
      const next = (event as CustomEvent<string>).detail;
      showToast(
        "Phiên đăng nhập đã hết hạn. Bạn sẽ được chuyển tới trang đăng nhập.",
        "error",
      );
      window.setTimeout(
        () => router.replace(`/login?next=${encodeURIComponent(next)}`),
        2_000,
      );
    }
    window.addEventListener(EVENT, add);
    window.addEventListener("elearning:session-expired", sessionExpired);
    return () => {
      window.removeEventListener(EVENT, add);
      window.removeEventListener("elearning:session-expired", sessionExpired);
    };
  }, [router]);

  return (
    <aside className="fixed inset-x-4 top-4 z-50 grid gap-2 md:inset-x-auto md:bottom-4 md:right-4 md:top-auto md:w-96">
      {items.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-start justify-between gap-3 rounded-lg border bg-card p-4 shadow-[var(--shadow-overlay)] ${toast.variant === "error" ? "border-destructive text-destructive" : "border-border text-card-foreground"}`}
          role={toast.variant === "error" ? "alert" : "status"}
        >
          <p className="text-sm font-medium">{toast.message}</p>
          <button
            type="button"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-md"
            onClick={() =>
              setItems((current) => current.filter(({ id }) => id !== toast.id))
            }
            aria-label="Đóng thông báo"
          >
            <X aria-hidden="true" className="size-4" strokeWidth={1.75} />
          </button>
        </div>
      ))}
    </aside>
  );
}
