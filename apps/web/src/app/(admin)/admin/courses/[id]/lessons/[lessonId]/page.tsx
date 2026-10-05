import { LessonEditor } from "@/components/admin/lesson-editor";
import { adminFetch, getAdminCourse, staffBase } from "@/lib/admin";
import type {
  LessonOutline,
  Resource,
  VideoAssetStatus,
} from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const metadata = { title: "Soạn bài học" };

type AdminLesson = LessonOutline & {
  courseId: string;
  sectionTitle: string;
  content: string | null;
  videoAssetId: string | null;
  videoAsset: {
    id: string;
    provider: string;
    externalId: string;
    status: VideoAssetStatus;
    durationSeconds: number;
  } | null;
  resources: Resource[];
};

export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string; lessonId: string }>;
}) {
  const { id, lessonId } = await params;
  const [course, lesson, base] = await Promise.all([
    getAdminCourse(id),
    adminFetch<AdminLesson>(`/admin/lessons/${lessonId}`),
    staffBase(),
  ]);

  return (
    <div className="grid gap-6">
      <p className="text-sm text-muted-foreground">{lesson.sectionTitle}</p>
      <LessonEditor
        course={course}
        lesson={lesson}
        content={lesson.content}
        videoAssetId={lesson.videoAssetId}
        video={lesson.videoAsset}
        resources={lesson.resources}
        base={base}
      />
    </div>
  );
}
