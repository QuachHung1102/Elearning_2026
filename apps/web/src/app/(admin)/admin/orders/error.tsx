"use client";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/feedback";

export default function OrdersError({ retry }: { retry: () => void }) {
  return (
    <ErrorState
      title="Không tải được danh sách đơn hàng"
      description="Đường truyền hoặc máy chủ đang có sự cố."
      actions={<Button onClick={retry}>Thử lại</Button>}
    />
  );
}
