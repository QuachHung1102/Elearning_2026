"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/** A `loading.tsx` skeleton marks itself busy; buttons do too while saving. */
const LOADING = '#main [aria-busy="true"]:not(button)';
const MAX_WAIT_MS = 10_000;

export function RouteAnnouncer() {
  const pathname = usePathname();
  const live = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const started = performance.now();
    let frame = 0;
    const settle = () => {
      // Focusing during the skeleton would land on #main and announce
      // "Đang tải…"; wait for the real page and its h1 instead.
      if (
        document.querySelector(LOADING) &&
        performance.now() - started < MAX_WAIT_MS
      ) {
        frame = window.requestAnimationFrame(settle);
        return;
      }
      const target =
        document.querySelector<HTMLElement>("main h1") ??
        document.querySelector<HTMLElement>("#main");
      target?.focus({ preventScroll: true });
      window.scrollTo(0, 0);
      if (live.current) {
        live.current.textContent = `Đã tới ${target?.textContent?.trim() ?? "trang mới"}`;
      }
    };
    frame = window.requestAnimationFrame(settle);
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  return <p ref={live} className="sr-only" aria-live="assertive" />;
}
