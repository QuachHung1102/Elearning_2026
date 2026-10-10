import Link from "next/link";
import { CourseCreateForm } from "@/components/admin/course-create-form";
import { adminFetch, staffBase } from "@/lib/admin";
import type { Category } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tạo khóa học" };

export default async function NewCoursePage() {
  const [categories, base] = await Promise.all([
    adminFetch<{ items: Category[] }>("/admin/categories"),
    staffBase(),
  ]);
  return (
    <div className="grid gap-6">
      <header className="grid gap-3">
        <h1 tabIndex={-1} className="text-3xl font-bold">
          Tạo khóa học
        </h1>
        <Link
          href={`${base}/courses`}
          className="inline-flex min-h-11 w-fit items-center text-sm text-primary-text hover:underline"
        >
          {base === "/instructor" ? "← Khóa học của tôi" : "← Danh sách khóa học"}
        </Link>
      </header>
      <CourseCreateForm categories={categories.items} base={base} />
    </div>
  );
}
