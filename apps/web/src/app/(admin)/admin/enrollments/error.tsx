"use client";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/feedback";

export default function EnrollmentsError({ retry }: { retry: () => void }) {
  return (
    <ErrorState
      title="Không tải được danh sách quyền học"
      description="Đường truyền hoặc máy chủ đang có sự cố."
      actions={<Button onClick={retry}>Thử lại</Button>}
    />
  );
}
