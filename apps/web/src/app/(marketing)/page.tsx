import Link from "next/link";
import { ArrowRight, BookOpenCheck } from "lucide-react";
import { buttonClass } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="page-shell grid min-h-[calc(100dvh-4rem)] items-center py-12 lg:grid-cols-[1.2fr_0.8fr] lg:gap-16 lg:py-20">
      <section className="max-w-prose">
        <h1 tabIndex={-1} className="text-4xl font-bold md:text-5xl">
          Học kỹ năng thực tế theo một lộ trình rõ ràng
        </h1>
        <p className="mt-5 max-w-prose text-lg text-muted-foreground">
          Khóa học tiếng Việt, bài học tập trung và tiến độ luôn ở đúng nơi bạn
          dừng lại.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link className={buttonClass("primary", "lg")} href="/courses">
            Xem khóa học
            <ArrowRight
              aria-hidden="true"
              className="size-5"
              strokeWidth={1.75}
            />
          </Link>
          <Link className={buttonClass("outline", "lg")} href="/contact">
            Liên hệ
          </Link>
        </div>
      </section>
      <aside
        className="mt-10 grid gap-5 border-t border-border pt-8 lg:mt-0 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0"
        aria-label="Cam kết học tập"
      >
        <BookOpenCheck
          aria-hidden="true"
          className="size-10 text-primary-text"
          strokeWidth={1.75}
        />
        <h2 className="text-2xl font-semibold">Tập trung vào việc học</h2>
        <p className="text-muted-foreground">
          Không quảng cáo chen ngang. Không gamification gây xao nhãng. Mỗi bài
          học đều có một bước tiếp theo rõ ràng.
        </p>
      </aside>
    </div>
  );
}
