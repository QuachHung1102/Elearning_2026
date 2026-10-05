import { normalize } from './search-text.js';

const MIN_LENGTH = 3;
export const SLUG_PATTERN = new RegExp(`^[a-z0-9-]{${MIN_LENGTH},120}$`);

/**
 * Slug rules live in UX_PLAN.md §9.4 and reuse the diacritic stripping of
 * `search-text.ts` so a title and its slug can never disagree about what
 * "Lập trình" means.
 */
export function slugify(title: string, maxLength = 120): string {
  return normalize(title)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
}

/**
 * Server-generated suffix instead of a 409 thrown at an admin mid-typing:
 * `-2`, `-3`, … until `isTaken` says no. `409 SLUG_TAKEN` is then reserved
 * for a slug the admin typed by hand.
 */
export async function uniqueSlug(
  title: string,
  isTaken: (slug: string) => Promise<boolean>,
  maxLength = 120,
): Promise<string> {
  const stem = slugify(title, maxLength);
  // "C++" slugifies to "c", under the pattern minimum: the course would exist
  // but `GET /courses/c` would answer 400.
  const base =
    stem.length >= MIN_LENGTH
      ? stem
      : ['khoa-hoc', stem].filter(Boolean).join('-');
  if (!(await isTaken(base))) return base;
  for (let suffix = 2; suffix < 1_000; suffix += 1) {
    const tail = `-${suffix}`;
    const candidate = `${base.slice(0, maxLength - tail.length).replace(/-+$/g, '')}${tail}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  throw new Error(`Cannot derive a free slug from "${title}"`);
}
