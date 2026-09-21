import { Skeleton } from "@/components/ui/feedback";

/** Same frame as the lesson: 16:9 player, meta, title, six uneven lines. */
export default function LessonLoading() {
  return (
    <div aria-busy="true" className="flex flex-col">
      <span className="sr-only">Đang tải…</span>
      <Skeleton className="aspect-video w-full rounded-none lg:mx-8 lg:mt-6 lg:w-auto lg:max-w-[900px] lg:rounded-lg xl:max-w-[1000px]" />
      <div className="grid gap-4 px-4 pt-6 md:px-6 lg:px-8">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-12 w-60" />
        {["w-full", "w-11/12", "w-4/5", "w-full", "w-2/3", "w-5/6"].map(
          (width, index) => (
            <Skeleton key={index} className={`h-5 ${width}`} />
          ),
        )}
      </div>
    </div>
  );
}
