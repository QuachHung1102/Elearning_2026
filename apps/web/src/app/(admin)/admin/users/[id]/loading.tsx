import { Skeleton } from "@/components/ui/feedback";

/**
 * Heights measured on the real page for a seeded user with two enrollments:
 * the block button wraps under the name and the tiles stack below 640px, and
 * the enrollments become cards below 768px.
 */
export default function Loading() {
  return (
    <div className="grid gap-8" aria-busy="true">
      <span className="sr-only">Đang tải…</span>
      <Skeleton className="h-[13.625rem] w-full max-w-xl sm:h-[9.875rem]" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-[6.625rem]" />
        <Skeleton className="h-[6.625rem]" />
      </div>
      <div className="grid gap-4">
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="hidden h-[10.625rem] md:block" />
        <div className="grid gap-3 md:hidden">
          <Skeleton className="h-[8.875rem] sm:h-[8.375rem]" />
          <Skeleton className="h-[8.875rem] sm:h-[8.375rem]" />
        </div>
      </div>
    </div>
  );
}
