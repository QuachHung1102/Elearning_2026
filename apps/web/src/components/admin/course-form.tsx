"use client";

import { Check, CircleAlert, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ApiError, apiFetch, errorMessage } from "@/lib/api";
import type {
  AdminCourseDetail,
  Category,
  CourseLevel,
  PublishIssue,
} from "@/lib/catalog";
import { LEVEL_LABEL } from "@/lib/format";
import { Button, buttonClass } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { showToast } from "@/components/ui/toast";
import { contextMessages } from "@/messages/vi";
import { TagListInput } from "./tag-list-input";

/**
 * One Vietnamese line per (field, reason) pair. Both axes are closed lists in
 * API_CONTRACT.md §5.3, so an unknown pair is a bug, not a new feature.
 */
const CHECKLIST: { field: string; reason: string; label: string }[] = [
  { field: "coverImageKey", reason: "MISSING", label: "Chưa có ảnh bìa" },
  { field: "description", reason: "MISSING", label: "Chưa có mô tả khóa học" },
  {
    field: "description",
    reason: "TOO_SHORT",
    label: "Mô tả cần ít nhất 200 ký tự",
  },
  { field: "priceVnd", reason: "MISSING", label: "Chưa đặt giá bán" },
  { field: "categoryId", reason: "MISSING", label: "Chưa chọn danh mục" },
  {
    field: "learningOutcomes",
    reason: "EMPTY",
    label: 'Chưa có mục "Bạn sẽ học được gì"',
  },
  { field: "sections", reason: "EMPTY", label: "Khóa học chưa có chương nào" },
  { field: "lessons", reason: "EMPTY", label: "Có chương chưa có bài học nào" },
  { field: "lessons", reason: "MISSING", label: "Có bài viết chưa có nội dung" },
  { field: "videoAsset", reason: "MISSING", label: "Có bài chưa gắn video" },
  {
    field: "videoAsset",
    reason: "NOT_READY",
    label: "Có video đang được xử lý",
  },
  {
    field: "previewLesson",
    reason: "MISSING",
    label: "Chưa có bài học thử nào",
  },
];

function PublishChecklist({ issues }: { issues: PublishIssue[] }) {
  return (
    <ul className="grid list-none gap-2 p-0">
      {CHECKLIST.map((entry) => {
        const failed = issues.some(
          (issue) =>
            issue.field === entry.field && issue.reason === entry.reason,
        );
        return (
          <li
            key={`${entry.field}-${entry.reason}`}
            className={`flex items-start gap-2 text-sm ${failed ? "text-destructive" : "text-muted-foreground"}`}
          >
            {failed ? (
              <CircleAlert
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
                strokeWidth={1.75}
              />
            ) : (
              <Check
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-success"
                strokeWidth={1.75}
              />
            )}
            {entry.label}
          </li>
        );
      })}
    </ul>
  );
}

type SignedUpload = {
  uploadUrl: string;
  method: string;
  objectKey: string;
  maxBytes: number;
};

export type InstructorOption = { id: string; displayName: string; email: string };

export function CourseForm({
  course,
  categories,
  instructors,
}: {
  course: AdminCourseDetail;
  categories: Category[];
  /** Only an admin gets the owner picker; an instructor sees the owner read-only. */
  instructors?: InstructorOption[];
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [coverUrl, setCoverUrl] = useState(course.coverUrl);
  const [coverKey, setCoverKey] = useState<string | null>(null);
  const [issues, setIssues] = useState<PublishIssue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "publish" | null>(null);

  const locked = course.publishedAt !== null;

  async function uploadCover(file: File) {
    setError(null);
    try {
      const signed = await apiFetch<SignedUpload>(
        `/admin/courses/${course.id}/cover-upload-url`,
        {
          method: "POST",
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            sizeBytes: file.size,
          }),
        },
      );
      if (file.size > signed.maxBytes) {
        setError("Ảnh vượt quá dung lượng cho phép.");
        return;
      }
      // The upload goes straight at the signed URL, exactly like an R2
      // presigned PUT, so this code is identical for both storage drivers.
      const response = await fetch(signed.uploadUrl, {
        method: signed.method,
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!response.ok) throw new Error(String(response.status));
      setCoverKey(signed.objectKey);
      setCoverUrl(URL.createObjectURL(file));
      showToast("Đã tải ảnh bìa lên. Bấm Lưu để áp dụng.", "success");
    } catch {
      setError("Không tải được ảnh bìa. Thử lại sau ít phút.");
    }
  }

  async function save(form: FormData) {
    setBusy("save");
    setError(null);
    const list = (name: string) =>
      String(form.get(name) ?? "")
        .split("\n")
        .map((entry) => entry.trim())
        .filter(Boolean);
    const number = (name: string) => {
      const raw = String(form.get(name) ?? "").trim();
      return raw === "" ? null : Number(raw);
    };
    try {
      await apiFetch(`/admin/courses/${course.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: String(form.get("title") ?? "").trim(),
          ...(locked ? {} : { slug: String(form.get("slug") ?? "").trim() }),
          subtitle: String(form.get("subtitle") ?? "").trim(),
          description: String(form.get("description") ?? ""),
          priceVnd: number("priceVnd") ?? 0,
          compareAtPriceVnd: number("compareAtPriceVnd"),
          level: String(form.get("level") ?? "ALL_LEVELS") as CourseLevel,
          categoryId: String(form.get("categoryId") ?? "") || undefined,
          // Owner: only sent by an admin; the API drops it for an instructor anyway.
          ...(instructors
            ? { instructorId: String(form.get("instructorId") ?? "") || null }
            : {}),
          learningOutcomes: list("learningOutcomes"),
          requirements: list("requirements"),
          targetAudience: list("targetAudience"),
          ...(coverKey ? { coverImageKey: coverKey } : {}),
        }),
      });
      showToast("Đã lưu khóa học", "success");
      router.refresh();
    } catch (caught) {
      setError(
        // PATCH answers a bare CONFLICT only for the locked slug; t() has no
        // wording for CONFLICT on its own.
        caught instanceof ApiError && caught.code === "CONFLICT"
          ? contextMessages.SLUG_LOCKED
          : errorMessage(caught),
      );
    } finally {
      setBusy(null);
    }
  }

  async function transition(action: "publish" | "unpublish", label: string) {
    setBusy("publish");
    setError(null);
    setIssues([]);
    try {
      await apiFetch(`/admin/courses/${course.id}/${action}`, {
        method: "POST",
      });
      showToast(label, "success");
      router.refresh();
    } catch (caught) {
      if (
        caught instanceof ApiError &&
        caught.code === "COURSE_NOT_PUBLISHABLE"
      ) {
        setIssues((caught.details?.issues as PublishIssue[]) ?? []);
        setError(errorMessage(caught));
      } else if (
        caught instanceof ApiError &&
        caught.code === "COURSE_HAS_ENROLLMENTS"
      ) {
        // t() carries the delete wording; this is the unpublish case.
        setError(contextMessages.COURSE_HAS_ENROLLMENTS_UNPUBLISH);
      } else {
        setError(errorMessage(caught));
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem] xl:gap-10">
      <form action={save} className="grid content-start gap-6">
        {error && <Alert variant="destructive" title={error} />}

        <Field id="title" label="Tiêu đề" required>
          <input
            id="title"
            name="title"
            className="control"
            required
            minLength={3}
            maxLength={160}
            defaultValue={course.title}
          />
        </Field>

        <Field
          id="slug"
          label="Đường dẫn"
          hint={
            locked
              ? "Đã khóa sau lần xuất bản đầu tiên để không làm hỏng link đã chia sẻ."
              : "Chỉ chữ thường, số và dấu gạch ngang."
          }
        >
          <input
            id="slug"
            name="slug"
            className="control"
            pattern="[a-z0-9\-]{3,120}"
            defaultValue={course.slug}
            readOnly={locked}
            disabled={locked}
          />
        </Field>

        <Field id="subtitle" label="Dòng mô tả">
          <input
            id="subtitle"
            name="subtitle"
            className="control"
            maxLength={240}
            defaultValue={course.subtitle ?? ""}
          />
        </Field>

        <Field
          id="description"
          label="Mô tả khóa học"
          hint="Viết bằng Markdown. Cần ít nhất 200 ký tự để xuất bản."
        >
          <textarea
            id="description"
            name="description"
            className="control min-h-64 font-mono text-sm"
            maxLength={20000}
            defaultValue={course.description}
          />
        </Field>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field id="priceVnd" label="Giá bán (VND)" required>
            <input
              id="priceVnd"
              name="priceVnd"
              type="number"
              inputMode="numeric"
              min={0}
              max={100000000}
              step={1000}
              className="control"
              defaultValue={course.priceVnd}
            />
          </Field>
          <Field
            id="compareAtPriceVnd"
            label="Giá gạch ngang (VND)"
            hint="Phải lớn hơn giá bán. Bỏ trống nếu không giảm giá."
          >
            <input
              id="compareAtPriceVnd"
              name="compareAtPriceVnd"
              type="number"
              inputMode="numeric"
              min={0}
              step={1000}
              className="control"
              defaultValue={course.compareAtPriceVnd ?? ""}
            />
          </Field>
          <Field id="level" label="Trình độ">
            <select
              id="level"
              name="level"
              className="control"
              defaultValue={course.level}
            >
              {(Object.keys(LEVEL_LABEL) as CourseLevel[]).map((level) => (
                <option key={level} value={level}>
                  {LEVEL_LABEL[level]}
                </option>
              ))}
            </select>
          </Field>
          {instructors ? (
            <Field
              id="instructorId"
              label="Giảng viên phụ trách"
              hint="Người soạn và quản lý khóa này. Chọn Chủ site nếu không có giảng viên."
            >
              <select
                id="instructorId"
                name="instructorId"
                className="control"
                defaultValue={course.instructorId ?? ""}
              >
                <option value="">Chủ site</option>
                {instructors.map((instructor) => (
                  <option key={instructor.id} value={instructor.id}>
                    {instructor.displayName} ({instructor.email})
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Field id="instructorName" label="Giảng viên phụ trách">
              <input
                id="instructorName"
                className="control"
                value={course.instructorName ?? "Chủ site"}
                readOnly
                disabled
              />
            </Field>
          )}
          <Field id="categoryId" label="Danh mục">
            <select
              id="categoryId"
              name="categoryId"
              className="control"
              defaultValue={course.category?.id ?? ""}
            >
              <option value="">Chưa chọn</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <TagListInput
          id="learningOutcomes"
          label="Bạn sẽ học được gì"
          max={12}
          defaultValue={course.learningOutcomes}
        />
        <TagListInput
          id="requirements"
          label="Yêu cầu"
          max={8}
          defaultValue={course.requirements}
        />
        <TagListInput
          id="targetAudience"
          label="Khóa học dành cho ai"
          max={8}
          defaultValue={course.targetAudience}
        />

        <div className="sticky bottom-0 -mx-4 flex min-h-16 flex-wrap items-center gap-3 border-t border-border bg-card px-4 py-3">
          <Button type="submit" loading={busy === "save"}>
            Lưu
          </Button>
          <span className="text-sm text-muted-foreground">
            Lưu trước khi xuất bản để checklist tính trên dữ liệu mới nhất.
          </span>
        </div>
      </form>

      <aside className="grid h-fit content-start gap-6">
        <section className="panel grid gap-3 p-5">
          <h2 className="text-xl font-semibold">Ảnh bìa</h2>
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverUrl}
              alt=""
              className="aspect-video w-full rounded-md object-cover"
            />
          ) : (
            <div className="flex aspect-video items-center justify-center rounded-md bg-muted text-sm text-muted-foreground-strong">
              Chưa có ảnh bìa
            </div>
          )}
          <input
            ref={fileInput}
            id="cover"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) uploadCover(file);
            }}
          />
          <label htmlFor="cover" className={buttonClass("outline", "md", "w-fit cursor-pointer")}>
            <Upload aria-hidden="true" className="size-4" strokeWidth={1.75} />
            Chọn ảnh bìa
          </label>
          <p className="text-sm text-muted-foreground">
            JPG, PNG hoặc WebP. Tỷ lệ 16:9 hiển thị đẹp nhất.
          </p>
        </section>

        <section className="panel grid gap-3 p-5">
          <h2 className="text-xl font-semibold">Điều kiện xuất bản</h2>
          <PublishChecklist issues={issues} />
          <div className="flex flex-wrap gap-2">
            {course.status !== "PUBLISHED" && (
              <Button
                onClick={() => transition("publish", "Đã xuất bản khóa học")}
                loading={busy === "publish"}
              >
                Xuất bản
              </Button>
            )}
            {course.status === "PUBLISHED" && (
              <Button
                variant="outline"
                onClick={() => transition("unpublish", "Đã gỡ xuống bản nháp")}
                loading={busy === "publish"}
              >
                Gỡ xuất bản
              </Button>
            )}
            {course.status === "ARCHIVED" && (
              <Button
                variant="outline"
                onClick={() => transition("unpublish", "Đã bỏ lưu trữ")}
                loading={busy === "publish"}
              >
                Bỏ lưu trữ
              </Button>
            )}
            {/* Only a published course can be archived; a draft is deleted instead. */}
            {course.status === "PUBLISHED" && (
              <ConfirmDialog
                title="Lưu trữ khóa học"
                description="Khóa học biến mất khỏi catalog và không nhận học viên mới. Người đã có quyền học vẫn học bình thường, và bạn có thể bỏ lưu trữ sau."
                confirmLabel="Lưu trữ khóa học"
                onConfirm={async () => {
                  await apiFetch(`/admin/courses/${course.id}/archive`, {
                    method: "POST",
                  });
                  showToast("Đã lưu trữ khóa học", "success");
                  router.refresh();
                }}
                trigger={
                  <Button variant="ghost">
                    <X aria-hidden="true" className="size-4" strokeWidth={1.75} />
                    Lưu trữ
                  </Button>
                }
              />
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Khóa đã lưu trữ biến mất khỏi catalog, nhưng người đã có quyền học
            vẫn học bình thường.
          </p>
        </section>
      </aside>
    </div>
  );
}
