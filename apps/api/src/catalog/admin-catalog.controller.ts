import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuditActor } from '../audit/audit-actor.decorator.js';
import type { AuditActorContext } from '../audit/audit.service.js';
import { AuthRateLimitGuard } from '../auth/auth-rate-limit.guard.js';
import { OwnerScope, StaffAccess, StaffGuard } from '../auth/staff.guard.js';
import { AdminMutationRateLimit } from '../auth/rate-limit.decorator.js';
import { CatalogService } from './catalog.service.js';
import {
  AdminCourseListQuery,
  CategoryOrderDto,
  CreateCategoryDto,
  CreateCourseDto,
  CreateLessonDto,
  CreateResourceDto,
  LessonOrderDto,
  SectionOrderDto,
  SectionTitleDto,
  UpdateCategoryDto,
  UpdateCourseDto,
  UpdateLessonDto,
} from './course.dto.js';

const uuid = () => new ParseUUIDPipe({ version: '4' });

/**
 * `StaffGuard`: admins pass everything; instructors only handlers tagged
 * `@StaffAccess`, and only on courses they own. Everyone else gets 404.
 */
@Controller('admin')
@UseGuards(StaffGuard, AuthRateLimitGuard)
export class AdminCatalogController {
  constructor(private readonly catalog: CatalogService) {}

  // ── Categories ───────────────────────────────────────────────────

  @Get('categories')
  @StaffAccess('scoped')
  listCategories() {
    return this.catalog.listCategoriesForAdmin();
  }

  @Post('categories')
  @AdminMutationRateLimit()
  createCategory(
    @Body() input: CreateCategoryDto,
    @AuditActor() actor: AuditActorContext,
  ) {
    return this.catalog.createCategory(input, actor);
  }

  /** Declared before `:id` so the literal segment is not eaten by the param. */
  @Put('categories/order')
  @AdminMutationRateLimit()
  @HttpCode(HttpStatus.NO_CONTENT)
  reorderCategories(
    @Body() input: CategoryOrderDto,
    @AuditActor() actor: AuditActorContext,
  ) {
    return this.catalog.reorderCategories(input.categoryIds, actor);
  }

  @Patch('categories/:id')
  @AdminMutationRateLimit()
  updateCategory(
    @Param('id', uuid()) id: string,
    @Body() input: UpdateCategoryDto,
    @AuditActor() actor: AuditActorContext,
  ) {
    return this.catalog.updateCategory(id, input, actor);
  }

  @Delete('categories/:id')
  @AdminMutationRateLimit()
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteCategory(
    @Param('id', uuid()) id: string,
    @AuditActor() actor: AuditActorContext,
  ) {
    return this.catalog.deleteCategory(id, actor);
  }

  // ── Courses ──────────────────────────────────────────────────────

  @Get('courses')
  @StaffAccess('scoped')
  listCourses(@Query() query: AdminCourseListQuery, @OwnerScope() ownerId: string | null) {
    return this.catalog.listCoursesForAdmin(query, ownerId);
  }

  @Post('courses')
  @StaffAccess('scoped')
  @AdminMutationRateLimit()
  createCourse(
    @Body() input: CreateCourseDto,
    @AuditActor() actor: AuditActorContext,
    @OwnerScope() ownerId: string | null,
  ) {
    return this.catalog.createCourse(input, actor, ownerId);
  }

  @Get('courses/:id')
  @StaffAccess('course')
  getCourse(@Param('id', uuid()) id: string) {
    return this.catalog.getCourseForAdmin(id);
  }

  @Patch('courses/:id')
  @StaffAccess('course')
  @AdminMutationRateLimit()
  updateCourse(
    @Param('id', uuid()) id: string,
    @Body() input: UpdateCourseDto,
    @AuditActor() actor: AuditActorContext,
    @OwnerScope() ownerId: string | null,
  ) {
    // Only an admin reassigns ownership.
    const safe = ownerId ? { ...input, instructorId: undefined } : input;
    return this.catalog.updateCourse(id, safe, actor);
  }

  @Delete('courses/:id')
  @StaffAccess('course')
  @AdminMutationRateLimit()
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteCourse(
    @Param('id', uuid()) id: string,
    @AuditActor() actor: AuditActorContext,
  ) {
    return this.catalog.deleteCourse(id, actor);
  }

  @Post('courses/:id/publish')
  @StaffAccess('course')
  @AdminMutationRateLimit()
  @HttpCode(HttpStatus.OK)
  publish(
    @Param('id', uuid()) id: string,
    @AuditActor() actor: AuditActorContext,
  ) {
    return this.catalog.publishCourse(id, actor);
  }

  @Post('courses/:id/unpublish')
  @StaffAccess('course')
  @AdminMutationRateLimit()
  @HttpCode(HttpStatus.OK)
  unpublish(
    @Param('id', uuid()) id: string,
    @AuditActor() actor: AuditActorContext,
  ) {
    return this.catalog.unpublishCourse(id, actor);
  }

  @Post('courses/:id/archive')
  @StaffAccess('course')
  @AdminMutationRateLimit()
  @HttpCode(HttpStatus.OK)
  archive(
    @Param('id', uuid()) id: string,
    @AuditActor() actor: AuditActorContext,
  ) {
    return this.catalog.archiveCourse(id, actor);
  }

  // ── Curriculum ───────────────────────────────────────────────────

  @Post('courses/:id/sections')
  @StaffAccess('course')
  @AdminMutationRateLimit()
  createSection(
    @Param('id', uuid()) id: string,
    @Body() input: SectionTitleDto,
    @AuditActor() actor: AuditActorContext,
  ) {
    return this.catalog.createSection(id, input.title, actor);
  }

  @Put('courses/:id/sections/order')
  @StaffAccess('course')
  @AdminMutationRateLimit()
  @HttpCode(HttpStatus.NO_CONTENT)
  reorderSections(
    @Param('id', uuid()) id: string,
    @Body() input: SectionOrderDto,
    @AuditActor() actor: AuditActorContext,
  ) {
    return this.catalog.reorderSections(id, input.sectionIds, actor);
  }

  @Patch('sections/:id')
  @StaffAccess('section')
  @AdminMutationRateLimit()
  updateSection(
    @Param('id', uuid()) id: string,
    @Body() input: SectionTitleDto,
    @AuditActor() actor: AuditActorContext,
  ) {
    return this.catalog.updateSection(id, input.title, actor);
  }

  @Delete('sections/:id')
  @StaffAccess('section')
  @AdminMutationRateLimit()
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteSection(
    @Param('id', uuid()) id: string,
    @AuditActor() actor: AuditActorContext,
  ) {
    return this.catalog.deleteSection(id, actor);
  }

  @Post('sections/:id/lessons')
  @StaffAccess('section')
  @AdminMutationRateLimit()
  createLesson(
    @Param('id', uuid()) id: string,
    @Body() input: CreateLessonDto,
    @AuditActor() actor: AuditActorContext,
  ) {
    return this.catalog.createLesson(id, input, actor);
  }

  @Put('sections/:id/lessons/order')
  @StaffAccess('section')
  @AdminMutationRateLimit()
  @HttpCode(HttpStatus.NO_CONTENT)
  reorderLessons(
    @Param('id', uuid()) id: string,
    @Body() input: LessonOrderDto,
    @AuditActor() actor: AuditActorContext,
  ) {
    return this.catalog.reorderLessons(id, input.lessonIds, actor);
  }

  @Get('lessons/:id')
  @StaffAccess('lesson')
  getLesson(@Param('id', uuid()) id: string) {
    return this.catalog.getLessonForAdmin(id);
  }

  @Patch('lessons/:id')
  @StaffAccess('lesson')
  @AdminMutationRateLimit()
  updateLesson(
    @Param('id', uuid()) id: string,
    @Body() input: UpdateLessonDto,
    @AuditActor() actor: AuditActorContext,
  ) {
    return this.catalog.updateLesson(id, input, actor);
  }

  @Delete('lessons/:id')
  @StaffAccess('lesson')
  @AdminMutationRateLimit()
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteLesson(
    @Param('id', uuid()) id: string,
    @AuditActor() actor: AuditActorContext,
  ) {
    return this.catalog.deleteLesson(id, actor);
  }

  // ── Lesson resources ─────────────────────────────────────────────

  @Get('lessons/:id/resources')
  @StaffAccess('lesson')
  listResources(@Param('id', uuid()) id: string) {
    return this.catalog.listResources(id);
  }

  @Post('lessons/:id/resources')
  @StaffAccess('lesson')
  @AdminMutationRateLimit()
  addResource(
    @Param('id', uuid()) id: string,
    @Body() input: CreateResourceDto,
    @AuditActor() actor: AuditActorContext,
  ) {
    return this.catalog.addResource(id, input, actor);
  }

  @Delete('resources/:id')
  @StaffAccess('resource')
  @AdminMutationRateLimit()
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteResource(
    @Param('id', uuid()) id: string,
    @AuditActor() actor: AuditActorContext,
  ) {
    return this.catalog.deleteResource(id, actor);
  }
}
