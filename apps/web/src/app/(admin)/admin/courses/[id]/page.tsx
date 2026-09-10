import { CourseForm } from "@/components/admin/course-form";
import { adminFetch } from "@/lib/admin";
import type { AdminCourseDetail, Category } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const metadata = { title: "Thông tin khóa học" };

export default async function CourseGeneralPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [course, categories] = await Promise.all([
    adminFetch<AdminCourseDetail>(`/admin/courses/${id}`),
    adminFetch<{ items: Category[] }>("/admin/categories"),
  ]);
  return <CourseForm course={course} categories={categories.items} />;
}
