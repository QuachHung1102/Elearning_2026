"use client";

import Link from "next/link";
import { Button, buttonClass } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/feedback";
import { RequestId } from "@/components/ui/request-id";

/**
 * The root error page inside a shell: the root one brings its own
 * `<main id="main">` and would nest a second one in the shell's (WCAG 1.3.1).
 * Same copy, no landmark.
 */
export default function ShellError({
  error,
  retry,
}: {
  error: Error & { digest?: string; requestId?: string };
  retry: () => void;
}) {
  const requestId = error.requestId ?? error.digest;

  return (
    <>
      <ErrorState
        title="Đã xảy ra lỗi"
        description="Thử lại giúp bạn trong hầu hết trường hợp."
        actions={
          <>
            <Button onClick={retry}>Thử lại</Button>
            <Link href="/" className={buttonClass("outline")}>
              Về trang chủ
            </Link>
          </>
        }
      />
      {requestId && (
        <RequestId id={requestId} className="mx-auto max-w-prose pb-12" />
      )}
    </>
  );
}
