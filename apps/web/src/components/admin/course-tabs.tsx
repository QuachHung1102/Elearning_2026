"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** The course editor's sections, styled like the account tabs with the current one marked. */
export function CourseTabs({ tabs }: { tabs: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Phần của khóa học"
      className="grid auto-cols-fr grid-flow-col border-b border-border md:auto-cols-max md:justify-start md:gap-4"
    >
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={pathname === tab.href ? "page" : undefined}
          className="-mb-px flex min-h-11 items-center justify-center border-b-2 border-transparent px-1 py-2 text-center text-sm text-muted-foreground hover:border-primary hover:text-primary-text aria-[current=page]:border-primary aria-[current=page]:text-primary-text md:px-3"
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
