import type { MetadataRoute } from "next";
import { publicFetch, type Category, type CourseCard, type Paginated } from "@/lib/catalog";
import { collectPages } from "@/lib/pagination";
import { SITE_URL } from "@/lib/site";

// A sitemap route is cached from build time unless it opts out, and building
// must not need the API.
export const dynamic = "force-dynamic";

/** Only PUBLISHED courses reach the API, so archived ones drop out on their own. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [courses, categories] = await Promise.all([
    // Every page: a catalog past 100 courses must not silently drop the rest.
    collectPages((page) =>
      publicFetch<Paginated<CourseCard>>(`/courses?pageSize=100&page=${page}`),
    ),
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
    ...courses.map((course) => ({
      url: `${SITE_URL}/courses/${course.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
