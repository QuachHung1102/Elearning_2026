import { HttpStatus, Injectable } from '@nestjs/common';
import {
  AuditService,
  type AuditActorContext,
} from '../audit/audit.service.js';
import { ERROR_CODE, appError } from '../common/error-codes.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  assertSameSet,
  LAST_POSITION,
  mustFindCategory,
  nextPosition,
  notFound,
  resolveSlug,
  toCategory,
  writeOrder,
  writeWithSlug,
} from './catalog.shared.js';
import type { CreateCategoryDto, UpdateCategoryDto } from './course.dto.js';

@Injectable()
export class CategoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Public catalog ───────────────────────────────────────────────

  async listCategories() {
    const categories = await this.prisma.category.findMany({
      orderBy: { position: 'asc' },
      include: {
        _count: { select: { courses: { where: { status: 'PUBLISHED' } } } },
      },
    });
    return { items: categories.map((category) => toCategory(category)) };
  }

  async getCategoryBySlug(slug: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      include: {
        _count: { select: { courses: { where: { status: 'PUBLISHED' } } } },
      },
    });
    if (!category) notFound();
    return toCategory(category);
  }

  // ── Admin: categories ────────────────────────────────────────────

  async listCategoriesForAdmin() {
    const categories = await this.prisma.category.findMany({
      orderBy: { position: 'asc' },
      include: { _count: { select: { courses: true } } },
    });
    return { items: categories.map((category) => toCategory(category)) };
  }

  async createCategory(input: CreateCategoryDto, actor: AuditActorContext) {
    return writeWithSlug(
      () =>
        resolveSlug(input.slug, input.name, 80, (value) =>
          this.categorySlugTaken(value),
        ),
      async (slug) =>
        this.prisma.$transaction(async (tx) => {
          // Categories have no parent row to lock, and `position` has no
          // unique index to catch a duplicate: two creates would both read
          // the same last position. A transaction-scoped advisory lock queues
          // category creates only, released at commit or rollback.
          await tx.$executeRaw`
            SELECT pg_advisory_xact_lock(hashtext('categories.position'))`;
          const position = await nextPosition(
            tx.category.findFirst(LAST_POSITION),
          );
          const category = await tx.category.create({
            data: {
              slug,
              name: input.name,
              description: input.description ?? null,
              icon: input.icon ?? null,
              position,
            },
            include: { _count: { select: { courses: true } } },
          });
          await this.audit.record(
            {
              ...actor,
              action: 'category.created',
              entityType: 'CATEGORY',
              entityId: category.id,
              metadata: { slug: category.slug },
            },
            tx,
          );
          return toCategory(category);
        }),
    );
  }

  async updateCategory(
    id: string,
    input: UpdateCategoryDto,
    actor: AuditActorContext,
  ) {
    await mustFindCategory(this.prisma, id);
    if (input.slug && (await this.categorySlugTaken(input.slug, id))) {
      throw appError(
        HttpStatus.CONFLICT,
        ERROR_CODE.SLUG_TAKEN,
        'Slug is already taken',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const category = await tx.category.update({
        where: { id },
        data: {
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.slug === undefined ? {} : { slug: input.slug }),
          ...(input.description === undefined
            ? {}
            : { description: input.description || null }),
          ...(input.icon === undefined ? {} : { icon: input.icon || null }),
        },
        include: { _count: { select: { courses: true } } },
      });
      await this.audit.record(
        {
          ...actor,
          action: 'category.updated',
          entityType: 'CATEGORY',
          entityId: id,
          metadata: { slug: category.slug },
        },
        tx,
      );
      return toCategory(category);
    });
  }

  async deleteCategory(id: string, actor: AuditActorContext): Promise<void> {
    const category = await mustFindCategory(this.prisma, id);
    const courses = await this.prisma.course.count({
      where: { categoryId: id },
    });
    if (courses > 0) {
      throw appError(
        HttpStatus.CONFLICT,
        ERROR_CODE.CATEGORY_NOT_EMPTY,
        'Category still has courses',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.category.delete({ where: { id } });
      await this.audit.record(
        {
          ...actor,
          action: 'category.deleted',
          entityType: 'CATEGORY',
          entityId: id,
          metadata: { slug: category.slug },
        },
        tx,
      );
    });
  }

  async reorderCategories(
    categoryIds: string[],
    actor: AuditActorContext,
  ): Promise<void> {
    const current = await this.prisma.category.findMany({
      orderBy: { position: 'asc' },
      select: { id: true },
    });
    assertSameSet(
      current.map((row) => row.id),
      categoryIds,
    );
    // Category.position is not unique, but normalising through the same
    // two-phase routine keeps one reorder implementation in the codebase.
    await this.prisma.$transaction(async (tx) => {
      await writeOrder(categoryIds, ({ id, position }) =>
        tx.category.update({ where: { id }, data: { position } }),
      );
      await this.audit.record(
        {
          ...actor,
          action: 'category.reordered',
          entityType: 'CATEGORY',
          metadata: { categoryIds },
        },
        tx,
      );
    });
  }

  private async categorySlugTaken(slug: string, exceptId?: string) {
    const row = await this.prisma.category.findUnique({
      where: { slug },
      select: { id: true },
    });
    return Boolean(row) && row!.id !== exceptId;
  }
}
