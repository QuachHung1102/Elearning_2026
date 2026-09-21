"use client";

import Link from "next/link";
import { Button, buttonClass } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/feedback";
import { RequestId } from "@/components/ui/request-id";

/**
 * The course shell (`GET /learn/{slug}`) failed, so there is no curriculum to
 * show (UX_PLAN.md §6.2 `CurriculumAccordion`). Lives one segment up because
 * an `error.tsx` never wraps the layout of its own segment.
 */
export default function LearnError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main id="main" tabIndex={-1} className="page-shell">
      <ErrorState
        title="Không tải được chương trình học"
        description="Kiểm tra kết nối rồi thử lại."
        actions={
          <>
            <Button onClick={retry}>Thử lại</Button>
            <Link href="/my-courses" className={buttonClass("outline")}>
              Khóa học của tôi
            </Link>
          </>
        }
      />
      {error.digest && (
        <RequestId id={error.digest} className="mx-auto max-w-prose pb-12" />
      )}
    </main>
  );
}
