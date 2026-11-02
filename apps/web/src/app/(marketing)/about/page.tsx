import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { getLocale } from "@/lib/locale";
import { translate } from "@/lib/translations";
export const metadata: Metadata = { title: "Câu chuyện / Our story" };
export default async function AboutPage() {
  const locale = await getLocale();
  const t = (vi: string, en?: string) => translate(locale, vi, en);
  return (
    <div className="page-shell">
      <section className="about-intro">
        <div>
          <p className="section-label">
            {t("Câu chuyện của CodingBuddy", "The story of CodingBuddy")}
          </p>
          <h1>
            {t(
              "Mình là Nam.\nRất vui được học cùng bạn.",
              "I’m Nam.\nGood to be learning with you.",
            )}
          </h1>
          <p>
            {t(
              "Mình thích lập trình, robot và cảm giác tìm ra lời giải sau nhiều lần thử. CodingBuddy bắt đầu từ mong muốn chia sẻ cách học đó với những bạn nhỏ hơn.",
              "I like code, robots, and finding a solution after a few attempts. CodingBuddy began with a wish to share that way of learning with younger students.",
            )}
          </p>
          <Link className="inline-link" href="/workshop">
            {t("Cùng thử một bài học", "Try a lesson together")}
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
        <aside className="about-note">
          <Image
            src="/images/hai-nam.jpg"
            alt={t("Nguyễn Hải Nam bên robot của mình", "Nguyễn Hải Nam beside his robot")}
            width={1365}
            height={2048}
            sizes="(max-width: 900px) 100vw, 420px"
            priority
            className="about-portrait"
          />
          <h2>
            {t(
              "Hiểu vì sao nó chạy.\nTự tin thử cách khác.",
              "Understand why it works.\nFeel confident trying another way.",
            )}
          </h2>
          <p>
            Nguyễn Hải Nam ·{" "}
            {t("Người sáng lập & người dạy", "Founder & tutor")}
          </p>
        </aside>
      </section>
      <section className="about-reading">
        <h2>
          {t("Cách mình muốn\ncùng bạn học.", "How I’d like\nus to learn.")}
        </h2>
        <div>
          <p>
            {t(
              "Một dự án không cần phải lớn để có ý nghĩa. Có thể chỉ là danh sách giúp một bạn tìm tài liệu, một trang hướng dẫn dễ đọc hơn, hay một công cụ nhỏ tiết kiệm thao tác.",
              "A project doesn’t need to be large to mean something. It might be a list that helps a classmate find a resource, a more readable guide, or a small tool that saves a few steps.",
            )}
          </p>
          <p>
            {t(
              "Chúng mình bắt đầu bằng một nhu cầu, học những kiến thức cần thiết, rồi làm thử. Gặp lỗi là một phần của quá trình. Hỏi người khác dùng có dễ không cũng là một phần của việc học lập trình.",
              "We start with a need, learn the skills we need, and make a first attempt. Bugs are part of the process. Asking someone whether it is easy to use is part of learning to code, too.",
            )}
          </p>
        </div>
      </section>
      <section className="about-reading">
        <h2>{t("Những điều đang\nđược xây dựng.", "What’s\ntaking shape.")}</h2>
        <div>
          <p>
            {t(
              "Bốn video làm tủ sách chia sẻ đã có trong bài thực hành miễn phí. Năm khóa dự án tiếp theo có bài đọc, dữ liệu mẫu và code để bạn tự làm; mình sẽ tiếp tục bổ sung video và cải thiện tài liệu.",
              "Four book-sharing videos are available in the free practice project. Five more project courses include written lessons, sample data, and code you can work through; I’ll continue adding videos and improving the materials.",
            )}
          </p>
          <p>
            {t(
              "CodingBuddy dành 100% lợi nhuận cho hoạt động giáo dục cộng đồng dân tộc thiểu số ở miền núi phía Bắc. Mình chia sẻ những dấu mốc giảng dạy và hoạt động cộng đồng tại trang Dấu ấn sẻ chia.",
              "CodingBuddy dedicates 100% of profits to education for ethnic minority communities in northern Vietnam’s mountainous regions. I share our teaching and community milestones on the Our Impact page.",
            )}
          </p>
          <Link href="/impact" className="studio-button secondary">
            {t("Dấu ấn sẻ chia", "Our Impact")}
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}
