import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/feedback";

/**
 * The root not-found brings its own `<main id="main">`; rendered inside
 * AdminShell that nests a second main landmark with a duplicate id. Same copy
 * (UX_PLAN.md §6.6), no landmark. A non-admin's 404 comes from the (admin)
 * layout itself, above this boundary, and still gets the root page.
 */
export default function AdminNotFound() {
  return (
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
  );
}
