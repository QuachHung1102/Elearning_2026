"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { whoAmI } from "@/lib/viewer";
import { buttonClass } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";

type Audience = "unknown" | "guest" | "signed-in";

/**
 * A client island because the course page is statically rendered and shared by
 * everyone: whether the reader is signed in is the one thing the cached HTML
 * cannot know. The slot keeps a fixed height so the answer arriving after
 * hydration does not push the page down.
 */
export function EnrollCta({
  slug,
  archived,
}: {
  slug: string;
  archived: boolean;
}) {
  const [audience, setAudience] = useState<Audience>("unknown");

  useEffect(() => {
    let active = true;
    whoAmI().then((user) => {
      if (active) setAudience(user ? "signed-in" : "guest");
    });
    return () => {
      active = false;
    };
  }, []);

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
