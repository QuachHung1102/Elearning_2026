"use client";

import { Paperclip, RefreshCw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import type {
  AdminCourseDetail,
  LessonOutline,
  LessonType,
  Resource,
  VideoAssetStatus,
} from "@/lib/catalog";
import { formatDuration, formatNumber } from "@/lib/format";
import { StatusBadge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { showToast } from "@/components/ui/toast";

const RESOURCE_TYPES = [
  "application/pdf",
  "application/zip",
  "image/png",
  "image/jpeg",
  "text/plain",
];

type VideoAsset = {
  id: string;
  provider: string;
  externalId: string;
  status: VideoAssetStatus;
  durationSeconds: number;
};

type SignedUpload = {
  uploadUrl: string;
  method: string;
  objectKey: string;
  maxBytes: number;
};

function messageOf(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "EXTERNAL_ID_TAKEN")
      return "Video này đã được đăng ký cho một bài khác.";
    if (error.code === "VIDEO_ALREADY_ATTACHED")
      return "Video đang gắn ở bài học khác. Tạo bản ghi video mới nếu muốn dùng lại.";
    if (error.code === "UNSUPPORTED_MEDIA_TYPE")
      return "Định dạng tệp không được phép.";
  }
  return "Không lưu được. Thử lại sau ít phút.";
}

export function LessonEditor({
  course,
  lesson,
  content,
  videoAssetId,
  video,
  resources,
}: {
  course: AdminCourseDetail;
  lesson: LessonOutline;
  content: string | null;
  videoAssetId: string | null;
  video: VideoAsset | null;
  resources: Resource[];
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<LessonType>(lesson.type);
  const [asset, setAsset] = useState<VideoAsset | null>(video);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function save(form: FormData) {
    setBusy("save");
    setError(null);
    try {
      await apiFetch(`/admin/lessons/${lesson.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: String(form.get("title") ?? "").trim(),
          type,
          content: String(form.get("content") ?? ""),
          isPreview: form.get("isPreview") === "on",
          videoAssetId: type === "ARTICLE" ? null : (asset?.id ?? videoAssetId),
        }),
      });
      showToast("Đã lưu bài học", "success");
      router.refresh();
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(null);
    }
  }

  async function attachVideo(externalId: string) {
    setBusy("video");
    setError(null);
    try {
      const created = await apiFetch<VideoAsset>("/admin/videos", {
        method: "POST",
        body: JSON.stringify({ externalId }),
      });
      await apiFetch(`/admin/lessons/${lesson.id}`, {
        method: "PATCH",
        body: JSON.stringify({ videoAssetId: created.id }),
      });
      setAsset(created);
      showToast("Đã gắn video vào bài học", "success");
      router.refresh();
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(null);
    }
  }

  /** Synchronous poll — there is no Cloudflare webhook by design. */
  async function refreshVideo() {
    if (!asset) return;
    setBusy("video");
    try {
      setAsset(await apiFetch<VideoAsset>(`/admin/videos/${asset.id}`));
      router.refresh();
    } catch {
      setError("Không đọc được trạng thái video.");
    } finally {
      setBusy(null);
    }
  }

  async function uploadResource(file: File) {
    setBusy("resource");
    setError(null);
    try {
      if (!RESOURCE_TYPES.includes(file.type)) {
        setError("Chỉ nhận PDF, ZIP, PNG, JPEG hoặc TXT.");
        return;
      }
      const signed = await apiFetch<SignedUpload>(
        `/admin/lessons/${lesson.id}/resources/upload-url`,
        {
          method: "POST",
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            sizeBytes: file.size,
          }),
        },
      );
      const response = await fetch(signed.uploadUrl, {
        method: signed.method,
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!response.ok) throw new Error(String(response.status));
      await apiFetch(`/admin/lessons/${lesson.id}/resources`, {
        method: "POST",
        body: JSON.stringify({
          objectKey: signed.objectKey,
          filename: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        }),
      });
      showToast("Đã thêm tài liệu", "success");
      router.refresh();
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-10">
      <form action={save} className="grid content-start gap-6">
        {error && <Alert variant="destructive" title={error} />}

        <Field id="title" label="Tiêu đề bài học" required>
          <input
            id="title"
            name="title"
            className="control"
            required
            maxLength={160}
            defaultValue={lesson.title}
          />
        </Field>

        <Field id="type" label="Loại bài">
          <select
            id="type"
            name="type"
            className="control"
            value={type}
            onChange={(event) => setType(event.target.value as LessonType)}
          >
            <option value="VIDEO">Bài video</option>
            <option value="ARTICLE">Bài đọc</option>
          </select>
        </Field>

        <Field
          id="content"
          label="Nội dung"
          hint={
            type === "ARTICLE"
              ? "Bắt buộc với bài đọc. Viết bằng Markdown."
              : "Ghi chú kèm theo video. Không bắt buộc."
          }
        >
          <textarea
            id="content"
            name="content"
            className="control min-h-64 font-mono text-sm"
            maxLength={50000}
            defaultValue={content ?? ""}
          />
        </Field>

        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            name="isPreview"
            defaultChecked={lesson.isPreview}
            className="size-5 accent-primary-strong"
          />
          <span className="font-semibold">Cho học thử</span>
          <span className="text-sm text-muted-foreground">
            Bài học thử mở cho mọi tài khoản đã đăng nhập.
          </span>
        </label>

        <div className="sticky bottom-0 -mx-4 flex min-h-16 items-center gap-3 border-t border-border bg-card px-4 py-3">
          <Button type="submit" loading={busy === "save"}>
            Lưu bài học
          </Button>
          <a
            href={`/admin/courses/${course.id}/curriculum`}
            className={buttonClass("ghost")}
          >
            Về chương trình học
          </a>
        </div>
      </form>

      <aside className="grid h-fit content-start gap-6">
        <section className="panel grid gap-3 p-5">
          <h2 className="text-xl font-semibold">Video</h2>
          {type === "ARTICLE" ? (
            <p className="text-sm text-muted-foreground">
              Bài đọc không gắn video. Thời lượng luôn là 0.
            </p>
          ) : asset ? (
            <>
              <p className="break-all font-mono text-sm">{asset.externalId}</p>
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <StatusBadge status={asset.status} />
                <span className="text-muted-foreground">
                  {formatDuration(asset.durationSeconds)}
                </span>
              </p>
              <Button
                variant="outline"
                className="w-fit"
                loading={busy === "video"}
                onClick={refreshVideo}
              >
                <RefreshCw aria-hidden="true" className="size-4" strokeWidth={1.75} />
                Kiểm tra lại trạng thái
              </Button>
            </>
          ) : (
            <form
              className="grid gap-3"
              action={(form) =>
                attachVideo(String(form.get("externalId") ?? "").trim())
              }
            >
              <Field
                id="externalId"
                label="Mã video"
                hint="Ở chế độ demo, dán một mã dạng demo/c1-s1-l1."
              >
                <input
                  id="externalId"
                  name="externalId"
                  className="control"
                  required
                  maxLength={120}
                />
              </Field>
              <Button type="submit" className="w-fit" loading={busy === "video"}>
                Gắn video
              </Button>
            </form>
          )}
        </section>

        <section className="panel grid gap-3 p-5">
          <h2 className="text-xl font-semibold">Tài liệu</h2>
          {resources.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Chưa có tài liệu nào.
            </p>
          ) : (
            <ul className="grid list-none gap-2 p-0">
              {resources.map((resource) => (
                <li
                  key={resource.id}
                  className="flex items-center gap-2 rounded-md border border-border px-2 py-1 text-sm"
                >
                  <Paperclip aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.75} />
                  <span className="min-w-0 flex-1 truncate">
                    {resource.filename}
                  </span>
                  <span className="text-muted-foreground">
                    {formatNumber(Math.round(resource.sizeBytes / 1024))} KB
                  </span>
                  <button
                    type="button"
                    className={buttonClass("ghost", "sm")}
                    onClick={async () => {
                      await apiFetch(`/admin/resources/${resource.id}`, {
                        method: "DELETE",
                      });
                      showToast("Đã xóa tài liệu", "success");
                      router.refresh();
                    }}
                  >
                    <Trash2 aria-hidden="true" className="size-4" strokeWidth={1.75} />
                    <span className="sr-only">Xóa {resource.filename}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <input
            ref={fileInput}
            id="resource"
            type="file"
            accept={RESOURCE_TYPES.join(",")}
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) uploadResource(file);
            }}
          />
          <label
            htmlFor="resource"
            className={buttonClass("outline", "md", "w-fit cursor-pointer")}
          >
            <Paperclip aria-hidden="true" className="size-4" strokeWidth={1.75} />
            Thêm tài liệu
          </label>
          <p className="text-sm text-muted-foreground">
            PDF, ZIP, PNG, JPEG hoặc TXT.
          </p>
        </section>
      </aside>
    </div>
  );
}
