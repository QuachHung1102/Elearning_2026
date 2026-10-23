import { CourseCreateForm } from "@/components/admin/course-create-form";
import { BackLink } from "@/components/ui/back-link";
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
        <BackLink href={`${base}/courses`}>
          {base === "/instructor" ? "Khóa học của tôi" : "Danh sách khóa học"}
        </BackLink>
        <h1 tabIndex={-1} className="text-3xl font-bold">
          Tạo khóa học
        </h1>
      </header>
      <CourseCreateForm categories={categories.items} base={base} />
    </div>
  );
}
