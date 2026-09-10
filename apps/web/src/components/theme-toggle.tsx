"use client";

import { SunMoon } from "lucide-react";

const MODES = ["system", "light", "dark"] as const;

function applyTheme(mode: (typeof MODES)[number]) {
  const dark =
    mode === "dark" ||
    (mode === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  localStorage.setItem("elearning-theme", mode);
}

export function ThemeToggle() {
  return (
    <button
      type="button"
      className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-medium hover:bg-muted"
      onClick={() => {
        const current = localStorage.getItem("elearning-theme") ?? "system";
        const index = MODES.indexOf(current as (typeof MODES)[number]);
        applyTheme(MODES[(index + 1) % MODES.length]);
      }}
      aria-label="Đổi chế độ màu: hệ thống, sáng hoặc tối"
    >
      <SunMoon aria-hidden="true" className="size-5" strokeWidth={1.75} />
      <span className="hidden sm:inline">Giao diện</span>
    </button>
  );
}
