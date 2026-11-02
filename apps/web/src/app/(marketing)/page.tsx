import Link from "next/link";
import { ArrowRight, ArrowUpRight, BookOpen, MonitorPlay } from "lucide-react";
import { CourseGrid } from "@/components/catalog/course-card";
import { publicFetch, type CourseCard, type Paginated } from "@/lib/catalog";
import { projectCourse } from "@/lib/project-courses";
import { getLocale } from "@/lib/locale";
import { translate } from "@/lib/translations";

export default async function HomePage() {
  const locale = await getLocale();
  const t = (vi: string, en?: string) => translate(locale, vi, en);
  const catalog = await publicFetch<Paginated<CourseCard>>(
    "/courses?sort=publishedAt:desc&pageSize=12",
    60,
  ).catch(() => null);
  const featured =
    catalog?.items.filter((course) => projectCourse(course.slug)) ?? [];
  const highlights = [
    featured.find((course) => course.slug === "python-tu-sach-lop-minh"),
    featured.find((course) => course.slug === "python-ngan-sach-cau-lac-bo"),
  ].filter((course): course is CourseCard => Boolean(course));
  return (
    <>
      <section className="studio-intro page-shell">
        <div className="intro-context">
          <span className="context-dot" />
          {t(
            "Học lập trình cùng Hải Nam / Dành cho bạn 10–15 tuổi",
            "Learn to code with Hải Nam / For ages 10–15",
          )}
        </div>
        <div className="intro-heading">
          <h1>
            {t("Từ bài học nhỏ", "From small lessons")}
            <br />
            {t("đến", "to")} <em>{t("dự án có ích.", "useful projects.")}</em>
          </h1>
          <div>
            <p>
              {t(
                "Bắt đầu với tủ sách chia sẻ miễn phí. Sau đó, chọn một vấn đề gần mình và xây công cụ Python để giải quyết từng việc cụ thể.",
                "Start with the free book-sharing project. Then choose a problem close to home and build a Python tool to solve a real task.",
              )}
            </p>
            <div className="hero-actions">
              <Link href="/courses" className="studio-button">
                {t("Khám phá khóa học", "Explore courses")}{" "}
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link href="/workshop" className="inline-link">
                {t("Học thử dự án tủ sách", "Try the free book project")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section
        className="page-shell featured-courses"
        aria-labelledby="featured-heading"
      >
        <header className="catalog-heading">
          <div>
            <p className="section-label">
              {t("HỌC QUA NHỮNG VIỆC CÓ THẬT", "LEARN THROUGH REAL TASKS")}
            </p>
            <h2 id="featured-heading">
              {t("Bạn sẽ làm được gì?", "What will you build?")}
            </h2>
          </div>
          <Link href="/courses" className="inline-link">
            {t("Tất cả khóa học", "All courses")}{" "}
            <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </header>
        {highlights.length > 0 ? (
          <CourseGrid courses={highlights} />
        ) : (
          <div className="catalog-empty">
            <p>
              {t(
                "Các khóa học và dự án nằm trong thư viện khóa học. Mở thư viện để xem nội dung và bắt đầu học.",
                "Explore the course library to see lessons and projects, then start learning.",
              )}
            </p>
            <Link href="/courses" className="studio-button">
              {t("Mở thư viện khóa học", "Open the course library")}
            </Link>
          </div>
        )}
        <p className="course-format-note">
          {t(
            "Tủ sách chia sẻ: 4 video và bài thực hành miễn phí. Năm dự án có bài đọc đã mở đăng ký; bốn dự án khác sắp có. Học phí từ 100.000₫ đến 200.000₫.",
            "Book sharing: four free videos with practice notes. Five written project courses are open for enrollment; four more are upcoming. Fees range from 100,000₫ to 200,000₫.",
          )}
        </p>
      </section>

      <section
        className="teaching-section page-shell"
        aria-labelledby="teaching-heading"
      >
        <div className="section-side">
          <p className="section-label">
            {t("Học cùng CodingBuddy", "Learning with CodingBuddy")}
          </p>
          <h2 id="teaching-heading">
            {t(
              "Đi từng bước.\nHiểu điều mình làm.",
              "Take your time.\nUnderstand what you build.",
            )}
          </h2>
          <p>
            {t(
              "Không cần biết hết mọi thứ để bắt đầu. Chúng mình học những điều cần thiết, rồi dùng chúng trong một dự án cụ thể.",
              "You don’t have to know everything to begin. We learn what we need, then put it to work in a specific project.",
            )}
          </p>
          <Link className="inline-link" href="/courses">
            {t("Xem lộ trình học", "Explore the learning path")}{" "}
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
        <div className="teaching-sequence">
          {[
            [
              "01",
              t("Nhìn kỹ một vấn đề", "Look closely at a problem"),
              t(
                "Ai sẽ dùng dự án này? Họ đang cần điều gì? Bắt đầu bằng câu hỏi trước khi viết code.",
                "Who will use this project? What do they need? Begin with a question before writing code.",
              ),
            ],
            [
              "02",
              t(
                "Học công cụ, làm thử",
                "Learn the tools, make a first version",
              ),
              t(
                "Làm quen với kiến thức nền tảng qua ví dụ. Viết một phần nhỏ, chạy thử và sửa lỗi cùng nhau.",
                "Meet the fundamentals through examples. Build a small part, try it, and work through the bugs.",
              ),
            ],
            [
              "03",
              t("Đưa cho một người dùng thử", "Let someone try it"),
              t(
                "Lắng nghe chỗ còn khó dùng. Thay đổi một điều để dự án có ích hơn, rồi thử lại.",
                "Listen to what is difficult. Change one thing to make the project more useful, then try again.",
              ),
            ],
          ].map(([number, title, description]) => (
            <div className="teaching-step" key={number}>
              <span>{number}</span>
              <div>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
            </div>
          ))}
          <div className="recording-note">
            <MonitorPlay size={21} aria-hidden="true" />
            <p>
              {t(
                "Bốn video đầu tiên của mình đã có trong dự án tủ sách chia sẻ. Bạn có thể xem và làm theo ngay, không cần tài khoản.",
                "My first four videos are in the book-sharing project. Watch and build along now, with no account required.",
              )}
            </p>
          </div>
        </div>
      </section>

      <section className="tutor-section">
        <div className="page-shell tutor-grid">
          <div className="tutor-identity">
            <span className="tutor-monogram" aria-label="Hải Nam">
              hn<span>.</span>
            </span>
            <div>
              <p>{t("Người bạn cùng học", "Your learning buddy")}</p>
              <h2>Hải Nam</h2>
              <span>{t("Người sáng lập & người dạy", "Founder & tutor")}</span>
            </div>
          </div>
          <div className="tutor-story">
            <h2>{t("Chào bạn, mình là Nam.", "Hey, I’m Nam.")}</h2>
            <p>
              {t(
                "Mình thích robot và khoảnh khắc một đoạn code cuối cùng cũng chạy. Nhưng mình còn tò mò hơn về việc nó giúp được ai.",
                "I like robots and the moment a piece of code finally works. I’m even more curious about who it can help.",
              )}
            </p>
            <p>
              {t(
                "CodingBuddy là nơi mình chia sẻ cách học và cách làm đó. Bạn được hỏi, được thử sai, và được bắt đầu từ những điều rất nhỏ.",
                "CodingBuddy is where I share that way of learning and making. You can ask questions, make mistakes, and start with something very small.",
              )}
            </p>
            <Link href="/about" className="inline-link">
              {t(
                "Câu chuyện phía sau CodingBuddy",
                "The story behind CodingBuddy",
              )}{" "}
              <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section className="purpose-section page-shell">
        <div className="purpose-heading">
          <BookOpen size={28} aria-hidden="true" />
          <h2>
            {t(
              "Kiến thức có ích hơn\nkhi được sẻ chia.",
              "Learning goes further\nwhen we share it.",
            )}
          </h2>
        </div>
        <div>
          <p>
            {t(
              "CodingBuddy hướng tới việc đưa cơ hội học công nghệ đến gần hơn với trẻ em ở cộng đồng dân tộc thiểu số. Bắt đầu từ những bài học dễ tiếp cận và những dự án hiểu người dùng của mình.",
              "CodingBuddy aims to bring technology learning closer to children in ethnic minority communities. It starts with accessible lessons and projects built with their users in mind.",
            )}
          </p>
          <Link href="/contact" className="inline-link">
            {t("Trao đổi với mình", "Get in touch")}{" "}
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </>
  );
}
