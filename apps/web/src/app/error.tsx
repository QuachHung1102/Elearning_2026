"use client";

import Link from "next/link";
import { Button, buttonClass } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/feedback";
import { RequestId } from "@/components/ui/request-id";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string; requestId?: string };
  reset: () => void;
}) {
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
        <RequestId id={requestId} className="mx-auto max-w-prose pb-12" />
      )}
    </main>
  );
}
