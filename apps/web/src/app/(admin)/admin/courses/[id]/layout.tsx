import Link from "next/link";
import type { ReactNode } from "react";
import { StatusBadge } from "@/components/ui/badge";
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
  ];

  return (
    <div className="grid gap-6">
      <header className="grid gap-3">
        <Link
          href={`${base}/courses`}
          className="inline-flex min-h-11 w-fit items-center text-sm text-muted-foreground hover:text-primary-text"
        >
          {base === "/instructor" ? "← Khóa học của tôi" : "← Danh sách khóa học"}
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
