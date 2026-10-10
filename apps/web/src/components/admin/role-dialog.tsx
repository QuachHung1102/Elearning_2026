"use client";

import { UserCog } from "lucide-react";
import { useRouter } from "next/navigation";
import type { AdminUserRow } from "@/lib/admin";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { showToast } from "@/components/ui/toast";

/**
 * Student ⇄ instructor, the only change the API accepts (ADMIN is seed-only).
 * Not offered for an admin's own profile (409 from the API) nor for another
 * admin: demoting an admin is a CLI matter, not a button.
 */
export function RoleDialog({
  user,
}: {
  user: Pick<AdminUserRow, "id" | "email" | "role">;
}) {
  const router = useRouter();
  if (user.role === "ADMIN") return null;
  const promoting = user.role === "STUDENT";

  return (
    <ConfirmDialog
      title={
        promoting
          ? `Đổi ${user.email} thành giảng viên?`
          : `Đổi ${user.email} về học viên?`
      }
      description={
        promoting
          ? "Người này vào được khu vực Giảng viên để soạn và xuất bản khóa học do mình đứng tên. Có hiệu lực ở lần tải trang tiếp theo."
          : "Người này mất quyền vào khu vực Giảng viên. Các khóa học họ đang đứng tên chuyển về chủ site; học viên đã ghi danh vẫn học bình thường."
      }
      confirmLabel={promoting ? "Đổi thành giảng viên" : "Đổi về học viên"}
      variant={promoting ? "primary" : "destructive"}
      onConfirm={async () => {
        await apiFetch(`/admin/users/${user.id}/role`, {
          method: "PATCH",
          body: JSON.stringify({ role: promoting ? "INSTRUCTOR" : "STUDENT" }),
        });
        showToast(
          promoting
            ? `Đã đổi ${user.email} thành giảng viên.`
            : `Đã đổi ${user.email} về học viên.`,
          "success",
        );
        router.refresh();
      }}
      trigger={
        <Button variant="outline">
          <UserCog aria-hidden="true" className="size-4" strokeWidth={1.75} />
          {promoting ? "Đổi thành giảng viên" : "Đổi về học viên"}
        </Button>
      }
    />
  );
}
