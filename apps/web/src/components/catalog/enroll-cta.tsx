"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Paginated } from "@/lib/catalog";
import type { EnrollmentItem } from "@/lib/learning";
import { whoAmI } from "@/lib/viewer";
import { buttonClass } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";

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
  archived,
}: {
  courseId: string;
  slug: string;
  archived: boolean;
}) {
  const [audience, setAudience] = useState<Audience>("unknown");

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
    <div className="min-h-12">
      {audience === "signed-in" ? (
        <Link
          href={`/contact?course=${slug}`}
          className={buttonClass("accent", "lg", "w-full")}
        >
          Liên hệ để đăng ký
        </Link>
      ) : (
        <Link
          href={`/login?next=${encodeURIComponent(`/courses/${slug}`)}`}
          className={buttonClass("accent", "lg", "w-full")}
        >
          Đăng nhập để đăng ký học
        </Link>
      )}
    </div>
  );
}
