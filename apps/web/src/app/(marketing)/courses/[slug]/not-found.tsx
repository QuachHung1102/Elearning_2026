import Link from "next/link";
import { ErrorState } from "@/components/ui/feedback";
import { buttonClass } from "@/components/ui/button";

export default function CourseNotFound() {
  return (
    <div className="page-shell">
      <ErrorState
        title="Không tìm thấy khóa học"
        description="Khóa học này không tồn tại hoặc đã ngừng mở bán."
        actions={
          <Link href="/courses" className={buttonClass("primary")}>
            Xem tất cả khóa học
          </Link>
        }
      />
    </div>
  );
}
