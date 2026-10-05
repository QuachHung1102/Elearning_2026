"use client";

import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { apiFetch, errorMessage } from "@/lib/api";
import type { Category } from "@/lib/catalog";
import { formatNumber } from "@/lib/format";
import { Button, buttonClass } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { showToast } from "@/components/ui/toast";

export function CategoryManager({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [editing, setEditing] = useState<Category | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  function open(category: Category | null) {
    setEditing(category);
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
      setError(errorMessage(caught));
    }
  }

  async function save(form: FormData) {
    const body = {
      name: String(form.get("name") ?? "").trim(),
      slug: String(form.get("slug") ?? "").trim() || undefined,
      description: String(form.get("description") ?? "").trim() || undefined,
      icon: String(form.get("icon") ?? "").trim() || undefined,
    };
    await run(
      () =>
        apiFetch(
          editing ? `/admin/categories/${editing.id}` : "/admin/categories",
          { method: editing ? "PATCH" : "POST", body: JSON.stringify(body) },
        ),
      editing ? "Đã lưu danh mục" : "Đã tạo danh mục",
    );
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= categories.length) return;
    const order = categories.map((category) => category.id);
    [order[index], order[target]] = [order[target], order[index]];
    await run(
      () =>
        apiFetch("/admin/categories/order", {
          method: "PUT",
          body: JSON.stringify({ categoryIds: order }),
        }),
      "Đã đổi thứ tự",
    );
  }

  async function remove(category: Category) {
    await run(
      () =>
        apiFetch(`/admin/categories/${category.id}`, { method: "DELETE" }),
      "Đã xóa danh mục",
    );
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground">
          {formatNumber(categories.length)} danh mục
        </p>
        <Button onClick={() => open(null)}>
          <Plus aria-hidden="true" className="size-5" strokeWidth={1.75} />
          Thêm danh mục
        </Button>
      </div>

      {categories.length === 0 ? (
        <EmptyState
          title="Chưa có danh mục nào"
          description="Tạo danh mục đầu tiên để phân loại khóa học."
          action={<Button onClick={() => open(null)}>Thêm danh mục</Button>}
        />
      ) : (
        <ul className="grid list-none gap-2 p-0" aria-busy={busy}>
          {categories.map((category, index) => (
            <li
              key={category.id}
              className="panel flex flex-wrap items-center gap-3 p-3"
            >
              {/* Buttons, not drag and drop: a keyboard can press a button. */}
              <div className="flex flex-col">
                <button
                  type="button"
                  className="flex size-11 items-center justify-center rounded-md hover:bg-muted disabled:opacity-40"
                  onClick={() => move(index, -1)}
                  disabled={index === 0 || busy}
                  aria-label={`Đưa ${category.name} lên trên`}
                >
                  <ChevronUp
                    aria-hidden="true"
                    className="size-5"
                    strokeWidth={1.75}
                  />
                </button>
                <button
                  type="button"
                  className="flex size-11 items-center justify-center rounded-md hover:bg-muted disabled:opacity-40"
                  onClick={() => move(index, 1)}
                  disabled={index === categories.length - 1 || busy}
                  aria-label={`Đưa ${category.name} xuống dưới`}
                >
                  <ChevronDown
                    aria-hidden="true"
                    className="size-5"
                    strokeWidth={1.75}
                  />
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{category.name}</p>
                <p className="truncate text-sm text-muted-foreground">
                  /{category.slug} · {formatNumber(category.courseCount)} khóa
                  học
                </p>
              </div>
              <button
                type="button"
                className={buttonClass("outline")}
                onClick={() => open(category)}
              >
                <Pencil aria-hidden="true" className="size-4" strokeWidth={1.75} />
                Sửa
              </button>
              <button
                type="button"
                className={buttonClass("ghost")}
                onClick={() => remove(category)}
                disabled={busy}
              >
                <Trash2 aria-hidden="true" className="size-4" strokeWidth={1.75} />
                Xóa
              </button>
            </li>
          ))}
        </ul>
      )}

      <dialog
        ref={dialog}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-border bg-card p-6 text-card-foreground shadow-[var(--shadow-modal)] backdrop:bg-overlay"
        aria-labelledby="category-dialog-title"
      >
        <form
          className="grid gap-5"
          action={save}
          key={editing?.id ?? "new"}
        >
          <h2 id="category-dialog-title" className="text-xl font-semibold">
            {editing ? "Sửa danh mục" : "Thêm danh mục"}
          </h2>
          {error && <Alert variant="destructive" title={error} />}
          <Field id="category-name" label="Tên danh mục" required>
            <input
              id="category-name"
              name="name"
              className="control"
              required
              minLength={2}
              maxLength={80}
              defaultValue={editing?.name ?? ""}
            />
          </Field>
          <Field
            id="category-slug"
            label="Đường dẫn"
            hint="Bỏ trống để hệ thống tự sinh từ tên."
          >
            <input
              id="category-slug"
              name="slug"
              className="control"
              pattern="[a-z0-9\-]{3,120}"
              defaultValue={editing?.slug ?? ""}
            />
          </Field>
          <Field id="category-icon" label="Tên icon Lucide" hint="Ví dụ: code-xml">
            <input
              id="category-icon"
              name="icon"
              className="control"
              maxLength={40}
              defaultValue={editing?.icon ?? ""}
            />
          </Field>
          <Field id="category-description" label="Mô tả">
            <textarea
              id="category-description"
              name="description"
              className="control min-h-24"
              maxLength={280}
              defaultValue={editing?.description ?? ""}
            />
          </Field>
          <div className="flex flex-wrap justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => dialog.current?.close()}
            >
              Hủy
            </Button>
            <Button type="submit">Lưu</Button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
