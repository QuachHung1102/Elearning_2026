import courses from "@/content/project-courses.json";
import type { Locale } from "./translations";

export type ProjectCourse = {
  slug: string;
  title: Record<Locale, string>;
  subtitle: Record<Locale, string>;
  theme: string;
  symbol: string;
  coverLabel: string;
  kind: "project";
  priceVnd: number;
  availability: "available" | "planned";
  publicTrial: boolean;
  delivery: Record<Locale, string>;
  lessons: {
    title: string;
    file: string;
    video?: string;
    durationSeconds?: number;
  }[];
  downloads: string[];
  outcomes: string[];
  requirements: string[];
  milestones?: string[];
  deliverables?: Record<Locale, string[]>;
};

/** The API owns prices/access. This manifest also defines the explicitly public book trial. */
export const projectCourses = courses as ProjectCourse[];
export function projectCourse(slug?: string) {
  return projectCourses.find((course) => course.slug === slug);
}
export function projectCopy(slug: string, locale: Locale) {
  const project = projectCourse(slug);
  return project
    ? { title: project.title[locale], subtitle: project.subtitle[locale] }
    : null;
}
