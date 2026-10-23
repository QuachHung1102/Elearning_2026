import type { ReactNode } from "react";
import { StatusBadge } from "@/components/ui/badge";
import { CourseTabs } from "@/components/admin/course-tabs";
import { BackLink } from "@/components/ui/back-link";
import { getAdminCourse, staffBase } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function CourseLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [course, base] = await Promise.all([getAdminCourse(id), staffBase()]);

  const tabs = [
    { href: `${base}/courses/${id}`, label: "Thông tin chung" },
    { href: `${base}/courses/${id}/curriculum`, label: "Chương trình học" },
    // Staff open any course they manage in the player's ADMIN mode.
    { href: `/learn/${course.slug}`, label: "Xem trước" },
  ];

  return (
    <div className="grid gap-6">
      <header className="grid gap-3">
        <BackLink href={`${base}/courses`}>
          {base === "/instructor" ? "Khóa học của tôi" : "Danh sách khóa học"}
        </BackLink>
        <div className="flex flex-wrap items-center gap-3">
          <h1 tabIndex={-1} className="text-3xl font-bold">
            {course.title}
          </h1>
          <StatusBadge status={course.status} />
        </div>
        <CourseTabs tabs={tabs} />
      </header>
      {children}
    </div>
  );
}
