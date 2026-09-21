"use client";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/feedback";
import { RequestId } from "@/components/ui/request-id";

/**
 * A lesson that failed to load (UX_PLAN.md §6.2 `LessonContent`). It sits
 * inside the player layout, so the header, the curriculum and the drawer stay
 * usable and the learner can pick another lesson.
 */
export default function LessonError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="px-4 md:px-6 lg:px-8">
      <ErrorState
        title="Không tải được nội dung bài học"
        description="Kiểm tra kết nối rồi thử lại."
        actions={<Button onClick={retry}>Thử lại</Button>}
      />
      {error.digest && (
        <RequestId id={error.digest} className="mx-auto max-w-prose pb-12" />
      )}
    </div>
  );
}
