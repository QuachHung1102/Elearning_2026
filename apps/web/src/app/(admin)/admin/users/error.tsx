"use client";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/feedback";

export default function UsersError({ retry }: { retry: () => void }) {
  return (
    <ErrorState
      title="Không tải được danh sách người dùng"
      description="Đường truyền hoặc máy chủ đang có sự cố."
      actions={<Button onClick={retry}>Thử lại</Button>}
    />
  );
}
