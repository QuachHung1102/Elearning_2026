import { CourseForm } from "@/components/admin/course-form";
import { adminFetch, getAdminCourse, type AdminUserRow } from "@/lib/admin";
import type { Category } from "@/lib/catalog";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Thông tin khóa học" };

export default async function CourseGeneralPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const isAdmin = (await getSession())?.role === "ADMIN";
  const [course, categories, instructors] = await Promise.all([
    getAdminCourse(id),
    adminFetch<{ items: Category[] }>("/admin/categories"),
    // The owner picker is the admin's alone. ponytail: the first 100
    // instructors by email; a searchable picker replaces it past that.
    isAdmin
      ? adminFetch<{ items: AdminUserRow[] }>(
          "/admin/users?role=INSTRUCTOR&sort=email:asc&pageSize=100",
        )
      : undefined,
  ]);
  return (
    <CourseForm
      course={course}
      categories={categories.items}
      instructors={instructors?.items.map(({ id, displayName, email }) => ({
        id,
        displayName,
        email,
      }))}
    />
  );
}
