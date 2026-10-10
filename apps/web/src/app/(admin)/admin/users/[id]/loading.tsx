import { Skeleton } from "@/components/ui/feedback";

/**
 * Heights measured on the real page for a seeded user with three enrollments:
 * the actions stack full width below 640px and wrap under the name below
 * 768px, the tiles stay two abreast, and the enrollments become cards below
 * 768px.
 */
export default function Loading() {
  return (
    <div className="grid gap-8" aria-busy="true">
      <span className="sr-only">Đang tải…</span>
      <Skeleton className="h-[22.375rem] w-full max-w-xl sm:h-[15.375rem] md:h-[11.625rem]" />
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <Skeleton className="h-[7.125rem] sm:h-[6.625rem]" />
        <Skeleton className="h-[7.125rem] sm:h-[6.625rem]" />
      </div>
      <div className="grid gap-4">
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="hidden h-[10.625rem] md:block" />
        <div className="grid gap-3 md:hidden">
          <Skeleton className="h-[12.125rem] sm:h-[11.625rem]" />
          <Skeleton className="h-[12.125rem] sm:h-[11.625rem]" />
        </div>
      </div>
    </div>
  );
}
