import { CurriculumEditor } from "@/components/admin/curriculum-editor";
import { adminFetch } from "@/lib/admin";
import type { AdminCourseDetail } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chương trình học" };

export default async function CurriculumPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const course = await adminFetch<AdminCourseDetail>(`/admin/courses/${id}`);
  return <CurriculumEditor course={course} />;
}
