import { EnrollmentContactCard } from "@/components/enrollment/contact-card";
import { enrollmentContact } from "@/lib/direct-enrollment";
import type { Metadata } from "next";
import { BookOpen, MessageCircle, Users } from "lucide-react";
import { ContactForm } from "@/components/contact-form";
import { getSession, type User } from "@/lib/session";
import { getLocale } from "@/lib/locale";
import { translate } from "@/lib/translations";
export const metadata: Metadata = { title: "Liên hệ / Get in touch" };
export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string }>;
}) {
  const [{ course }, locale] = await Promise.all([searchParams, getLocale()]);
  const t = (vi: string, en?: string) => translate(locale, vi, en);
  let user: User | null = null;
  try {
    user = await getSession();
  } catch {
    /* The contact form is also available to guests. */
  }
  return (
    <div className="page-shell">
      <header className="page-heading">
        <p className="section-label">
          {t("Cùng nói chuyện nhé", "Let’s talk")}
        </p>
        <h1>
          {t("Bạn đang nghĩ đến\nmột điều gì đó?", "Something\non your mind?")}
        </h1>
        <p>
          {t(
            "Bạn có câu hỏi về bài học, muốn góp ý một dự án, hoặc muốn tìm hiểu CodingBuddy cho con? Gửi mình một lời nhắn.",
            "A question about a lesson, feedback on a project, or wondering whether CodingBuddy is right for your child? Leave me a note.",
          )}
        </p>
      </header>
      <div className="contact-layout">
        <ContactForm user={user} courseSlug={course} />
        <aside className="contact-note">
          <h2>{t("Mình có thể giúp gì?", "What can I help with?")}</h2>
          <ul>
            <li>
              <BookOpen size={18} aria-hidden="true" />
              {t(
                "Nội dung học và kiến thức cần trước khi bắt đầu",
                "Lessons and what to know before starting",
              )}
            </li>
            <li>
              <MessageCircle size={18} aria-hidden="true" />
              {t(
                "Một ý tưởng, một lỗi khó hiểu, hoặc góp ý cho bài thực hành",
                "An idea, a puzzling bug, or feedback on the practice project",
              )}
            </li>
            <li>
              <Users size={18} aria-hidden="true" />
              {t(
                "Trao đổi với phụ huynh và đề xuất hợp tác giáo dục",
                "Parent questions and educational collaboration",
              )}
            </li>
          </ul>
          <p>
            {t(
              "Mình sẽ trả lời qua email bạn để lại trong biểu mẫu.",
              "I’ll reply using the email address you leave in the form.",
            )}
          </p>
          <EnrollmentContactCard contact={enrollmentContact} locale={locale} />
        </aside>
      </div>
    </div>
  );
}
