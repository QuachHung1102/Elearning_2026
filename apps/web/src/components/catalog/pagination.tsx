import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { formatNumber } from "@/lib/format";

function href(
  basePath: string,
  query: Record<string, string | string[] | undefined>,
  page: number,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || key === "page") continue;
    for (const entry of Array.isArray(value) ? value : [value]) {
      if (entry) params.append(key, entry);
    }
  }
  if (page > 1) params.set("page", String(page));
  const serialised = params.toString();
  return serialised ? `${basePath}?${serialised}` : basePath;
}

/** Plain links: shareable, crawlable, and keyboard-navigable without any script. */
export function Pagination({
  basePath,
  query,
  page,
  totalPages,
  total,
  noun = "khóa học",
}: {
  basePath: string;
  query: Record<string, string | string[] | undefined>;
  page: number;
  totalPages: number;
  total: number;
  /** What `total` counts. */
  noun?: string;
}) {
  if (totalPages <= 1) return null;
  const window = [page - 1, page, page + 1].filter(
    (candidate) => candidate >= 1 && candidate <= totalPages,
  );
  const linkClass =
    "inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-border px-3 text-sm font-medium hover:border-primary hover:text-primary-text";

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-4"
      aria-label="Phân trang"
    >
      <p className="text-sm text-muted-foreground">
        Trang {formatNumber(page)} trên {formatNumber(totalPages)} ·{" "}
        {formatNumber(total)} {noun}
      </p>
      <ul className="flex list-none items-center gap-2 p-0">
        {page > 1 && (
          <li>
            <Link
              className={linkClass}
              href={href(basePath, query, page - 1)}
              rel="prev"
            >
              <ChevronLeft
                aria-hidden="true"
                className="size-5"
                strokeWidth={1.75}
              />
              <span className="sr-only">Trang trước</span>
            </Link>
          </li>
        )}
        {window[0] > 1 && (
          <li aria-hidden="true" className="px-1 text-muted-foreground">
            …
          </li>
        )}
        {window.map((candidate) => (
          <li key={candidate}>
            <Link
              className={`${linkClass} ${candidate === page ? "border-primary bg-primary-subtle text-primary-on-subtle" : ""}`}
              href={href(basePath, query, candidate)}
              aria-current={candidate === page ? "page" : undefined}
            >
              {formatNumber(candidate)}
            </Link>
          </li>
        ))}
        {window[window.length - 1] < totalPages && (
          <li aria-hidden="true" className="px-1 text-muted-foreground">
            …
          </li>
        )}
        {page < totalPages && (
          <li>
            <Link
              className={linkClass}
              href={href(basePath, query, page + 1)}
              rel="next"
            >
              <ChevronRight
                aria-hidden="true"
                className="size-5"
                strokeWidth={1.75}
              />
              <span className="sr-only">Trang sau</span>
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}
