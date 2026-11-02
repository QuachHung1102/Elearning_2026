"use client";
import { UiText } from "@/components/language-provider";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/feedback";

export default function CheckoutError({ retry }: { retry: () => void }) {
  return (
    <div className="page-shell">
      <ErrorState
        title="Không mở được trang đăng ký"
        description="Đường truyền hoặc máy chủ đang có sự cố."
        actions={
          <Button onClick={retry}>
            <UiText value="Thử lại" />
          </Button>
        }
      />
    </div>
  );
}
