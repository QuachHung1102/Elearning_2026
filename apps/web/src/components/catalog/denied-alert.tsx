"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/feedback";
import { t } from "@/messages/vi";
import { audienceOf } from "./enroll-cta";

/**
 * The player layout sends a learner without access back here with
 * `?denied=1` (UX_PLAN.md §2.3). The course page is prerendered for everyone,
 * so the flag is read on the client, inside a `<Suspense>` the page provides.
 * A stale link reopened after access was granted says nothing: the CTA next to
 * it already reads "Vào học". The check is per course and fresh, like the CTA's:
 * the page-wide enrolled-course cache can predate a revoke that happened
 * during this client-side session.
 */
export function DeniedAlert({ courseId }: { courseId: string }) {
  const denied = useSearchParams().get("denied") === "1";
  const [enrolled, setEnrolled] = useState<boolean | null>(null);

  useEffect(() => {
    if (!denied) return;
    let active = true;
    audienceOf(courseId).then((audience) => {
      if (active)
        setEnrolled(audience === "enrolled" || audience === "started");
    });
    return () => {
      active = false;
    };
  }, [denied, courseId]);

  return denied && enrolled === false ? (
    <Alert variant="warning" title={t("NOT_ENROLLED")} />
  ) : null;
}
