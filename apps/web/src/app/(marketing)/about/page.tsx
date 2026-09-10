import type { Metadata } from "next";
import Link from "next/link";
import { InstructorCard, Prose } from "@/components/catalog/sections";
import { buttonClass } from "@/components/ui/button";
import { SITE_OWNER } from "@/lib/site";

export const metadata: Metadata = {
  title: "Giới thiệu",
  description: `Cách ${SITE_OWNER.name} xây dựng và giảng dạy các khóa học trên nền tảng này.`,
};

const CONTENT = `## Cách khóa học ở đây được dựng

Mỗi khóa học bắt đầu từ một việc cụ thể mà người học cần làm được, rồi mới đi ngược lại để chọn nội dung. Không có bài giảng nào tồn tại chỉ vì "chương trình chuẩn" có phần đó.

- Bài học ngắn, mỗi bài giải quyết đúng một việc.
- Ví dụ lấy từ dự án thật, chạy được trên máy của bạn.
- Tiến độ lưu theo từng bài, bạn quay lại đúng chỗ đã dừng.
- Tài liệu kèm theo tải về được, không khóa trong trình phát.

## Cam kết

Số liệu hiển thị trên nền tảng là số thật. Chỗ nào là dữ liệu demo thì có nhãn **Dữ liệu demo** ngay cạnh con số.`;

export default function AboutPage() {
  return (
    <div className="page-shell grid gap-10 py-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16 lg:py-20">
      <section className="grid content-start gap-6">
        <h1 tabIndex={-1} className="text-4xl font-bold">
          Giới thiệu
        </h1>
        <Prose source={CONTENT} />
        <Link href="/courses" className={buttonClass("primary", "lg", "w-fit")}>
          Xem khóa học
        </Link>
      </section>
      <aside>
        <InstructorCard variant="full" />
      </aside>
    </div>
  );
}
