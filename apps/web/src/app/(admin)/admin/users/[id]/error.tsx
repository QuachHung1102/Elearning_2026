"use client";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/feedback";

/** Closer than `users/error.tsx`, whose copy is about the list. */
export default function UserError({ retry }: { retry: () => void }) {
  return (
    <ErrorState
      title="Không tải được hồ sơ người dùng"
      description="Đường truyền hoặc máy chủ đang có sự cố."
      actions={<Button onClick={retry}>Thử lại</Button>}
    />
  );
}
