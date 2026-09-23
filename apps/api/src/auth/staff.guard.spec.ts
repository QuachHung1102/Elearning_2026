import { NotFoundException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuthService } from './auth.service.js';
import { StaffAccess, StaffGuard, type StaffAccessKind } from './staff.guard.js';

const OWN = '11111111-1111-4111-8111-111111111111';
const COURSE = '22222222-2222-4222-8222-222222222222';

function build(opts: {
  role?: UserRole;
  kind?: StaffAccessKind;
  id?: string;
  instructorId?: string | null;
}) {
  class Target {
    handler() {}
  }
  if (opts.kind) StaffAccess(opts.kind)(Target.prototype, 'handler', Object.getOwnPropertyDescriptor(Target.prototype, 'handler')!);
  const request = {
    cookies: { elearning_session: 'token' },
    params: { id: opts.id ?? COURSE },
  };
  const auth = opts.role ? { user: { id: OWN, role: opts.role }, sessionId: 's' } : null;
  const found = opts.instructorId === undefined ? null : { instructorId: opts.instructorId };
  const prisma = {
    course: { findUnique: vi.fn().mockResolvedValue(found) },
    section: { findUnique: vi.fn().mockResolvedValue(found && { course: found }) },
    lesson: { findUnique: vi.fn().mockResolvedValue(found && { section: { course: found } }) },
    lessonResource: { findUnique: vi.fn().mockResolvedValue(found && { lesson: { section: { course: found } } }) },
  };
  const guard = new StaffGuard(
    { authenticate: vi.fn().mockResolvedValue(auth) } as unknown as AuthService,
    prisma as unknown as PrismaService,
    new Reflector(),
  );
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => Target.prototype.handler,
    getClass: () => Target,
  } as unknown as ExecutionContext;
  return { guard, context, request, prisma };
}

describe('StaffGuard', () => {
  it('hides staff routes from anonymous and students', async () => {
    for (const role of [undefined, UserRole.STUDENT]) {
      const { guard, context } = build({ role, kind: 'scoped' });
      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(NotFoundException);
    }
  });

  it('lets an admin through untagged handlers', async () => {
    const { guard, context, request } = build({ role: UserRole.ADMIN });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request).toHaveProperty('auth');
  });

  it('denies an instructor on untagged (admin-only) handlers', async () => {
    const { guard, context } = build({ role: UserRole.INSTRUCTOR });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows an instructor on scoped handlers without a lookup', async () => {
    const { guard, context, prisma } = build({ role: UserRole.INSTRUCTOR, kind: 'scoped' });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(prisma.course.findUnique).not.toHaveBeenCalled();
  });

  it.each(['course', 'section', 'lesson', 'resource'] as const)(
    'allows an instructor on their own %s',
    async (kind) => {
      const { guard, context } = build({ role: UserRole.INSTRUCTOR, kind, instructorId: OWN });
      await expect(guard.canActivate(context)).resolves.toBe(true);
    },
  );

  it.each([
    ['someone else', '33333333-3333-4333-8333-333333333333'],
    ['the site owner (null)', null],
  ])('404s an instructor on a course owned by %s', async (_n, instructorId) => {
    const { guard, context } = build({ role: UserRole.INSTRUCTOR, kind: 'course', instructorId });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('404s an instructor on a missing entity', async () => {
    const { guard, context } = build({ role: UserRole.INSTRUCTOR, kind: 'lesson' });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lower-cases the id before the lookup', async () => {
    const { guard, context, prisma } = build({
      role: UserRole.INSTRUCTOR,
      kind: 'course',
      id: COURSE.toUpperCase(),
      instructorId: OWN,
    });
    await guard.canActivate(context);
    expect(prisma.course.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: COURSE } }),
    );
  });

  it('leaves a malformed id to ParseUUIDPipe (no lookup, passes)', async () => {
    const { guard, context, prisma } = build({ role: UserRole.INSTRUCTOR, kind: 'course', id: 'nope' });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(prisma.course.findUnique).not.toHaveBeenCalled();
  });
});
