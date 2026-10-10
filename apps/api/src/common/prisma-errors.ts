import { Prisma } from '../generated/prisma/client.js';

/**
 * A unique violation on a `slug` column: another writer took the slug between
 * the read that said it was free and the insert. The pg adapter names the
 * constraint (`courses_slug_key`), Prisma's own engine lists `target`; the word
 * is in the error's `meta` either way.
 */
export function isSlugConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    JSON.stringify(error.meta ?? {}).includes('slug')
  );
}
