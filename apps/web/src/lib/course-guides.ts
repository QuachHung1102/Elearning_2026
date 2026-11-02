import guides from "@/content/course-guides.json";
import type { Locale } from "./translations";

/** Public course previews only. Full lesson bodies remain behind API access checks. */
export type CourseGuide = {
  introduction: string[];
  whyThisProject: string[];
  outcomes: string[];
  requirements: string[];
  audience: string[];
  projectBrief: string;
  scenario: string;
  deliverables: string[];
  chapters: { title: string; summary: string; topics: string[] }[];
  practice: { prompt: string; questions: string[] };
  scope: string;
  extensions: string[];
  faq: { question: string; answer: string }[];
};

export const courseGuides = guides as Record<
  string,
  Record<Locale, CourseGuide>
>;

export function courseGuide(slug: string, locale: Locale): CourseGuide | null {
  return courseGuides[slug]?.[locale] ?? null;
}
