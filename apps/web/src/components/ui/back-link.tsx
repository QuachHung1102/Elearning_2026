import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/** The "back to the list" link above a detail page's title. */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 w-fit items-center gap-1.5 text-sm text-primary-text hover:underline"
    >
      <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.75} />
      {children}
    </Link>
  );
}
