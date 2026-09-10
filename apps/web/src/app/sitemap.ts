import type { MetadataRoute } from "next";
import { publicFetch, type Category, type CourseCard, type Paginated } from "@/lib/catalog";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);

/** Only PUBLISHED courses reach the API, so archived ones drop out on their own. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [courses, categories] = await Promise.all([
    publicFetch<Paginated<CourseCard>>("/courses?pageSize=100"),
    publicFetch<{ items: Category[] }>("/categories"),
  ]);

  const staticPages = ["", "/courses", "/about", "/contact"].map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.7,
  }));

  return [
    ...staticPages,
    ...categories.items.map((category) => ({
      url: `${SITE_URL}/categories/${category.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...courses.items.map((course) => ({
      url: `${SITE_URL}/courses/${course.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
