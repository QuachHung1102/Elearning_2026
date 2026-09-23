import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  NotFoundException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isUUID } from 'class-validator';
import type { Request } from 'express';
import { UserRole } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AUTH_COOKIE_NAME } from './auth.constants.js';
import { AuthService } from './auth.service.js';
import type { AuthenticatedRequest } from './session-auth.guard.js';

export type StaffAccessKind = 'course' | 'section' | 'lesson' | 'resource' | 'scoped';

const STAFF_ACCESS = 'staffAccess';

/**
 * Opens a handler to instructors. Untagged handlers under `StaffGuard` stay
 * admin-only (default deny). For an entity kind, `:id` must belong to a course
 * the instructor owns; `scoped` handlers filter by `@OwnerScope()` themselves.
 */
export const StaffAccess = (kind: StaffAccessKind) => SetMetadata(STAFF_ACCESS, kind);

/** `null` for an admin (no filter), the instructor's own id otherwise. */
export const OwnerScope = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | null => {
    const { auth } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return auth.user.role === UserRole.ADMIN ? null : auth.user.id;
  },
);

@Injectable()
export class StaffGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = (request as Request).cookies?.[AUTH_COOKIE_NAME];
    const auth = typeof token === 'string' ? await this.authService.authenticate(token) : null;
    const role = auth?.user.role;
    if (!auth || (role !== UserRole.ADMIN && role !== UserRole.INSTRUCTOR)) {
      throw new NotFoundException();
    }
    request.auth = auth;
    if (role === UserRole.ADMIN) return true;

    const kind = this.reflector.getAllAndOverride<StaffAccessKind | undefined>(STAFF_ACCESS, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!kind) throw new NotFoundException();
    if (kind === 'scoped') return true;

    const raw = (request as Request).params?.id;
    // A misconfigured route with no :id param fails closed.
    if (typeof raw !== 'string') throw new NotFoundException();
    // A malformed id never reaches the database; ParseUUIDPipe answers 400.
    if (!isUUID(raw, '4')) return true;
    const owner = await this.ownerOf(kind, raw.toLowerCase());
    if (owner === undefined || owner !== auth.user.id) throw new NotFoundException();
    return true;
  }

  /** `undefined` = entity missing; `null` = site-owner course. */
  private async ownerOf(kind: Exclude<StaffAccessKind, 'scoped'>, id: string) {
    const course = { select: { instructorId: true } } as const;
    switch (kind) {
      case 'course':
        return (await this.prisma.course.findUnique({ where: { id }, ...course }))?.instructorId;
      case 'section':
        return (await this.prisma.section.findUnique({ where: { id }, select: { course } }))
          ?.course.instructorId;
      case 'lesson':
        return (
          await this.prisma.lesson.findUnique({
            where: { id },
            select: { section: { select: { course } } },
          })
        )?.section.course.instructorId;
      case 'resource':
        return (
          await this.prisma.lessonResource.findUnique({
            where: { id },
            select: { lesson: { select: { section: { select: { course } } } } },
          })
        )?.lesson.section.course.instructorId;
    }
  }
}
