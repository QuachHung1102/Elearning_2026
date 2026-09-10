import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service.js';
import { CourseListQuery, SlugParam } from './course.dto.js';

const CATALOG_CACHE = 'public, max-age=60, stale-while-revalidate=300';

/**
 * Public catalog. Everything here is cacheable, so nothing here may depend on
 * who is asking — "already enrolled" is fetched separately by the browser.
 */
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Header('Cache-Control', CATALOG_CACHE)
  @Get('categories')
  listCategories() {
    return this.catalog.listCategories();
  }

  @Header('Cache-Control', CATALOG_CACHE)
  @Get('categories/:slug')
  getCategory(@Param() params: SlugParam) {
    return this.catalog.getCategoryBySlug(params.slug);
  }

  @Header('Cache-Control', CATALOG_CACHE)
  @Get('courses')
  listCourses(@Query() query: CourseListQuery) {
    return this.catalog.listCourses(query);
  }

  @Header('Cache-Control', CATALOG_CACHE)
  @Get('courses/:slug')
  getCourse(@Param() params: SlugParam) {
    return this.catalog.getCourseBySlug(params.slug);
  }
}
