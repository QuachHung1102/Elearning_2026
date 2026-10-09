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
import type { StaffBase } from "@/lib/admin";
import { apiFetch, errorMessage } from "@/lib/api";
import type {
  AdminCourseDetail,
  LessonOutline,
  LessonType,
  VideoAssetStatus,
} from "@/lib/catalog";
import { formatDuration, formatNumber, STATUS_LABEL } from "@/lib/format";
import { Button, buttonClass } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { showToast } from "@/components/ui/toast";

/** "Sẵn sàng · 3 phút · Học thử": the video column of a lesson row. */
function lessonStatus(
  lesson: LessonOutline,
  video: VideoAssetStatus | undefined,
): string {
  const parts =
    lesson.type === "ARTICLE"
      ? ["Bài đọc"]
      : video
        ? [STATUS_LABEL[video]]
        : ["Chưa gắn video"];
  if (video === "READY" && lesson.durationSeconds > 0) {
    parts.push(formatDuration(lesson.durationSeconds));
  }
  if (lesson.isPreview) parts.push("Học thử");
  return parts.join(" · ");
}

type Draft =
  | { kind: "section"; id?: string; title: string }
  | { kind: "lesson"; sectionId: string; title: string };

export function CurriculumEditor({
  course,
  base = "/admin",
}: {
  course: AdminCourseDetail;
  base?: StaffBase;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  function open(next: Draft) {
    setDraft(next);
    setError(null);
    dialog.current?.showModal();
    // The re-keyed form remounts after showModal and takes the focused field
    // with it, leaving focus on <body> (WCAG 2.4.3): focus the new one.
    requestAnimationFrame(() =>
      dialog.current?.querySelector<HTMLElement>("input")?.focus(),
    );
  }

  async function run(action: () => Promise<unknown>, done: string) {
    setError(null);
    try {
      await action();
      dialog.current?.close();
      showToast(done, "success");
      startTransition(() => router.refresh());
    } catch (caught) {
      setError(errorMessage(caught));
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

  const videoStatus = new Map(
    course.videoAssets.map((asset) => [asset.lessonId, asset.status]),
  );

  const arrowClass =
    "flex size-11 items-center justify-center rounded-md hover:bg-muted disabled:opacity-40";

  return (
    <div className="grid gap-6" aria-busy={busy}>
      {error && <Alert variant="destructive" title={error} />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1">
          <p className="font-semibold">
            {formatNumber(course.sections.length)} chương ·{" "}
            {formatNumber(course.lessonCount)} bài học
          </p>
          <p className="text-sm text-muted-foreground">
            Dùng nút lên/xuống để đổi thứ tự.
          </p>
        </div>
        <Button
          className="w-full sm:w-auto"
          onClick={() => open({ kind: "section", title: "" })}
        >
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
              <li key={section.id} className="panel grid gap-4 p-4 sm:p-6">
                <div className="flex items-center gap-3">
                  <h2 className="min-w-0 flex-1 text-xl font-semibold [overflow-wrap:anywhere]">
                    {section.title}
                  </h2>
                  <div className="flex shrink-0">
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
                </div>

                {section.lessons.length > 0 && (
                  <div className="grid overflow-clip rounded-lg border border-border">
                    {/* Column labels for sighted users from 768px. The video
                        cell names itself for screen readers and the stacked
                        layout; the action buttons have their own labels. */}
                    <div
                      aria-hidden="true"
                      className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_auto] gap-4 bg-muted px-4 py-3 text-sm font-semibold text-muted-foreground-strong md:grid"
                    >
                      <span>Bài học</span>
                      <span>Video</span>
                      <span className="w-[8.75rem]">Thao tác</span>
                    </div>
                    <ol className="grid list-none p-0">
                      {section.lessons.map((lesson, lessonIndex) => (
                        <li
                          key={lesson.id}
                          className="grid gap-1 border-t border-border px-4 py-2 first:border-t-0 md:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_auto] md:items-center md:gap-4 md:first:border-t"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            {lesson.type === "VIDEO" ? (
                              <Video aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                            ) : (
                              <FileText aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                            )}
                            <Link
                              href={`${base}/courses/${course.id}/lessons/${lesson.id}`}
                              className="flex min-h-11 min-w-0 items-center font-medium underline-offset-2 [overflow-wrap:anywhere] hover:underline"
                            >
                              {lesson.title}
                            </Link>
                          </div>
                          <p className="text-sm text-muted-foreground-strong">
                            <span className="md:sr-only">Video: </span>
                            {lessonStatus(lesson, videoStatus.get(lesson.id))}
                          </p>
                          <div className="flex items-center md:w-[8.75rem]">
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
                            <ConfirmDialog
                              title="Xóa bài học"
                              description={`Xóa bài "${lesson.title}"? Nội dung, tài liệu đính kèm và tiến độ học của bài này sẽ mất. Không hoàn tác được.`}
                              confirmLabel="Xóa bài học"
                              onConfirm={async () => {
                                await apiFetch(`/admin/lessons/${lesson.id}`, {
                                  method: "DELETE",
                                });
                                showToast("Đã xóa bài học", "success");
                                startTransition(() => router.refresh());
                              }}
                              trigger={
                                <button
                                  type="button"
                                  className={buttonClass("ghost", "md", "px-3")}
                                  disabled={busy}
                                >
                                  <Trash2 aria-hidden="true" className="size-4" strokeWidth={1.75} />
                                  <span className="sr-only">Xóa bài {lesson.title}</span>
                                </button>
                              }
                            />
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-3">
                  <Button
                    variant="outline"
                    onClick={() => open({ kind: "lesson", sectionId: section.id, title: "" })}
                  >
                    <Plus aria-hidden="true" className="size-5" strokeWidth={1.75} />
                    Thêm bài học
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      open({ kind: "section", id: section.id, title: section.title })
                    }
                  >
                    <Pencil aria-hidden="true" className="size-4" strokeWidth={1.75} />
                    Sửa chương
                  </Button>
                  <ConfirmDialog
                    title="Xóa chương"
                    description={`Xóa chương "${section.title}"? Chương phải không còn bài học nào. Không hoàn tác được.`}
                    confirmLabel="Xóa chương"
                    onConfirm={async () => {
                      await apiFetch(`/admin/sections/${section.id}`, {
                        method: "DELETE",
                      });
                      showToast("Đã xóa chương", "success");
                      startTransition(() => router.refresh());
                    }}
                    trigger={
                      <Button variant="outline" className="w-full" disabled={busy}>
                        <Trash2 aria-hidden="true" className="size-4" strokeWidth={1.75} />
                        Xóa chương
                      </Button>
                    }
                  />
                </div>
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
