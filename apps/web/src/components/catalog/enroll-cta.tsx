"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import type { Paginated } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import type { EnrollmentItem } from "@/lib/learning";
import { CHECKOUT_ENABLED, type CheckoutSession } from "@/lib/orders";
import { whoAmI } from "@/lib/viewer";
import { t } from "@/messages/vi";
import { Button, buttonClass } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { showToast } from "@/components/ui/toast";

type Audience = "unknown" | "guest" | "signed-in" | "enrolled" | "started";

/** Only this course, only if it is ACTIVE; any failure keeps the plain CTA. */
export async function audienceOf(courseId: string): Promise<Audience> {
  const user = await whoAmI();
  if (!user) return "guest";
  try {
    const response = await fetch(
      `/api/v1/enrollments/me?courseId=${courseId}&pageSize=1`,
      { credentials: "include", cache: "no-store" },
    );
    if (!response.ok) return "signed-in";
    const [enrollment] = ((await response.json()) as Paginated<EnrollmentItem>)
      .items;
    if (enrollment?.status !== "ACTIVE") return "signed-in";
    return enrollment.progress.completedLessons > 0 ? "started" : "enrolled";
  } catch {
    return "signed-in";
  }
}

/**
 * A client island because the course page is statically rendered and shared by
 * everyone: who is reading, and whether they may already learn here, is the
 * one thing the cached HTML cannot know. The slot keeps a fixed height so the
 * answer arriving after hydration does not push the page down.
 */
export function EnrollCta({
  courseId,
  slug,
  priceVnd,
  archived,
}: {
  courseId: string;
  slug: string;
  /** What the cached page shows; the QR's own amount is what is charged. */
  priceVnd: number;
  archived: boolean;
}) {
  const router = useRouter();
  const [audience, setAudience] = useState<Audience>("unknown");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<"price" | "unavailable" | null>(null);

  /**
   * "Đăng ký học": open the checkout, then go to its page. The endpoint hands
   * back a live QR when there is one, so a 200 and a 201 lead to the same
   * place (UX_PLAN.md §3.1).
   */
  async function start() {
    setBusy(true);
    setNotice(null);
    try {
      const session = await apiFetch<CheckoutSession>(`/checkout/${slug}`, {
        method: "POST",
      });
      // The page can be up to 300 s old; the QR already exists at the new
      // price, so say so instead of sending the learner on.
      if (session.amountVnd !== priceVnd) {
        setNotice("price");
        setBusy(false);
        return;
      }
      // Stay busy through the navigation: a second click would open a second QR.
      router.push(`/checkout/${slug}`);
    } catch (caught) {
      const error = caught instanceof ApiError ? caught : null;
      if (error?.code === "ALREADY_ENROLLED") {
        showToast(t("ALREADY_ENROLLED"), "info");
        router.replace(`/learn/${slug}`);
        return;
      }
      // The checkout page explains this one and offers the resend button.
      if (error?.code === "EMAIL_NOT_VERIFIED") {
        router.push(`/checkout/${slug}`);
        return;
      }
      setBusy(false);
      // The session-expired toast already says it and redirects.
      if (error?.code === "UNAUTHENTICATED") return;
      if (error?.status === 422) {
        setNotice("unavailable");
        return;
      }
      showToast(t(error?.code ?? "INTERNAL"), "error");
    }
  }

  useEffect(() => {
    let active = true;
    audienceOf(courseId).then((result) => {
      if (active) setAudience(result);
    });
    return () => {
      active = false;
    };
  }, [courseId]);

  if (audience === "enrolled" || audience === "started") {
    return (
      <div className="min-h-12">
        <Link
          href={`/learn/${slug}`}
          className={buttonClass("primary", "lg", "w-full")}
        >
          {audience === "started" ? "Tiếp tục học" : "Vào học"}
        </Link>
      </div>
    );
  }

  if (archived) {
    return (
      <div className="grid gap-3">
        <span
          aria-disabled="true"
          className={`${buttonClass("outline", "lg")} pointer-events-none opacity-60`}
        >
          Khóa học đã ngừng nhận học viên
        </span>
        <Alert variant="info" title="Khóa học đã lưu trữ">
          Khóa học này không còn nhận học viên mới. Người đã có quyền học vẫn
          học bình thường.
        </Alert>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="min-h-12">
        {audience === "signed-in" ? (
          CHECKOUT_ENABLED ? (
            <Button
              variant="accent"
              size="lg"
              className="w-full"
              loading={busy}
              onClick={start}
            >
              Đăng ký học · {formatPrice(priceVnd)}
            </Button>
          ) : (
            <Link
              href={`/contact?course=${slug}`}
              className={buttonClass("accent", "lg", "w-full")}
            >
              Liên hệ để đăng ký
            </Link>
          )
        ) : (
          <Link
            href={`/login?next=${encodeURIComponent(`/courses/${slug}`)}`}
            className={buttonClass("accent", "lg", "w-full")}
          >
            Đăng nhập để đăng ký học
          </Link>
        )}
      </div>
      {notice === "price" && (
        <Alert variant="warning" title="Giá khóa học đã thay đổi">
          Tải lại trang để xem giá mới.
          <ReloadButton />
        </Alert>
      )}
      {notice === "unavailable" && (
        <Alert variant="warning" title="Khóa học này hiện không nhận đăng ký">
          Tải lại trang để xem trạng thái mới nhất.
          <ReloadButton />
        </Alert>
      )}
    </div>
  );
}

function ReloadButton() {
  return (
    <div className="mt-2">
      <Button variant="outline" onClick={() => window.location.reload()}>
        Tải lại trang
      </Button>
    </div>
  );
}
