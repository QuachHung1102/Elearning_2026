import type { CourseDetail, CourseLevel } from "./catalog";
import { SITE_OWNER } from "./site";

const LEVEL: Partial<Record<CourseLevel, string>> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
};

/** A Markdown text as the words a person would read, cut at a word to `max` characters. */
export function plainText(markdown: string, max = 200): string {
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#>*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const end = cut.lastIndexOf(" ");
  return `${(end > 0 ? cut.slice(0, end) : cut).trimEnd()}…`;
}

/** ISO 8601 duration in whole minutes, or nothing for a course with no measured length. */
function isoDuration(seconds: number): string | undefined {
  const minutes = Math.floor(seconds / 60);
  if (minutes <= 0) return undefined;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `PT${hours ? `${hours}H` : ""}${rest ? `${rest}M` : ""}`;
}

/**
 * schema.org `Course` for a course page (ROADMAP.md §9). Only what the course
 * really has: no image without a cover, and no rating unless it is a real one,
 * because a seeded demo rating must never reach a search engine.
 */
export function courseJsonLd(
  course: CourseDetail,
  siteUrl: string,
): Record<string, unknown> {
  const url = `${siteUrl}/courses/${course.slug}`;
  const description = course.subtitle || plainText(course.description);
  const timeRequired = isoDuration(course.totalDurationSeconds);
  const level = LEVEL[course.level];
  const realRating =
    !course.demoStats && course.ratingCount > 0 && course.ratingAverage !== null;

  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name: course.title,
    ...(description ? { description } : {}),
    url,
    inLanguage: course.language,
    ...(course.coverUrl ? { image: course.coverUrl } : {}),
    ...(level ? { educationalLevel: level } : {}),
    ...(timeRequired ? { timeRequired } : {}),
    provider: { "@type": "Organization", name: SITE_OWNER.name, sameAs: siteUrl },
    offers: {
      "@type": "Offer",
      price: course.priceVnd,
      priceCurrency: "VND",
      category: course.priceVnd > 0 ? "Paid" : "Free",
      url,
    },
    ...(realRating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: course.ratingAverage,
            ratingCount: course.ratingCount,
          },
        }
      : {}),
  };
}

// `<` would let a title close the script, `&` an entity start; U+2028 and U+2029 end a line
// in a script. Built from char codes: those two do not survive being typed into a source file.
const UNSAFE_IN_SCRIPT = new RegExp(`[<>&${String.fromCharCode(0x2028, 0x2029)}]`, "g");

/**
 * The text of a `<script type="application/ld+json">`. A title that says
 * `</script>` must not close the block, so everything that could is escaped;
 * JSON.parse reads the same value back.
 */
export function jsonLdScript(data: object): string {
  return JSON.stringify(data).replace(
    UNSAFE_IN_SCRIPT,
    (character) =>
      `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}
