"use client";

import { Lock, LockOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { AdminUserRow } from "@/lib/admin";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { showToast } from "@/components/ui/toast";

/**
 * Block and unblock are one dialog on one endpoint (UX_PLAN.md §5.7): the body
 * is `{ status }` and nothing else, so there is no reason field. A 409
 * SELF_ACTION_FORBIDDEN surfaces inside the dialog through `ConfirmDialog`.
 * The reverse is "Bỏ khóa" (§5.7): "mở khóa" is reserved for creating an
 * Enrollment (§9.5).
 */
export function BlockUserDialog({
  user,
}: {
  user: Pick<AdminUserRow, "id" | "email" | "status">;
}) {
  const router = useRouter();
  const blocking = user.status === "ACTIVE";

  async function confirm() {
    await apiFetch(`/admin/users/${user.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: blocking ? "BLOCKED" : "ACTIVE" }),
    });
    showToast(
      blocking
        ? `Đã khóa tài khoản ${user.email}.`
        : `Đã bỏ khóa tài khoản ${user.email}.`,
      "success",
    );
    router.refresh();
  }

  return blocking ? (
    <ConfirmDialog
      title={`Khóa tài khoản ${user.email}?`}
      description="Mọi phiên đăng nhập của người này bị đăng xuất ngay và họ không đăng nhập lại được."
      confirmLabel="Khóa tài khoản"
      onConfirm={confirm}
      trigger={
        <Button variant="destructive">
          <Lock aria-hidden="true" className="size-4" strokeWidth={1.75} />
          Khóa tài khoản
        </Button>
      }
    />
  ) : (
    <ConfirmDialog
      title={`Bỏ khóa tài khoản ${user.email}?`}
      description="Người này đăng nhập lại được bằng mật khẩu hiện tại."
      confirmLabel="Bỏ khóa tài khoản"
      variant="primary"
      onConfirm={confirm}
      trigger={
        <Button variant="outline">
          <LockOpen aria-hidden="true" className="size-4" strokeWidth={1.75} />
          Bỏ khóa tài khoản
        </Button>
      }
    />
  );
}
