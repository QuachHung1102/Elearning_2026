import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckoutPanel } from "@/components/checkout/checkout-panel";
import { publicFetch, type CourseDetail } from "@/lib/catalog";
import { CHECKOUT_ENABLED } from "@/lib/orders";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Thanh toán" };

/**
 * The page is a shell: the checkout itself opens from the browser, where the
 * learner's session and CSRF token live, and the amount shown is the QR's own.
 * Only the course's name and address come from here.
 */
export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ courseSlug: string }>;
}) {
  if (!CHECKOUT_ENABLED) notFound();
  const { courseSlug } = await params;
  const [course, user] = await Promise.all([
    publicFetch<CourseDetail>(`/courses/${courseSlug}`),
    getSession(),
  ]);

  return (
    <div className="page-shell grid gap-8 py-10 lg:py-14">
      <nav aria-label="Đường dẫn" className="text-sm text-muted-foreground">
        <ol className="flex list-none flex-wrap items-center gap-1 p-0">
          <li>
            <Link className="hover:text-primary-text" href="/courses">
              Khóa học
            </Link>
          </li>
          <ChevronRight aria-hidden="true" className="size-4" strokeWidth={1.75} />
          <li>
            <Link className="hover:text-primary-text" href={`/courses/${course.slug}`}>
              {course.title}
            </Link>
          </li>
          <ChevronRight aria-hidden="true" className="size-4" strokeWidth={1.75} />
          <li aria-current="page">Thanh toán</li>
        </ol>
      </nav>
      <h1 tabIndex={-1} className="text-4xl font-bold">
        Thanh toán
      </h1>
      <CheckoutPanel
        slug={course.slug}
        courseTitle={course.title}
        isAdmin={user?.role === "ADMIN"}
      />
    </div>
  );
}
