import { Skeleton } from "@/components/ui/feedback";

export default function Loading() {
  return (
    <div className="page-shell grid gap-8 py-10 lg:py-14" aria-busy="true">
      <span className="sr-only">Đang tải…</span>
      <Skeleton className="h-5 w-72" />
      <Skeleton className="h-11 w-56" />
      <div aria-hidden="true" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-10">
        <Skeleton className="h-[26rem]" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}
