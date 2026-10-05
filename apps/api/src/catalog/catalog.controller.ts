import {
  Controller,
  Get,
  Header,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthRateLimitGuard } from '../auth/auth-rate-limit.guard.js';
import { RateLimit } from '../auth/rate-limit.decorator.js';
import { CategoryService } from './category.service.js';
import { CourseService } from './course.service.js';
import { CourseListQuery, SlugParam } from './course.dto.js';

const CATALOG_CACHE = 'public, max-age=60, stale-while-revalidate=300';

/** Against scraping (API_CONTRACT.md §8): the answers are cached for a minute, so a person rarely gets here. */
const READS_PER_MINUTE = { key: 'ip', limit: 120, windowSeconds: 60 } as const;

/**
 * Public catalog. Everything here is cacheable, so nothing here may depend on
 * who is asking — "already enrolled" is fetched separately by the browser.
 */
@Controller()
@UseGuards(AuthRateLimitGuard)
export class CatalogController {
  constructor(
    private readonly categories: CategoryService,
    private readonly courses: CourseService,
  ) {}

  @Header('Cache-Control', CATALOG_CACHE)
  @Get('categories')
  listCategories() {
    return this.categories.listCategories();
  }

  @Header('Cache-Control', CATALOG_CACHE)
  @Get('categories/:slug')
  getCategory(@Param() params: SlugParam) {
    return this.categories.getCategoryBySlug(params.slug);
  }

  @Header('Cache-Control', CATALOG_CACHE)
  @RateLimit(READS_PER_MINUTE)
  @Get('courses')
  listCourses(@Query() query: CourseListQuery) {
    return this.courses.listCourses(query);
  }

  @Header('Cache-Control', CATALOG_CACHE)
  @RateLimit(READS_PER_MINUTE)
  @Get('courses/:slug')
  getCourse(@Param() params: SlugParam) {
    return this.courses.getCourseBySlug(params.slug);
  }
}
