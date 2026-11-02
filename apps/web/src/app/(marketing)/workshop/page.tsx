import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Download,
  FileCode,
} from "lucide-react";
import { Prose } from "@/components/catalog/sections";
import { getLocale } from "@/lib/locale";
import { projectCourse } from "@/lib/project-courses";
import { courseGuide } from "@/lib/course-guides";
import material from "@/content/book-project.json";

export const metadata: Metadata = {
  title: "Tủ sách chia sẻ · Học thử miễn phí / Free book project",
  description:
    "Dự án tủ sách Python miễn phí: mã nguồn chạy được, hướng dẫn, dữ liệu mẫu, bài tập và bốn video. Không cần tài khoản.",
  alternates: { canonical: "/workshop" },
};

/** Explicitly public material. Paid lessons continue through the authenticated player. */
export default async function BookTrialPage() {
  const project = projectCourse("python-tu-sach-lop-minh")!;
  const locale = await getLocale();
  const t = (vi: string, en: string) => (locale === "vi" ? vi : en);
  const guide = courseGuide(project.slug, locale)!;
  return (
    <div className="page-shell book-trial">
      <Link href="/courses" className="inline-link">
        <ArrowLeft size={17} aria-hidden="true" />
        {t("Về các dự án", "Back to projects")}
      </Link>
      <header className="trial-intro">
        <p className="section-label">
          01 / {t("DỰ ÁN HỌC THỬ MIỄN PHÍ", "FREE TRIAL PROJECT")}
        </p>
        <h1>{t("Tủ sách của lớp mình.", "Your class, sharing books.")}</h1>
        <p>
          {t(
            "Cùng Nam làm một công cụ tìm sách, mượn/trả và lưu dữ liệu bằng Python. Bốn video, bài đọc và mã tham khảo — mở cho mọi người, không cần tài khoản.",
            "Build a Python tool with Nam to find books, record loans and returns, and save your data. Four videos, written notes, and reference code — open to everyone, with no account required.",
          )}
        </p>
        <div className="trial-facts">
          <span>{t("Miễn phí", "Free")}</span>
          <span>4 {t("video", "videos")}</span>
          <span>Python 3</span>
          <span>
            {t("Âm thanh & bài đọc: tiếng Việt", "Audio & notes: Vietnamese")}
          </span>
        </div>
        <div className="trial-resource-actions">
          <a
            href="/downloads/projects/book-sharing-project.zip"
            download
            className="studio-button"
          >
            <Download size={17} aria-hidden="true" />
            {t("Tải trọn bộ dự án", "Download the whole project")}
          </a>
          <a href="#source-code" className="inline-link">
            <FileCode size={17} aria-hidden="true" />
            {t("Đọc mã nguồn ngay", "Read the complete code")}
          </a>
          <a href="#lesson-1" className="inline-link">
            {t("Đến video đầu tiên", "Go to the first video")}
          </a>
        </div>
      </header>
      <nav
        className="trial-resource-actions trial-jump-links"
        aria-label={t("Nội dung dự án", "Project contents")}
      >
        <a href="#project-brief">{t("Dự án làm gì?", "The project")}</a>
        <a href="#getting-started">{t("Cách chạy", "How to run it")}</a>
        <a href="#source-code">{t("Code & tệp tải", "Code & files")}</a>
        <a href="#lessons">
          {t("Video & bài đọc", "Videos & written lessons")}
        </a>
      </nav>

      <section
        id="project-brief"
        className="trial-companion-section"
        aria-labelledby="project-brief-heading"
      >
        <h2 id="project-brief-heading">
          {t(
            "Một tủ sách dễ theo dõi hơn.",
            "Keep a small book shelf organized.",
          )}
        </h2>
        <p>{guide.introduction[0]}</p>
        <p>{guide.projectBrief}</p>
        <h3>{t("Vì sao có dự án này?", "Why this project?")}</h3>
        <div data-project-reason={locale}>
          {guide.whyThisProject.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        <h3>{t("Làm xong, bạn có gì?", "What you will have at the end")}</h3>
        <ul>
          {guide.deliverables.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p>
          {t(
            "Bản này lưu mã, tên sách và trạng thái mượn. Không cần dữ liệu cá nhân, dịch vụ online hay thư viện Python ngoài.",
            "This version stores book IDs, titles and borrowing states. No personal data, online service or third-party Python package is needed.",
          )}
        </p>
      </section>

      <section
        id="getting-started"
        className="trial-companion-section"
        aria-labelledby="getting-started-heading"
      >
        <h2 id="getting-started-heading">
          {t(
            "Chạy thử trước, rồi cùng viết lại.",
            "Run it first, then build it yourself.",
          )}
        </h2>
        <ol>
          <li>
            {t(
              "Chuẩn bị Python 3 trên máy tính. Tải ZIP và giải nén vào một thư mục riêng.",
              "Have Python 3 on your computer. Download the ZIP and extract it into its own folder.",
            )}
          </li>
          <li>
            {t(
              "Mở Terminal hoặc Command Prompt trong thư mục chứa book-sharing.py.",
              "Open Terminal or Command Prompt in the folder containing book-sharing.py.",
            )}
          </li>
          <li>
            {t(
              "Chạy lệnh dưới đây. Nếu Windows không nhận python, dùng py; trên một số máy khác, dùng python3.",
              "Run the command below. If Windows does not recognize python, try py; some other computers use python3.",
            )}
          </li>
          <li>
            {t(
              "Gõ f để tìm, b để mượn, r để trả và q để thoát. Nhập mã sách là số nguyên khi được hỏi.",
              "Enter f to find, b to borrow, r to return and q to quit. When asked, enter a whole-number book ID.",
            )}
          </li>
          <li>
            {t(
              "Thử mượn mã 1, thoát rồi mở lại. Trạng thái mới phải được giữ trong books.json cạnh chương trình.",
              "Borrow ID 1, quit and reopen. The changed state should persist in books.json beside the program.",
            )}
          </li>
        </ol>
        <pre
          className="trial-source"
          aria-label={t("Lệnh chạy dự án", "Run command")}
          tabIndex={0}
        >
          <code>python book-sharing.py</code>
        </pre>
        <p>
          {t(
            "Lần đầu, mã 1 và 3 đang còn, mã 2 đang mượn. File dữ liệu được tạo sau một lần thay đổi trạng thái lưu thành công; tìm sách không tự tạo file.",
            "Initially IDs 1 and 3 are available, while 2 is on loan. A data file is created after a changed state saves successfully; searching alone does not create one.",
          )}
        </p>
        <details className="panel trial-notes">
          <summary>
            <BookOpen size={18} aria-hidden="true" />
            {t(
              "Hướng dẫn đầy đủ & xử lý lỗi",
              "Full instructions & troubleshooting",
            )}
          </summary>
          <Prose source={material.setup[locale]} />
        </details>
      </section>

      <section
        id="source-code"
        className="trial-companion-section"
        aria-labelledby="source-code-heading"
      >
        <h2 id="source-code-heading">
          {t(
            "Mã nguồn hoàn chỉnh, mở để bạn đọc và sửa.",
            "The complete code, ready to read and change.",
          )}
        </h2>
        <p>
          {t(
            "Đây là phiên bản tham khảo chạy được, không phải khung còn thiếu hàm. Tải tệp Python nếu muốn chạy ngay; dùng bản starter riêng nếu muốn tự hoàn thành các TODO theo bài học.",
            "This is the runnable reference version, not an unfinished scaffold. Download the Python file to run it now, or use the separate starter to complete the TODO functions as you follow the lessons.",
          )}
        </p>
        <div className="trial-resource-actions">
          <a
            href="/downloads/projects/book-sharing.py"
            download
            className="inline-link"
          >
            {t("Tải code hoàn chỉnh", "Download working code")} (.py) ↓
          </a>
          <a
            href="/downloads/projects/book-sharing-starter.py"
            download
            className="inline-link"
          >
            {t("Tải khung tự làm", "Download starter")} ↓
          </a>
          <a
            href="/downloads/projects/books.example.json"
            download
            className="inline-link"
          >
            {t("Tải dữ liệu mẫu", "Download sample data")} ↓
          </a>
          <a
            href="/downloads/projects/book-sharing-TESTING.md"
            download
            className="inline-link"
          >
            {t("Tải bảng kiểm thử", "Download test checklist")} ↓
          </a>
        </div>
        <p className="trial-video-help">
          book-sharing.py · Python 3 ·{" "}
          {t(
            "Chạy trên máy của bạn; trang web không thực thi code.",
            "Run on your own computer; this page does not execute code.",
          )}
        </p>
        <pre
          className="trial-source trial-source-full"
          aria-label={t("Mã Python hoàn chỉnh", "Complete Python source")}
          tabIndex={0}
        >
          <code>{material.source}</code>
        </pre>
        <h3>
          {t(
            "Đọc chương trình theo từng việc",
            "Read the program by responsibility",
          )}
        </h3>
        <ul>
          <li>
            <code>load_books</code> —{" "}
            {t(
              "đọc JSON và kiểm tra cấu trúc, kiểu dữ liệu, mã trùng; chỉ dùng dữ liệu mẫu khi chưa có file.",
              "loads and validates saved records; uses sample data only when the file is absent.",
            )}
          </li>
          <li>
            <code>find_available</code> —{" "}
            {t(
              "chuẩn hóa từ khóa rồi lọc sách chưa được mượn.",
              "normalizes the keyword and filters books that are available.",
            )}
          </li>
          <li>
            <code>set_loan</code> —{" "}
            {t(
              "tìm theo mã, đổi trạng thái khi phù hợp và báo có thay đổi hay không.",
              "finds an ID and reports whether a valid state change occurred.",
            )}
          </li>
          <li>
            <code>save_books</code> —{" "}
            {t(
              "ghi danh sách hiện tại thành JSON trong cùng thư mục chương trình.",
              "writes the current list as JSON beside the program.",
            )}
          </li>
          <li>
            <code>main</code> —{" "}
            {t(
              "nhận thao tác từ menu và nối các phần trên thành một luồng sử dụng.",
              "connects those operations through an interactive menu.",
            )}
          </li>
        </ul>
        <details className="panel trial-notes">
          <summary>
            {t("Xem dữ liệu bắt đầu", "Inspect the starting records")} ·
            books.example.json
          </summary>
          <pre className="trial-source" tabIndex={0}>
            <code>{material.sampleData}</code>
          </pre>
          <p>
            {t(
              "Đây là bản mẫu. Chương trình dùng books.json làm dữ liệu đang làm việc; không ghi đè file bạn muốn giữ khi thử.",
              "This is a sample. The program uses books.json for working data; do not overwrite a file you want to preserve when testing.",
            )}
          </p>
        </details>
      </section>

      <section
        id="lessons"
        className="trial-companion-section"
        aria-labelledby="trial-lessons-heading"
      >
        <h2 id="trial-lessons-heading">
          {t(
            "Bốn video, kèm bài đọc và bài tập.",
            "Four videos with written lessons and exercises.",
          )}
        </h2>
        <p>
          {t(
            "Bài đọc dưới mỗi video đang mở sẵn. Bạn có thể làm theo ví dụ, tự thử rồi xem phần đối chiếu; không cần xem hết video mới được bắt đầu.",
            "The written material below each video is expanded. Follow the examples, try the exercises and compare your result without waiting to finish every video. The teaching notes and audio are in Vietnamese; run instructions above are bilingual.",
          )}
        </p>
      </section>
      <nav
        aria-label={t("Bốn bài học", "Four lessons")}
        className="trial-chapters"
      >
        {project.lessons.map((lesson, index) => (
          <a href={`#lesson-${index + 1}`} key={lesson.title}>
            <span>0{index + 1}</span>
            {material.lessons[index].title[locale]}
          </a>
        ))}
      </nav>
      <div className="trial-lessons">
        {project.lessons.map((lesson, index) => (
          <section
            id={`lesson-${index + 1}`}
            key={lesson.title}
            className="trial-lesson"
            aria-labelledby={`lesson-title-${index + 1}`}
          >
            <header>
              <p className="section-label">
                {t("BÀI", "LESSON")} 0{index + 1}
              </p>
              <h2 id={`lesson-title-${index + 1}`}>
                {material.lessons[index].title[locale]}
              </h2>
              <p className="trial-lesson-description">
                {material.lessons[index].description[locale]}
              </p>
            </header>
            <video
              controls
              playsInline
              preload="metadata"
              aria-label={lesson.title}
              src={lesson.video}
            >
              {t(
                "Trình duyệt của bạn chưa hỗ trợ video này.",
                "Your browser does not support this video.",
              )}
            </video>
            <p className="trial-video-help">
              {t(
                "Dừng video để tự làm trước khi xem tiếp. Có thể chọn tốc độ phát trong trình đơn của trình phát. Video hiện chưa có phụ đề.",
                "Pause to try each step yourself. Playback speed is available in the player menu. Captions are not available yet.",
              )}
            </p>
            <details className="panel trial-notes" open>
              <summary>
                <BookOpen size={18} aria-hidden="true" />
                {t("Bài đọc & thực hành", "Written notes & practice")}
              </summary>
              <Prose source={material.lessons[index].notes} />
            </details>
          </section>
        ))}
      </div>
      <section className="trial-next">
        <p className="section-label">
          {t("SAU TỦ SÁCH", "AFTER THE BOOK PROJECT")}
        </p>
        <h2>
          {t(
            "Một vấn đề khác. Một dự án mới.",
            "Another problem. A new project.",
          )}
        </h2>
        <p>
          {t(
            "Khám phá chín dự án Python có phí từ 100.000₫ đến 200.000₫. Năm khóa có bài đọc đã mở đăng ký qua Zalo; bốn khóa khác sắp có.",
            "Explore nine paid Python projects from 100,000₫ to 200,000₫. Five written courses are open through Zalo; four more are upcoming.",
          )}
        </p>
        <Link href="/courses" className="studio-button">
          {t("Khám phá các dự án", "Explore projects")}
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}
