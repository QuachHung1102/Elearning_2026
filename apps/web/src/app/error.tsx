"use client";

import { Copy } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/feedback";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string; requestId?: string };
  reset: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const requestId = error.requestId ?? error.digest;

  return (
    <main id="main" tabIndex={-1} className="page-shell">
      <ErrorState
        title="Đã xảy ra lỗi"
        description="Thử lại giúp bạn trong hầu hết trường hợp."
        actions={
          <>
            <Button onClick={reset}>Thử lại</Button>
            <Link href="/" className={buttonClass("outline")}>
              Về trang chủ
            </Link>
          </>
        }
      />
      {requestId && (
        <div className="mx-auto flex max-w-prose flex-wrap items-center gap-2 pb-12 text-xs text-muted-foreground">
          <span>Mã tra cứu: {requestId}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await navigator.clipboard.writeText(requestId);
              setCopied(true);
            }}
          >
            <Copy aria-hidden="true" className="size-4" strokeWidth={1.75} />
            {copied ? "Đã sao chép" : "Sao chép"}
          </Button>
        </div>
      )}
    </main>
  );
}
