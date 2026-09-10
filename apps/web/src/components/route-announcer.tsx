"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export function RouteAnnouncer() {
  const pathname = usePathname();
  const live = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const target =
        document.querySelector<HTMLElement>("main h1") ??
        document.querySelector<HTMLElement>("#main");
      target?.focus({ preventScroll: true });
      window.scrollTo(0, 0);
      if (live.current) {
        live.current.textContent = `Đã tới ${target?.textContent?.trim() ?? "trang mới"}`;
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  return <p ref={live} className="sr-only" aria-live="assertive" />;
}
