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
import { AdminGuard } from '../auth/admin.guard.js';
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
 * `AdminGuard` alone: a STUDENT or an anonymous caller gets 404, byte for byte
 * the same answer as a path that does not exist, so the admin surface is not
 * observable from outside.
 */
@Controller('admin')
@UseGuards(AdminGuard)
export class AdminCatalogController {
  constructor(private readonly catalog: CatalogService) {}

  // ── Categories ───────────────────────────────────────────────────

  @Get('categories')
  listCategories() {
    return this.catalog.listCategoriesForAdmin();
  }

  @Post('categories')
  createCategory(@Body() input: CreateCategoryDto) {
    return this.catalog.createCategory(input);
  }

  /** Declared before `:id` so the literal segment is not eaten by the param. */
  @Put('categories/order')
  @HttpCode(HttpStatus.NO_CONTENT)
  reorderCategories(@Body() input: CategoryOrderDto) {
    return this.catalog.reorderCategories(input.categoryIds);
  }

  @Patch('categories/:id')
  updateCategory(
    @Param('id', uuid()) id: string,
    @Body() input: UpdateCategoryDto,
  ) {
    return this.catalog.updateCategory(id, input);
  }

  @Delete('categories/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteCategory(@Param('id', uuid()) id: string) {
    return this.catalog.deleteCategory(id);
  }

  // ── Courses ──────────────────────────────────────────────────────

  @Get('courses')
  listCourses(@Query() query: AdminCourseListQuery) {
    return this.catalog.listCoursesForAdmin(query);
  }

  @Post('courses')
  createCourse(@Body() input: CreateCourseDto) {
    return this.catalog.createCourse(input);
  }

  @Get('courses/:id')
  getCourse(@Param('id', uuid()) id: string) {
    return this.catalog.getCourseForAdmin(id);
  }

  @Patch('courses/:id')
  updateCourse(
    @Param('id', uuid()) id: string,
    @Body() input: UpdateCourseDto,
  ) {
    return this.catalog.updateCourse(id, input);
  }

  @Delete('courses/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteCourse(@Param('id', uuid()) id: string) {
    return this.catalog.deleteCourse(id);
  }

  @Post('courses/:id/publish')
  @HttpCode(HttpStatus.OK)
  publish(@Param('id', uuid()) id: string) {
    return this.catalog.publishCourse(id);
  }

  @Post('courses/:id/unpublish')
  @HttpCode(HttpStatus.OK)
  unpublish(@Param('id', uuid()) id: string) {
    return this.catalog.unpublishCourse(id);
  }

  @Post('courses/:id/archive')
  @HttpCode(HttpStatus.OK)
  archive(@Param('id', uuid()) id: string) {
    return this.catalog.archiveCourse(id);
  }

  // ── Curriculum ───────────────────────────────────────────────────

  @Post('courses/:id/sections')
  createSection(
    @Param('id', uuid()) id: string,
    @Body() input: SectionTitleDto,
  ) {
    return this.catalog.createSection(id, input.title);
  }

  @Put('courses/:id/sections/order')
  @HttpCode(HttpStatus.NO_CONTENT)
  reorderSections(
    @Param('id', uuid()) id: string,
    @Body() input: SectionOrderDto,
  ) {
    return this.catalog.reorderSections(id, input.sectionIds);
  }

  @Patch('sections/:id')
  updateSection(
    @Param('id', uuid()) id: string,
    @Body() input: SectionTitleDto,
  ) {
    return this.catalog.updateSection(id, input.title);
  }

  @Delete('sections/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteSection(@Param('id', uuid()) id: string) {
    return this.catalog.deleteSection(id);
  }

  @Post('sections/:id/lessons')
  createLesson(
    @Param('id', uuid()) id: string,
    @Body() input: CreateLessonDto,
  ) {
    return this.catalog.createLesson(id, input);
  }

  @Put('sections/:id/lessons/order')
  @HttpCode(HttpStatus.NO_CONTENT)
  reorderLessons(
    @Param('id', uuid()) id: string,
    @Body() input: LessonOrderDto,
  ) {
    return this.catalog.reorderLessons(id, input.lessonIds);
  }

  @Get('lessons/:id')
  getLesson(@Param('id', uuid()) id: string) {
    return this.catalog.getLessonForAdmin(id);
  }

  @Patch('lessons/:id')
  updateLesson(
    @Param('id', uuid()) id: string,
    @Body() input: UpdateLessonDto,
  ) {
    return this.catalog.updateLesson(id, input);
  }

  @Delete('lessons/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteLesson(@Param('id', uuid()) id: string) {
    return this.catalog.deleteLesson(id);
  }

  // ── Lesson resources ─────────────────────────────────────────────

  @Get('lessons/:id/resources')
  listResources(@Param('id', uuid()) id: string) {
    return this.catalog.listResources(id);
  }

  @Post('lessons/:id/resources')
  addResource(
    @Param('id', uuid()) id: string,
    @Body() input: CreateResourceDto,
  ) {
    return this.catalog.addResource(id, input);
  }

  @Delete('resources/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteResource(@Param('id', uuid()) id: string) {
    return this.catalog.deleteResource(id);
  }
}
