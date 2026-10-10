"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { StaffBase } from "@/lib/admin";
import { apiFetch, errorMessage } from "@/lib/api";
import type { Category, CourseDetail } from "@/lib/catalog";
import { baseSlug } from "@/lib/slug";
import { Button, buttonClass } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";

export function CourseCreateForm({
  categories,
  base = "/admin",
}: {
  categories: Category[];
  /** Web area the new course opens in; the API path stays `/admin/*`. */
  base?: StaffBase;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function create(form: FormData) {
    setSaving(true);
    setError(null);
    try {
      const course = await apiFetch<CourseDetail>("/admin/courses", {
        method: "POST",
        body: JSON.stringify({
          title: String(form.get("title") ?? "").trim(),
          categoryId: String(form.get("categoryId") ?? "") || undefined,
        }),
      });
      router.push(`${base}/courses/${course.id}`);
    } catch (caught) {
      setError(errorMessage(caught));
      setSaving(false);
    }
  }

  return (
    <form action={create} className="panel grid max-w-2xl gap-6 p-4 sm:p-6">
      {error && <Alert variant="destructive" title={error} />}
      <Field id="title" label="Tiêu đề khóa học" required>
        <input
          id="title"
          name="title"
          className="control"
          required
          minLength={3}
          maxLength={160}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </Field>

      <div className="grid gap-1">
        <p className="text-sm font-semibold">Đường dẫn</p>
        <p className="rounded-md bg-muted px-3 py-2 font-mono text-sm text-muted-foreground-strong">
          /courses/{title.trim() ? baseSlug(title) : "…"}
        </p>
        <p className="text-sm text-muted-foreground">
          Sửa được khi khóa học còn là bản nháp. Sau lần xuất bản đầu tiên,
          đường dẫn khóa lại vĩnh viễn.
        </p>
      </div>

      <Field id="categoryId" label="Danh mục">
        <select id="categoryId" name="categoryId" className="control">
          <option value="">Chọn danh mục</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </Field>

      <Alert variant="info" title="Bắt đầu bằng bản nháp">
        Bạn có thể bổ sung nội dung, giá và ảnh bìa ở bước tiếp theo.
      </Alert>

      <div className="grid gap-4">
        <Button type="submit" size="lg" loading={saving}>
          Tạo bản nháp
        </Button>
        <Link href={`${base}/courses`} className={buttonClass("outline", "lg")}>
          Hủy
        </Link>
      </div>
    </form>
  );
}
