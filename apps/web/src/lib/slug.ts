/**
 * Mirrors `apps/api/src/catalog/slug.ts`. It exists here only to show the
 * admin a live preview while typing; the server always generates the real
 * slug, so the two can never disagree in the database.
 */
export function slugify(title: string, maxLength = 120): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}

/** The slug the API starts from: a result under three characters gets its prefix. */
export function baseSlug(title: string): string {
  const stem = slugify(title);
  return stem.length >= 3 ? stem : ["khoa-hoc", stem].filter(Boolean).join("-");
}
