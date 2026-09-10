import type { Metadata } from "next";
import { ContactForm } from "@/components/contact-form";
import { getSession, type User } from "@/lib/session";
import { SITE_OWNER } from "@/lib/site";

export const metadata: Metadata = { title: "Liên hệ" };

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string }>;
}) {
  const { course } = await searchParams;
  let user: User | null = null;
  try {
    user = await getSession();
  } catch {
    user = null;
  }
  return (
    <div className="page-shell grid gap-10 py-12 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.55fr)] lg:gap-16 lg:py-20">
      <section className="grid content-start gap-8">
        <div className="grid gap-3">
          <h1 tabIndex={-1} className="text-4xl font-bold">
            Liên hệ
          </h1>
          <p className="max-w-prose text-lg text-muted-foreground">
            Gửi câu hỏi về khóa học. Bạn sẽ nhận phản hồi qua email trong vòng
            24 giờ.
          </p>
        </div>
        <ContactForm user={user} courseSlug={course} />
      </section>
      <aside className="h-fit border-t border-border pt-8 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
        <h2 className="text-2xl font-semibold">
          Thông tin người dạy đang cập nhật
        </h2>
        <p className="mt-3 text-muted-foreground">
          Vui lòng dùng biểu mẫu để liên hệ trực tiếp với {SITE_OWNER.name}.
        </p>
      </aside>
    </div>
  );
}
