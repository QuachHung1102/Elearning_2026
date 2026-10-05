import { CurriculumEditor } from "@/components/admin/curriculum-editor";
import { getAdminCourse, staffBase } from "@/lib/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chương trình học" };

export default async function CurriculumPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [course, base] = await Promise.all([getAdminCourse(id), staffBase()]);
  return <CurriculumEditor course={course} base={base} />;
}
