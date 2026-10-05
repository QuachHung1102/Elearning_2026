import { notFound } from "next/navigation";
import { API_ORIGIN } from "./site";

export type Category = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  position: number;
  courseCount: number;
};

export type CourseLevel =
  | "BEGINNER"
  | "INTERMEDIATE"
  | "ADVANCED"
  | "ALL_LEVELS";

export type CourseStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type LessonType = "VIDEO" | "ARTICLE";

export type CourseCard = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  coverUrl: string | null;
  priceVnd: number;
  compareAtPriceVnd: number | null;
  level: CourseLevel;
  language: string;
  lessonCount: number;
  totalDurationSeconds: number;
  enrollmentCount: number;
  ratingAverage: number | null;
  ratingCount: number;
  demoStats: boolean;
  category: Category | null;
  /** `null` for a site-owner course; shown with `SITE_OWNER` as the fallback. */
  instructorName: string | null;
};

export type LessonOutline = {
  id: string;
  title: string;
  position: number;
  type: LessonType;
  durationSeconds: number;
  isPreview: boolean;
};

export type SectionOutline = {
  id: string;
  title: string;
  position: number;
  lessons: LessonOutline[];
};

export type CourseDetail = CourseCard & {
  description: string;
  learningOutcomes: string[];
  requirements: string[];
  targetAudience: string[];
  publishedAt: string | null;
  updatedAt: string;
  sections: SectionOutline[];
};

export type AdminCourseRow = CourseCard & {
  status: CourseStatus;
  updatedAt: string;
  instructorId: string | null;
};

export type VideoAssetStatus = "PENDING" | "PROCESSING" | "READY" | "ERRORED";

export type AdminCourseDetail = CourseDetail & {
  status: CourseStatus;
  archivedAt: string | null;
  instructorId: string | null;
  videoAssets: {
    lessonId: string;
    provider: string;
    externalId: string;
    status: VideoAssetStatus;
    durationSeconds: number;
  }[];
};

export type Resource = {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  position: number;
};

export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type PublishIssue = {
  field: string;
  reason: string;
  lessonId?: string;
};

/**
 * Cookie-free fetch for the public catalog. Reading cookies would opt the whole
 * route out of static rendering, and the catalog is deliberately identical for
 * everyone — "already enrolled" is a separate, client-side question.
 */
export async function publicFetch<T>(
  path: string,
  revalidate = 300,
): Promise<T> {
  // ponytail: no `forwardVisitor` here. Headers are part of the data-cache key,
  // so naming the visitor would cache per visitor; the API counts these cache
  // misses (one per URL per `revalidate`) against this server's own bucket.
  // Exempt trusted no-visitor calls in `clientIp` if that bucket ever fills.
  const response = await fetch(`${API_ORIGIN}/api/v1${path}`, {
    next: { revalidate },
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status === 404) notFound();
  if (!response.ok) {
    throw new Error(`API ${path} answered ${response.status}`);
  }
  return (await response.json()) as T;
}

/** Turns Next's `searchParams` into a query string the API accepts verbatim. */
export function toQuery(
  params: Record<string, string | string[] | undefined>,
  allowed: readonly string[],
): string {
  const query = new URLSearchParams();
  for (const key of allowed) {
    const value = params[key];
    if (value === undefined) continue;
    // Repeated keys and comma lists are both accepted by the API, so a plain
    // <form method="get"> works with no client-side rewriting.
    for (const entry of Array.isArray(value) ? value : [value]) {
      if (entry !== "") query.append(key, entry);
    }
  }
  const serialised = query.toString();
  return serialised ? `?${serialised}` : "";
}

export const COURSE_QUERY_KEYS = [
  "q",
  "category",
  "level",
  "priceVndMin",
  "priceVndMax",
  "sort",
  "page",
  "pageSize",
] as const;

/** Reads a search param that may arrive once or many times. */
export function firstValue(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function valueList(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return (Array.isArray(value) ? value : [value]).flatMap((entry) =>
    entry.split(",").filter(Boolean),
  );
}
