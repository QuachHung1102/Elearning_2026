"use client";

import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { AdminEnrollment } from "@/lib/admin";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { showToast } from "@/components/ui/toast";

/**
 * `RevokeDialog` (UX_PLAN.md §5.4): no reason field — `DELETE` takes no body
 * and `forbidNonWhitelisted` would turn one into a 400. The endpoint writes
 * the audit row itself.
 */
export function RevokeEnrollmentDialog({
  enrollment,
}: {
  enrollment: Pick<AdminEnrollment, "id" | "user" | "course">;
}) {
  const router = useRouter();
  const { email } = enrollment.user;

  return (
    <ConfirmDialog
      title="Thu hồi quyền học"
      description={`Thu hồi quyền học của ${email} với khóa ${enrollment.course.title}? Học viên sẽ mất quyền truy cập ngay lập tức. Tiến độ học được giữ lại.`}
      confirmLabel="Thu hồi quyền học"
      onConfirm={async () => {
        await apiFetch(`/admin/enrollments/${enrollment.id}`, {
          method: "DELETE",
        });
        showToast(`Đã thu hồi quyền học của ${email}.`, "success");
        // The refresh unmounts this row's trigger, which would drop focus to
        // <body> (WCAG 2.4.3): land on the page heading once the dialog has
        // closed and handed focus back.
        requestAnimationFrame(() =>
          document.querySelector<HTMLElement>("main h1")?.focus(),
        );
        router.refresh();
      }}
      trigger={
        <Button variant="outline" size="sm">
          Thu hồi
          <span className="sr-only">
            {" "}
            quyền học của {email} với khóa {enrollment.course.title}
          </span>
        </Button>
      }
    />
  );
}
