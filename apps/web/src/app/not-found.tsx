import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/feedback";

export default function NotFound() {
  return (
    <main id="main" tabIndex={-1} className="page-shell">
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
    </main>
  );
}
