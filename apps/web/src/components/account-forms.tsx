"use client";

import { LogOut, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { apiFetch, errorMessage } from "@/lib/api";
import { passwordError } from "@/lib/password";
import type { SessionRow, User } from "@/lib/session";
import { Button } from "./ui/button";
import { ConfirmDialog } from "./ui/confirm-dialog";
import { Alert, ErrorSummary, focusValidation } from "./ui/feedback";
import { Field, PasswordInput } from "./ui/field";
import { showToast } from "./ui/toast";

const passwordFields = {
  current: { id: "current-password", label: "Mật khẩu hiện tại" },
  next: { id: "new-password", label: "Mật khẩu mới" },
  confirm: { id: "confirm-password", label: "Xác nhận mật khẩu mới" },
};

export function ProfileForm({ user }: { user: User }) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [savedName, setSavedName] = useState(user.displayName);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const changed = displayName.trim() !== savedName;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = displayName.trim();
    if (name.length < 2 || name.length > 80) {
      setError("Tên hiển thị cần từ 2 đến 80 ký tự.");
      return;
    }
    setError("");
    setStatus("");
    setBusy(true);
    try {
      await apiFetch("/users/me", {
        method: "PATCH",
        body: JSON.stringify({ displayName: name }),
      });
      setSavedName(name);
      setStatus("Đã lưu thay đổi.");
    } catch (caught) {
      setStatus(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="grid max-w-xl gap-6" onSubmit={submit} noValidate>
      {status && (
        <Alert
          variant={status.startsWith("Đã") ? "success" : "destructive"}
          title={status}
        />
      )}
      <Field id="profile-name" label="Tên hiển thị" required error={error}>
        <input
          id="profile-name"
          className="control"
          autoComplete="name"
          minLength={2}
          maxLength={80}
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "profile-name-error" : undefined}
        />
      </Field>
      <Field
        id="profile-email"
        label="Email"
        hint="Email đăng nhập không thể đổi ở phiên bản này."
      >
        <input
          id="profile-email"
          className="control"
          value={user.email}
          readOnly
        />
      </Field>
      <div>
        <Button type="submit" loading={busy} disabled={!changed} className="w-full">
          Lưu thay đổi
        </Button>
        {!changed && (
          <p className="mt-2 text-sm text-muted-foreground">
            Chưa có thay đổi để lưu.
          </p>
        )}
      </div>
    </form>
  );
}

export function PasswordForm() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!currentPassword) nextErrors.current = "Nhập mật khẩu hiện tại.";
    const passwordProblem = passwordError(newPassword);
    if (passwordProblem) nextErrors.next = passwordProblem;
    if (confirm !== newPassword) nextErrors.confirm = "Hai mật khẩu chưa khớp.";
    setErrors(nextErrors);
    setStatus("");
    if (Object.keys(nextErrors).length) {
      focusValidation(event.currentTarget, Object.keys(nextErrors).length);
      return;
    }
    setBusy(true);
    try {
      await apiFetch("/users/me/password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      router.replace("/login?passwordChanged=1");
      router.refresh();
    } catch (caught) {
      setStatus(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="grid max-w-xl gap-6" onSubmit={submit} noValidate>
      <Alert variant="warning" title="Bạn sẽ đăng xuất khỏi mọi thiết bị">
        Sau khi đổi mật khẩu, hãy đăng nhập lại bằng mật khẩu mới.
      </Alert>
      {status && <Alert variant="destructive" title={status} />}
      <ErrorSummary errors={errors} fields={passwordFields} />
      <PasswordInput
        id="current-password"
        label="Mật khẩu hiện tại"
        autoComplete="current-password"
        value={currentPassword}
        onChange={(event) => setCurrentPassword(event.target.value)}
        error={errors.current}
      />
      <PasswordInput
        id="new-password"
        label="Mật khẩu mới"
        autoComplete="new-password"
        value={newPassword}
        onChange={(event) => setNewPassword(event.target.value)}
        error={errors.next}
        showStrength
      />
      <PasswordInput
        id="confirm-password"
        label="Xác nhận mật khẩu mới"
        autoComplete="new-password"
        value={confirm}
        onChange={(event) => setConfirm(event.target.value)}
        error={errors.confirm}
      />
      <Button type="submit" loading={busy}>
        Đổi mật khẩu
      </Button>
    </form>
  );
}

const dateTime = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Asia/Ho_Chi_Minh",
});

export function SessionsTable({
  initialItems,
}: {
  initialItems: SessionRow[];
}) {
  const [items, setItems] = useState(initialItems);
  const [busyId, setBusyId] = useState("");

  async function revoke(id: string) {
    setBusyId(id);
    try {
      await apiFetch(`/users/me/sessions/${id}`, { method: "DELETE" });
      setItems((current) => current.filter((session) => session.id !== id));
      showToast("Đã đăng xuất phiên đó.", "success");
    } catch (error) {
      showToast(errorMessage(error), "error");
    } finally {
      setBusyId("");
    }
  }

  async function revokeOthers() {
    setBusyId("all");
    try {
      const count = items.filter(({ isCurrent }) => !isCurrent).length;
      await apiFetch("/users/me/sessions", { method: "DELETE" });
      setItems((current) => current.filter(({ isCurrent }) => isCurrent));
      showToast(`Đã đăng xuất ${count} phiên khác.`, "success");
    } catch (error) {
      showToast(errorMessage(error), "error");
    } finally {
      setBusyId("");
    }
  }

  const others = items.filter(({ isCurrent }) => !isCurrent).length;
  const revokeButton = (session: SessionRow) =>
    !session.isCurrent ? (
      <ConfirmDialog
        title="Đăng xuất phiên này"
        description="Phiên đó sẽ phải đăng nhập lại để tiếp tục."
        confirmLabel="Đăng xuất phiên này"
        busy={busyId === session.id}
        onConfirm={() => revoke(session.id)}
        trigger={
          <Button variant="outline" size="sm">
            <LogOut aria-hidden="true" className="size-4" strokeWidth={1.75} />
            Thu hồi
          </Button>
        }
      />
    ) : null;

  return (
    <div className="grid gap-5">
      <div className="grid gap-3 md:hidden">
        {items.map((session) => (
          <article
            key={session.id}
            className="rounded-lg border border-border bg-card p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">
                  {session.isCurrent ? "Phiên này" : "Phiên đăng nhập"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {session.isCurrent ? "Đang sử dụng" : "Đang hoạt động"}
                </p>
              </div>
              {revokeButton(session)}
            </div>
            <dl className="mt-4 grid gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Bắt đầu</dt>
                <dd className="mt-1 tabular-nums">
                  {dateTime.format(new Date(session.createdAt))}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Hết hạn</dt>
                <dd className="mt-1 tabular-nums">
                  {dateTime.format(new Date(session.expiresAt))}
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
      <div className="hidden overflow-x-auto rounded-lg border border-border bg-card md:block">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="bg-muted text-muted-foreground-strong">
            <tr>
              <th className="px-4 py-3 font-semibold">Bắt đầu</th>
              <th className="px-4 py-3 font-semibold">Hết hạn</th>
              <th className="px-4 py-3 font-semibold">Trạng thái</th>
              <th className="px-4 py-3 text-right font-semibold">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {items.map((session) => (
              <tr key={session.id} className="border-t border-border">
                <td className="px-4 py-3 tabular-nums">
                  {dateTime.format(new Date(session.createdAt))}
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {dateTime.format(new Date(session.expiresAt))}
                </td>
                <td className="px-4 py-3">
                  {session.isCurrent ? (
                    <span className="rounded-sm bg-primary-subtle px-2 py-1 text-xs font-semibold text-primary-on-subtle">
                      Phiên này
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      Đang hoạt động
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {revokeButton(session)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {others > 0 && (
        <ConfirmDialog
          title="Đăng xuất tất cả thiết bị khác"
          description="Phiên bạn đang dùng vẫn được giữ lại."
          confirmLabel="Đăng xuất tất cả thiết bị khác"
          busy={busyId === "all"}
          onConfirm={revokeOthers}
          trigger={
            <Button variant="outline" className="w-full sm:w-auto">
              <ShieldCheck
                aria-hidden="true"
                className="size-4"
                strokeWidth={1.75}
              />
              Đăng xuất tất cả thiết bị khác
            </Button>
          }
        />
      )}
    </div>
  );
}
