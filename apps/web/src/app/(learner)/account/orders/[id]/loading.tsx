import { Skeleton } from "@/components/ui/feedback";

export default function Loading() {
  return (
    <div className="grid gap-8" aria-busy="true">
      <span className="sr-only">Đang tải…</span>
      <Skeleton className="h-5 w-56" />
      <Skeleton className="h-11 w-64" />
      <div aria-hidden="true" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-10">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}
