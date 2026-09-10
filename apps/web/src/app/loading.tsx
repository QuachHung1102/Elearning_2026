import { Skeleton } from "@/components/ui/feedback";

export default function Loading() {
  return (
    <div className="page-shell grid gap-6 py-12" aria-busy="true">
      <span className="sr-only">Đang tải…</span>
      <Skeleton className="h-11 w-2/3 max-w-md" />
      <Skeleton className="h-6 w-full max-w-xl" />
      <Skeleton className="h-64 w-full max-w-2xl" />
    </div>
  );
}
