"use client";

import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/feedback";

export default function OrdersError({ retry }: { retry: () => void }) {
  // The list sits under the layout's "Đơn hàng của tôi" h1; a detail page has none.
  const heading = usePathname() === "/account/orders" ? "h2" : "h1";
  return (
    <ErrorState
      heading={heading}
      title="Không tải được đơn hàng"
      description="Đường truyền hoặc máy chủ đang có sự cố."
      actions={<Button onClick={retry}>Thử lại</Button>}
    />
  );
}
