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
import { CategoryService } from './category.service.js';
import { CourseService } from './course.service.js';
import { CurriculumService } from './curriculum.service.js';
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
  constructor(
    private readonly categories: CategoryService,
    private readonly courses: CourseService,
    private readonly curriculum: CurriculumService,
  ) {}

  // ── Categories ───────────────────────────────────────────────────

  @Get('categories')
  @StaffAccess('scoped')
  // Not owner-filtered: categories are shared taxonomy, not per-instructor
  // data, so every staff role sees the same list.
  listCategories() {
    return this.categories.listCategoriesForAdmin();
  }

  @Post('categories')
  @AdminMutationRateLimit()
  createCategory(
    @Body() input: CreateCategoryDto,
    @AuditActor() actor: AuditActorContext,
  ) {
    return this.categories.createCategory(input, actor);
  }

  /** Declared before `:id` so the literal segment is not eaten by the param. */
  @Put('categories/order')
  @AdminMutationRateLimit()
  @HttpCode(HttpStatus.NO_CONTENT)
  reorderCategories(
    @Body() input: CategoryOrderDto,
    @AuditActor() actor: AuditActorContext,
  ) {
    return this.categories.reorderCategories(input.categoryIds, actor);
  }

  @Patch('categories/:id')
  @AdminMutationRateLimit()
  updateCategory(
    @Param('id', uuid()) id: string,
    @Body() input: UpdateCategoryDto,
    @AuditActor() actor: AuditActorContext,
  ) {
    return this.categories.updateCategory(id, input, actor);
  }

  @Delete('categories/:id')
  @AdminMutationRateLimit()
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteCategory(
    @Param('id', uuid()) id: string,
    @AuditActor() actor: AuditActorContext,
  ) {
    return this.categories.deleteCategory(id, actor);
  }

  // ── Courses ──────────────────────────────────────────────────────

  @Get('courses')
  @StaffAccess('scoped')
  listCourses(@Query() query: AdminCourseListQuery, @OwnerScope() ownerId: string | null) {
    return this.courses.listCoursesForAdmin(query, ownerId);
  }

  @Post('courses')
  @StaffAccess('scoped')
  @AdminMutationRateLimit()
  createCourse(
    @Body() input: CreateCourseDto,
    @AuditActor() actor: AuditActorContext,
    @OwnerScope() ownerId: string | null,
  ) {
    return this.courses.createCourse(input, actor, ownerId);
  }

  @Get('courses/:id')
  @StaffAccess('course')
  getCourse(@Param('id', uuid()) id: string) {
    return this.courses.getCourseForAdmin(id);
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
    return this.courses.updateCourse(id, safe, actor);
  }

  @Delete('courses/:id')
  @StaffAccess('course')
  @AdminMutationRateLimit()
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteCourse(
    @Param('id', uuid()) id: string,
    @AuditActor() actor: AuditActorContext,
  ) {
    return this.courses.deleteCourse(id, actor);
  }

  @Post('courses/:id/publish')
  @StaffAccess('course')
  @AdminMutationRateLimit()
  @HttpCode(HttpStatus.OK)
  publish(
    @Param('id', uuid()) id: string,
    @AuditActor() actor: AuditActorContext,
  ) {
    return this.courses.publishCourse(id, actor);
  }

  @Post('courses/:id/unpublish')
  @StaffAccess('course')
  @AdminMutationRateLimit()
  @HttpCode(HttpStatus.OK)
  unpublish(
    @Param('id', uuid()) id: string,
    @AuditActor() actor: AuditActorContext,
  ) {
    return this.courses.unpublishCourse(id, actor);
  }

  @Post('courses/:id/archive')
  @StaffAccess('course')
  @AdminMutationRateLimit()
  @HttpCode(HttpStatus.OK)
  archive(
    @Param('id', uuid()) id: string,
    @AuditActor() actor: AuditActorContext,
  ) {
    return this.courses.archiveCourse(id, actor);
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
    return this.curriculum.createSection(id, input.title, actor);
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
    return this.curriculum.reorderSections(id, input.sectionIds, actor);
  }

  @Patch('sections/:id')
  @StaffAccess('section')
  @AdminMutationRateLimit()
  updateSection(
    @Param('id', uuid()) id: string,
    @Body() input: SectionTitleDto,
    @AuditActor() actor: AuditActorContext,
  ) {
    return this.curriculum.updateSection(id, input.title, actor);
  }

  @Delete('sections/:id')
  @StaffAccess('section')
  @AdminMutationRateLimit()
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteSection(
    @Param('id', uuid()) id: string,
    @AuditActor() actor: AuditActorContext,
  ) {
    return this.curriculum.deleteSection(id, actor);
  }

  @Post('sections/:id/lessons')
  @StaffAccess('section')
  @AdminMutationRateLimit()
  createLesson(
    @Param('id', uuid()) id: string,
    @Body() input: CreateLessonDto,
    @AuditActor() actor: AuditActorContext,
  ) {
    return this.curriculum.createLesson(id, input, actor);
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
    return this.curriculum.reorderLessons(id, input.lessonIds, actor);
  }

  @Get('lessons/:id')
  @StaffAccess('lesson')
  getLesson(@Param('id', uuid()) id: string) {
    return this.curriculum.getLessonForAdmin(id);
  }

  @Patch('lessons/:id')
  @StaffAccess('lesson')
  @AdminMutationRateLimit()
  updateLesson(
    @Param('id', uuid()) id: string,
    @Body() input: UpdateLessonDto,
    @AuditActor() actor: AuditActorContext,
    @OwnerScope() ownerId: string | null,
  ) {
    return this.curriculum.updateLesson(id, input, actor, ownerId);
  }

  @Delete('lessons/:id')
  @StaffAccess('lesson')
  @AdminMutationRateLimit()
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteLesson(
    @Param('id', uuid()) id: string,
    @AuditActor() actor: AuditActorContext,
  ) {
    return this.curriculum.deleteLesson(id, actor);
  }

  // ── Lesson resources ─────────────────────────────────────────────

  @Get('lessons/:id/resources')
  @StaffAccess('lesson')
  listResources(@Param('id', uuid()) id: string) {
    return this.curriculum.listResources(id);
  }

  @Post('lessons/:id/resources')
  @StaffAccess('lesson')
  @AdminMutationRateLimit()
  addResource(
    @Param('id', uuid()) id: string,
    @Body() input: CreateResourceDto,
    @AuditActor() actor: AuditActorContext,
  ) {
    return this.curriculum.addResource(id, input, actor);
  }

  @Delete('resources/:id')
  @StaffAccess('resource')
  @AdminMutationRateLimit()
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteResource(
    @Param('id', uuid()) id: string,
    @AuditActor() actor: AuditActorContext,
  ) {
    return this.curriculum.deleteResource(id, actor);
  }
}
