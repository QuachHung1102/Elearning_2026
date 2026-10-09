import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckoutPanel } from "@/components/checkout/checkout-panel";
import { publicFetch, type CourseDetail } from "@/lib/catalog";
import { CHECKOUT_ENABLED } from "@/lib/orders";

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
  const course = await publicFetch<CourseDetail>(`/courses/${courseSlug}`);

  return (
    <div className="page-shell grid gap-8 py-10 lg:py-14">
      <h1 tabIndex={-1} className="text-4xl font-bold">
        Hoàn tất đăng ký học
      </h1>
      <CheckoutPanel slug={course.slug} courseTitle={course.title} />
    </div>
  );
}
