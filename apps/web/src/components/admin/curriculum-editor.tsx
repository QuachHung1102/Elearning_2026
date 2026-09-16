"use client";

import {
  ChevronDown,
  ChevronUp,
  FileText,
  Pencil,
  Plus,
  Trash2,
  Video,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import type { AdminCourseDetail, LessonType } from "@/lib/catalog";
import { formatDuration, formatNumber } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { showToast } from "@/components/ui/toast";

const ERROR_MESSAGE: Record<string, string> = {
  SECTION_NOT_EMPTY: "Chương vẫn còn bài học. Xóa hết bài trước khi xóa chương.",
  ORDER_MISMATCH: "Danh sách đã thay đổi. Tải lại trang rồi thử lại.",
};

function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? (ERROR_MESSAGE[error.code] ?? "Không lưu được. Thử lại sau ít phút.")
    : "Không lưu được. Thử lại sau ít phút.";
}

type Draft =
  | { kind: "section"; id?: string; title: string }
  | { kind: "lesson"; sectionId: string; title: string };

export function CurriculumEditor({ course }: { course: AdminCourseDetail }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  function open(next: Draft) {
    setDraft(next);
    setError(null);
    dialog.current?.showModal();
  }

  async function run(action: () => Promise<unknown>, done: string) {
    setError(null);
    try {
      await action();
      dialog.current?.close();
      showToast(done, "success");
      startTransition(() => router.refresh());
    } catch (caught) {
      setError(messageOf(caught));
    }
  }

  async function save(form: FormData) {
    if (!draft) return;
    const title = String(form.get("title") ?? "").trim();
    if (draft.kind === "section") {
      await run(
        () =>
          apiFetch(
            draft.id
              ? `/admin/sections/${draft.id}`
              : `/admin/courses/${course.id}/sections`,
            { method: draft.id ? "PATCH" : "POST", body: JSON.stringify({ title }) },
          ),
        draft.id ? "Đã lưu chương" : "Đã thêm chương",
      );
      return;
    }
    await run(
      () =>
        apiFetch(`/admin/sections/${draft.sectionId}/lessons`, {
          method: "POST",
          body: JSON.stringify({
            title,
            type: String(form.get("type") ?? "VIDEO") as LessonType,
          }),
        }),
      "Đã thêm bài học",
    );
  }

  async function moveSection(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= course.sections.length) return;
    const order = course.sections.map((section) => section.id);
    [order[index], order[target]] = [order[target], order[index]];
    await run(
      () =>
        apiFetch(`/admin/courses/${course.id}/sections/order`, {
          method: "PUT",
          body: JSON.stringify({ sectionIds: order }),
        }),
      "Đã đổi thứ tự chương",
    );
  }

  async function moveLesson(
    sectionId: string,
    lessonIds: string[],
    index: number,
    direction: -1 | 1,
  ) {
    const target = index + direction;
    if (target < 0 || target >= lessonIds.length) return;
    const order = [...lessonIds];
    [order[index], order[target]] = [order[target], order[index]];
    await run(
      () =>
        apiFetch(`/admin/sections/${sectionId}/lessons/order`, {
          method: "PUT",
          body: JSON.stringify({ lessonIds: order }),
        }),
      "Đã đổi thứ tự bài học",
    );
  }

  const arrowClass =
    "flex size-11 items-center justify-center rounded-md hover:bg-muted disabled:opacity-40";

  return (
    <div className="grid gap-6" aria-busy={busy}>
      {error && <Alert variant="destructive" title={error} />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground">
          {formatNumber(course.sections.length)} chương ·{" "}
          {formatNumber(course.lessonCount)} bài học
        </p>
        <Button onClick={() => open({ kind: "section", title: "" })}>
          <Plus aria-hidden="true" className="size-5" strokeWidth={1.75} />
          Thêm chương
        </Button>
      </div>

      {course.sections.length === 0 ? (
        <EmptyState
          title="Khóa học chưa có chương nào"
          description="Thêm chương đầu tiên rồi đưa bài học vào bên trong."
          action={
            <Button onClick={() => open({ kind: "section", title: "" })}>
              Thêm chương
            </Button>
          }
        />
      ) : (
        <ol className="grid list-none gap-4 p-0">
          {course.sections.map((section, sectionIndex) => {
            const lessonIds = section.lessons.map((lesson) => lesson.id);
            return (
              <li key={section.id} className="panel grid gap-3 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex flex-col">
                    <button
                      type="button"
                      className={arrowClass}
                      onClick={() => moveSection(sectionIndex, -1)}
                      disabled={sectionIndex === 0 || busy}
                      aria-label={`Đưa chương ${section.title} lên trên`}
                    >
                      <ChevronUp aria-hidden="true" className="size-5" strokeWidth={1.75} />
                    </button>
                    <button
                      type="button"
                      className={arrowClass}
                      onClick={() => moveSection(sectionIndex, 1)}
                      disabled={sectionIndex === course.sections.length - 1 || busy}
                      aria-label={`Đưa chương ${section.title} xuống dưới`}
                    >
                      <ChevronDown aria-hidden="true" className="size-5" strokeWidth={1.75} />
                    </button>
                  </div>
                  <h2 className="min-w-0 flex-1 text-xl font-semibold">
                    {section.title}
                  </h2>
                  <button
                    type="button"
                    className={buttonClass("outline")}
                    onClick={() =>
                      open({ kind: "section", id: section.id, title: section.title })
                    }
                  >
                    <Pencil aria-hidden="true" className="size-4" strokeWidth={1.75} />
                    Sửa
                  </button>
                  <button
                    type="button"
                    className={buttonClass("ghost")}
                    disabled={busy}
                    onClick={() =>
                      run(
                        () =>
                          apiFetch(`/admin/sections/${section.id}`, {
                            method: "DELETE",
                          }),
                        "Đã xóa chương",
                      )
                    }
                  >
                    <Trash2 aria-hidden="true" className="size-4" strokeWidth={1.75} />
                    Xóa
                  </button>
                </div>

                <ol className="grid list-none gap-1 p-0">
                  {section.lessons.map((lesson, lessonIndex) => (
                    <li
                      key={lesson.id}
                      className="flex flex-wrap items-center gap-2 rounded-md border border-border px-2 py-1"
                    >
                      <div className="flex flex-col">
                        <button
                          type="button"
                          className={arrowClass}
                          onClick={() =>
                            moveLesson(section.id, lessonIds, lessonIndex, -1)
                          }
                          disabled={lessonIndex === 0 || busy}
                          aria-label={`Đưa bài ${lesson.title} lên trên`}
                        >
                          <ChevronUp aria-hidden="true" className="size-5" strokeWidth={1.75} />
                        </button>
                        <button
                          type="button"
                          className={arrowClass}
                          onClick={() =>
                            moveLesson(section.id, lessonIds, lessonIndex, 1)
                          }
                          disabled={lessonIndex === lessonIds.length - 1 || busy}
                          aria-label={`Đưa bài ${lesson.title} xuống dưới`}
                        >
                          <ChevronDown aria-hidden="true" className="size-5" strokeWidth={1.75} />
                        </button>
                      </div>
                      {lesson.type === "VIDEO" ? (
                        <Video aria-hidden="true" className="size-5 text-muted-foreground" strokeWidth={1.75} />
                      ) : (
                        <FileText aria-hidden="true" className="size-5 text-muted-foreground" strokeWidth={1.75} />
                      )}
                      <Link
                        href={`/admin/courses/${course.id}/lessons/${lesson.id}`}
                        className="flex min-h-11 min-w-0 flex-1 items-center underline-offset-2 hover:underline"
                      >
                        {lesson.title}
                      </Link>
                      {lesson.isPreview && <Badge variant="info">Học thử</Badge>}
                      <span className="text-sm text-muted-foreground">
                        {lesson.durationSeconds === 0
                          ? "Bài đọc"
                          : formatDuration(lesson.durationSeconds)}
                      </span>
                      <button
                        type="button"
                        className={buttonClass("ghost")}
                        disabled={busy}
                        onClick={() =>
                          run(
                            () =>
                              apiFetch(`/admin/lessons/${lesson.id}`, {
                                method: "DELETE",
                              }),
                            "Đã xóa bài học",
                          )
                        }
                      >
                        <Trash2 aria-hidden="true" className="size-4" strokeWidth={1.75} />
                        <span className="sr-only">Xóa bài {lesson.title}</span>
                      </button>
                    </li>
                  ))}
                </ol>

                <Button
                  variant="outline"
                  className="w-fit"
                  onClick={() => open({ kind: "lesson", sectionId: section.id, title: "" })}
                >
                  <Plus aria-hidden="true" className="size-5" strokeWidth={1.75} />
                  Thêm bài học
                </Button>
              </li>
            );
          })}
        </ol>
      )}

      <dialog
        ref={dialog}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-border bg-card p-6 text-card-foreground shadow-[var(--shadow-modal)] backdrop:bg-overlay"
        aria-labelledby="curriculum-dialog-title"
      >
        <form className="grid gap-5" action={save} key={JSON.stringify(draft)}>
          <h2 id="curriculum-dialog-title" className="text-xl font-semibold">
            {draft?.kind === "lesson"
              ? "Thêm bài học"
              : draft?.id
                ? "Sửa chương"
                : "Thêm chương"}
          </h2>
          {error && <Alert variant="destructive" title={error} />}
          <Field id="dialog-title" label="Tiêu đề" required>
            <input
              id="dialog-title"
              name="title"
              className="control"
              required
              minLength={1}
              maxLength={160}
              defaultValue={draft?.title ?? ""}
            />
          </Field>
          {draft?.kind === "lesson" && (
            <Field id="dialog-type" label="Loại bài">
              <select id="dialog-type" name="type" className="control" defaultValue="VIDEO">
                <option value="VIDEO">Bài video</option>
                <option value="ARTICLE">Bài đọc</option>
              </select>
            </Field>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => dialog.current?.close()}>
              Hủy
            </Button>
            <Button type="submit">Lưu</Button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
