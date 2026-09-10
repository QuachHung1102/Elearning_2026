import { CourseCreateForm } from "@/components/admin/course-create-form";
import { adminFetch } from "@/lib/admin";
import type { Category } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tạo khóa học" };

export default async function NewCoursePage() {
  const categories = await adminFetch<{ items: Category[] }>(
    "/admin/categories",
  );
  return (
    <div className="grid gap-6">
      <header className="grid gap-1">
        <h1 tabIndex={-1} className="text-3xl font-bold">
          Tạo khóa học
        </h1>
        <p className="text-muted-foreground">
          Chỉ cần tiêu đề. Phần còn lại bổ sung sau khi có bản nháp.
        </p>
      </header>
      <CourseCreateForm categories={categories.items} />
    </div>
  );
}
