import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { buttonClass } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/feedback";

// Unmatched URLs render outside every route group, so this page brings the
// public shell itself: the visitor keeps the header and footer to move on.
export default function NotFound() {
  return (
    <SiteShell>
      <div className="page-shell lg:py-12">
        <ErrorState
          title="Không tìm thấy trang này"
          description="Đường dẫn có thể đã đổi hoặc không còn tồn tại."
          actions={
            <>
              <Link href="/" className={buttonClass("primary")}>
                Về trang chủ
              </Link>
              <Link href="/courses" className={buttonClass("outline")}>
                Xem danh sách khóa học
              </Link>
            </>
          }
        />
      </div>
    </SiteShell>
  );
}
