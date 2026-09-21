"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { enrolledCourseIds } from "@/lib/viewer";

/**
 * The "Đã đăng ký" badge on a statically rendered `CourseCard`. The card
 * lays it over the cover, so the answer arriving after hydration shifts
 * nothing (UX_PLAN.md §4.5 rule 6).
 */
export function EnrolledBadge({ courseId }: { courseId: string }) {
  const [enrolled, setEnrolled] = useState(false);

  useEffect(() => {
    let active = true;
    enrolledCourseIds().then((ids) => {
      if (active) setEnrolled(ids.has(courseId));
    });
    return () => {
      active = false;
    };
  }, [courseId]);

  return enrolled ? <Badge variant="success">Đã đăng ký</Badge> : null;
}
