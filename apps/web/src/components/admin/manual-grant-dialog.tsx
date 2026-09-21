"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import type {
  AdminEnrollment,
  AdminUserRow,
  GrantableCourse,
} from "@/lib/admin";
import type { Paginated } from "@/lib/catalog";
import { formatDate, STATUS_LABEL } from "@/lib/format";
import { t } from "@/messages/vi";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { RequestId } from "@/components/ui/request-id";
import { showToast } from "@/components/ui/toast";

const NOT_FOUND_EMAIL =
  "Không tìm thấy tài khoản với email này. Học viên cần tự đăng ký trước.";

/**
 * `ManualGrantDialog` (UX_PLAN.md §5.4). The API grants by user id, so the
 * email is resolved through `GET /admin/users?q=` first; the same search feeds
 * the suggestions. An already-active pair is detected before the POST so the
 * dialog can say since when, instead of a success toast for nothing.
 *
 * With `user` set (the user's own page) the learner is fixed and only the
 * course is chosen.
 */
export function ManualGrantDialog({
  courses,
  user,
}: {
  /** PUBLISHED and ARCHIVED only: a DRAFT course cannot be granted. */
  courses: GrantableCourse[];
  user?: { id: string; email: string };
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const emailInput = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const granted = useRef(false);
  // Unique per instance: the empty state renders a second dialog on one page.
  const base = useId();
  const titleId = `${base}-title`;
  const [formKey, setFormKey] = useState(0);
  const [pending, setPending] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [activeSince, setActiveSince] = useState<string | null>(null);
  const [failure, setFailure] = useState<{
    message: string;
    requestId?: string;
  } | null>(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // The empty state's copy of this dialog unmounts with its trigger once the
  // first grant refreshes the list in, which drops focus to <body> (WCAG
  // 2.4.3): land on the page heading instead, as RevokeEnrollmentDialog does.
  useEffect(
    () => () => {
      if (!granted.current) return;
      requestAnimationFrame(() => {
        if (document.activeElement === document.body)
          document.querySelector<HTMLElement>("main h1")?.focus();
      });
    },
    [],
  );

  useEffect(() => {
    const q = query.trim();
    if (user || q.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      apiFetch<Paginated<AdminUserRow>>(
        `/admin/users?q=${encodeURIComponent(q.slice(0, 100))}&pageSize=8&sort=email:asc`,
        { signal: controller.signal },
      ).then(
        ({ items }) => setSuggestions(items.map(({ email }) => email)),
        // Suggestions are a convenience; typing the full email still works.
        () => undefined,
      );
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, user]);

  function open() {
    setFormKey((key) => key + 1);
    setEmailError(null);
    setActiveSince(null);
    setFailure(null);
    setQuery("");
    setSuggestions([]);
    dialog.current?.showModal();
    // After the re-keyed form mounts: start on its first field.
    requestAnimationFrame(() =>
      dialog.current
        ?.querySelector<HTMLElement>("input, select")
        ?.focus(),
    );
  }

  async function findUser(email: string) {
    const { items } = await apiFetch<Paginated<AdminUserRow>>(
      `/admin/users?email=${encodeURIComponent(email)}&pageSize=1`,
    );
    return items[0];
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const form = new FormData(event.currentTarget);
    const typed = String(form.get("email") ?? "").trim();
    const courseId = String(form.get("courseId") ?? "");
    const note = String(form.get("note") ?? "").trim();

    inFlight.current = true;
    setPending(true);
    setEmailError(null);
    setFailure(null);
    try {
      const learner = user ?? (await findUser(typed));
      if (!learner) {
        setEmailError(NOT_FOUND_EMAIL);
        requestAnimationFrame(() => emailInput.current?.focus());
        return;
      }
      const { items } = await apiFetch<Paginated<AdminEnrollment>>(
        `/admin/enrollments?userId=${learner.id}&courseId=${courseId}&status=ACTIVE&pageSize=1`,
      );
      if (items[0]) {
        setActiveSince(formatDate(items[0].grantedAt));
        // The focused submit button unmounts: move to "Đóng", its replacement.
        requestAnimationFrame(() =>
          dialog.current?.querySelector<HTMLElement>("form button")?.focus(),
        );
        return;
      }
      await apiFetch("/admin/enrollments", {
        method: "POST",
        body: JSON.stringify({
          userId: learner.id,
          courseId,
          ...(note ? { note } : {}),
        }),
      });
      inFlight.current = false;
      granted.current = true;
      dialog.current?.close();
      showToast(`Đã cấp quyền học cho ${learner.email}.`, "success");
      router.refresh();
    } catch (caught) {
      const apiError = caught instanceof ApiError ? caught : null;
      if (apiError?.code === "UNAUTHENTICATED") {
        // The session-expired toast already says it and redirects.
        inFlight.current = false;
        dialog.current?.close();
        return;
      }
      // Everything typed stays in the form; only the alert is new (§5.4).
      setFailure({
        message: t(apiError?.code ?? "INTERNAL"),
        requestId: apiError?.requestId,
      });
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  const emailId = `${base}-email`;
  const courseFieldId = `${base}-course`;
  const noteId = `${base}-note`;

  return (
    <>
      <Button onClick={open}>
        <Plus aria-hidden="true" className="size-4" strokeWidth={1.75} />
        Cấp quyền học
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="m-auto w-[calc(100%-2rem)] max-w-xl rounded-xl border border-border bg-card p-6 text-card-foreground shadow-[var(--shadow-modal)] backdrop:bg-overlay"
        // Escape must not hide a grant that is still running.
        onCancel={(event) => {
          if (inFlight.current) event.preventDefault();
        }}
      >
        <form key={formKey} className="grid gap-5" onSubmit={submit}>
          <h2 id={titleId} className="text-xl font-semibold">
            Cấp quyền học
          </h2>

          {activeSince ? (
            <Alert
              variant="info"
              title={`Học viên này đã có quyền học khóa đó từ ${activeSince}.`}
            />
          ) : (
            <>
              {failure && (
                <div className="grid gap-2">
                  <Alert variant="destructive" title={failure.message} />
                  {failure.requestId && <RequestId id={failure.requestId} />}
                </div>
              )}
              {user ? (
                <p className="text-sm [overflow-wrap:anywhere]">
                  <span className="text-muted-foreground">Học viên: </span>
                  <span className="font-semibold">{user.email}</span>
                </p>
              ) : (
                <Field
                  id={emailId}
                  label="Email học viên"
                  required
                  error={emailError ?? undefined}
                >
                  <input
                    ref={emailInput}
                    id={emailId}
                    name="email"
                    type="email"
                    required
                    maxLength={320}
                    autoComplete="off"
                    list={`${emailId}-list`}
                    className="control"
                    aria-invalid={Boolean(emailError)}
                    aria-describedby={emailError ? `${emailId}-error` : undefined}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setEmailError(null);
                    }}
                  />
                  <datalist id={`${emailId}-list`}>
                    {suggestions.map((email) => (
                      <option key={email} value={email} />
                    ))}
                  </datalist>
                </Field>
              )}
              <Field id={courseFieldId} label="Khóa học" required>
                <select
                  id={courseFieldId}
                  name="courseId"
                  required
                  defaultValue=""
                  className="control"
                >
                  <option value="" disabled>
                    Chọn khóa học
                  </option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.status === "ARCHIVED"
                        ? `${course.title} (${STATUS_LABEL.ARCHIVED})`
                        : course.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                id={noteId}
                label="Ghi chú"
                hint="Không bắt buộc, tối đa 500 ký tự."
              >
                <textarea
                  id={noteId}
                  name="note"
                  maxLength={500}
                  className="control min-h-24"
                  aria-describedby={`${noteId}-hint`}
                />
              </Field>
            </>
          )}

          <div className="flex flex-wrap justify-end gap-3">
            {activeSince ? (
              <Button
                type="button"
                onClick={() => dialog.current?.close()}
              >
                Đóng
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => dialog.current?.close()}
                >
                  Hủy
                </Button>
                <Button type="submit" loading={pending}>
                  Cấp quyền
                </Button>
              </>
            )}
          </div>
        </form>
      </dialog>
    </>
  );
}
