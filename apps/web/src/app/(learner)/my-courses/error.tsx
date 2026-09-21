"use client";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/feedback";

export default function MyCoursesError({ retry }: { retry: () => void }) {
  return (
    <div className="page-shell">
      <ErrorState
        title="Không tải được khóa học của bạn"
        description="Đường truyền hoặc máy chủ đang có sự cố."
        actions={<Button onClick={retry}>Thử lại</Button>}
      />
    </div>
  );
}
