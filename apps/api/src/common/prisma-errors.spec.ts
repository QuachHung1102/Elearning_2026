import { Prisma } from '../generated/prisma/client.js';
import { isSlugConflict } from './prisma-errors.js';

const unique = (meta?: Record<string, unknown>) =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    ...(meta ? { meta } : {}),
  });

describe('isSlugConflict', () => {
  it.each([
    ['a course, through the pg adapter', { driverAdapterError: { cause: { constraint: { index: 'courses_slug_key' } } } }],
    ['a category, through the pg adapter', { driverAdapterError: { cause: { constraint: { index: 'categories_slug_key' } } } }],
    ["Prisma's own engine", { target: ['slug'] }],
  ])('is true for a unique violation on %s', (_label, meta) => {
    expect(isSlugConflict(unique(meta))).toBe(true);
  });

  it('is false for a unique violation on another column', () => {
    expect(isSlugConflict(unique({ driverAdapterError: { cause: { constraint: { index: 'users_email_key' } } } }))).toBe(false);
    expect(isSlugConflict(unique({ target: ['email'] }))).toBe(false);
    expect(isSlugConflict(unique())).toBe(false);
  });

  it('is false for another kind of Prisma error, even one that mentions a slug', () => {
    const missing = new Prisma.PrismaClientKnownRequestError('Record to update not found', {
      code: 'P2025',
      clientVersion: 'test',
      meta: { target: ['slug'] },
    });

    expect(isSlugConflict(missing)).toBe(false);
  });

  it('is false for anything that is not a Prisma error', () => {
    expect(isSlugConflict(new Error('slug'))).toBe(false);
    expect(isSlugConflict(undefined)).toBe(false);
    expect(isSlugConflict('P2002 slug')).toBe(false);
  });
});
