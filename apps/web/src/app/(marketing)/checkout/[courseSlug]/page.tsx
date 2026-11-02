import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowUpRight, BookOpen } from "lucide-react";
import { Cover, CourseMeta, PriceTag } from "@/components/catalog/course-card";
import { EnrollmentContactCard } from "@/components/enrollment/contact-card";
import { EnrollmentMessageCopy } from "@/components/enrollment/message-copy";
import { enrollmentContact } from "@/lib/direct-enrollment";
import { publicFetch, type CourseDetail } from "@/lib/catalog";
import { getLocale } from "@/lib/locale";
import { projectCopy, projectCourse } from "@/lib/project-courses";
import { translate } from "@/lib/translations";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: translate(locale, "Đăng ký trực tiếp", "Enroll directly") };
}

/** Public direct-contact enrollment. Visiting never opens a payment session. */
export default async function DirectEnrollmentPage({
  params,
}: {
  params: Promise<{ courseSlug: string }>;
}) {
  const { courseSlug } = await params;
  const [course, locale] = await Promise.all([
    publicFetch<CourseDetail>("/courses/" + encodeURIComponent(courseSlug), 60),
    getLocale(),
  ]);
  if (course.priceVnd === 0) redirect("/courses/" + course.slug);
  const copy = projectCopy(course.slug, locale);
  const planned = projectCourse(course.slug)?.availability === "planned";
  const title = copy?.title ?? course.title;
  const t = (vi: string, en: string) => translate(locale, vi, en);
  return (
    <div className="page-shell direct-enrollment">
      <Link
        className="inline-link direct-back"
        href={"/courses/" + course.slug}
      >
        <ArrowLeft size={17} aria-hidden="true" />
        {t("Về khóa học", "Back to the course")}
      </Link>
      <header className="direct-enrollment-header">
        {planned && (
          <div className="panel p-5 mb-6" role="note">
            <p>
              {t(
                "Dự án đang chuẩn bị. Chưa mở đăng ký học. Bạn có thể nhắn Nam để hỏi về phạm vi và thời điểm có bài học.",
                "This project is in preparation and enrollment is not open yet. You can ask Nam about its scope and lesson availability.",
              )}
            </p>
          </div>
        )}
        <p className="section-label">
          {t("ĐĂNG KÝ CÙNG NAM", "JOIN THROUGH NAM")}
        </p>
        <h1 tabIndex={-1}>
          {planned
            ? t("Tìm hiểu dự án", "Explore the project")
            : t("Đăng ký học", "Enroll directly")}
          <br />
          <em>{t("cùng Nam.", "with Nam.")}</em>
        </h1>
        <p className="direct-enrollment-intro">
          {t(
            "Nhắn Nam qua Zalo hoặc thông tin bên dưới để trao đổi học phí và cách tham gia khóa học.",
            "Message Nam through Zalo or the details below to discuss the course fee and how to join.",
          )}
        </p>
        <p className="direct-selected-caption">
          {t("Khóa học bạn chọn:", "Your selected course:")}{" "}
          <strong>{title}</strong>
        </p>
      </header>
      <div className="direct-enrollment-grid">
        <EnrollmentContactCard contact={enrollmentContact} locale={locale} />
        <div className="direct-enrollment-main">
          <section
            className="direct-course-summary"
            aria-labelledby="selected-course-title"
          >
            <Cover course={course} />
            <div>
              <p className="section-label">
                {t("KHÓA HỌC BẠN CHỌN", "YOUR SELECTED COURSE")}
              </p>
              <h2 id="selected-course-title">{title}</h2>
              <CourseMeta course={course} />
              <div className="direct-course-price">
                <PriceTag
                  priceVnd={course.priceVnd}
                  compareAtPriceVnd={course.compareAtPriceVnd}
                />
                <span>
                  {t(
                    "Học phí niêm yết · xác nhận cùng Nam khi đăng ký",
                    "Listed fee · confirm with Nam when enrolling",
                  )}
                </span>
              </div>
            </div>
          </section>
          <EnrollmentMessageCopy
            key={locale}
            title={course.title}
            slug={course.slug}
          />
          {!planned && (
            <section
              className="direct-enrollment-steps"
              aria-labelledby="direct-next-title"
            >
              <h2 id="direct-next-title">
                {t("Sau khi nhắn Nam", "After you message Nam")}
              </h2>
              <ol>
                {[
                  [
                    t("Trao đổi khóa học", "Discuss your course"),
                    t(
                      "Gửi tên khóa học và email tài khoản học của bạn. Nam sẽ trao đổi học phí và cách tham gia trực tiếp.",
                      "Send the course name and your learning account email. Nam will discuss the fee and joining details directly.",
                    ),
                  ],
                  [
                    t(
                      "Nam xác nhận và mở quyền học",
                      "Nam confirms and grants access",
                    ),
                    t(
                      "Sau khi thống nhất và xác nhận đăng ký, Nam sẽ cấp quyền học cho đúng tài khoản của bạn.",
                      "After agreeing on the details and confirming your enrollment, Nam will grant access to your account.",
                    ),
                  ],
                  [
                    t(
                      "Vào học từ tài khoản của bạn",
                      "Start from your account",
                    ),
                    t(
                      "Khóa học sẽ xuất hiện trong Khóa học của tôi. Bài học, tài liệu và tiến độ vẫn ở đó mỗi khi bạn quay lại.",
                      "The course will appear in My learning, where you can access lessons, resources, and your saved progress.",
                    ),
                  ],
                ].map(([heading, description], index) => (
                  <li key={heading}>
                    <span aria-hidden="true">0{index + 1}</span>
                    <div>
                      <h3>{heading}</h3>
                      <p>{description}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="direct-account-note">
                <BookOpen size={20} aria-hidden="true" />
                <p>
                  {t(
                    "Chưa có tài khoản học? Bạn có thể tạo tài khoản để Nam cấp quyền sau khi xác nhận.",
                    "Need a learning account? Create one so Nam can grant access after confirming your enrollment.",
                  )}{" "}
                  <Link
                    href={
                      "/register?next=" +
                      encodeURIComponent("/courses/" + course.slug)
                    }
                  >
                    {t("Tạo tài khoản", "Create an account")}{" "}
                    <ArrowUpRight size={14} aria-hidden="true" />
                  </Link>
                </p>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
