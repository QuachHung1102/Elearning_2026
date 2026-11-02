"use client";
import { UiText } from "@/components/language-provider";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/feedback";

export default function LearnerError({ retry }: { retry: () => void }) {
  return (
    <div className="page-shell">
      <ErrorState
        title="Không tải được trang của bạn"
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
