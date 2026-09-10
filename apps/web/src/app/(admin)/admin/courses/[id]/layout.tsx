import Link from "next/link";
import type { ReactNode } from "react";
import { StatusBadge } from "@/components/ui/badge";
import { adminFetch } from "@/lib/admin";
import type { AdminCourseDetail } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function CourseLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const course = await adminFetch<AdminCourseDetail>(`/admin/courses/${id}`);

  const tabs = [
    { href: `/admin/courses/${id}`, label: "Thông tin chung" },
    { href: `/admin/courses/${id}/curriculum`, label: "Chương trình học" },
  ];

  return (
    <div className="grid gap-6">
      <header className="grid gap-3">
        <Link
          href="/admin/courses"
          className="text-sm text-muted-foreground hover:text-primary-text"
        >
          ← Danh sách khóa học
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 tabIndex={-1} className="text-3xl font-bold">
            {course.title}
          </h1>
          <StatusBadge status={course.status} />
        </div>
        <nav aria-label="Phần của khóa học" className="flex flex-wrap gap-1">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium hover:bg-muted"
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </header>
      {children}
    </div>
  );
}
