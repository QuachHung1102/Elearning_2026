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
import { CatalogService } from './catalog.service.js';
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
  @RateLimit(READS_PER_MINUTE)
  @Get('courses')
  listCourses(@Query() query: CourseListQuery) {
    return this.catalog.listCourses(query);
  }

  @Header('Cache-Control', CATALOG_CACHE)
  @RateLimit(READS_PER_MINUTE)
  @Get('courses/:slug')
  getCourse(@Param() params: SlugParam) {
    return this.catalog.getCourseBySlug(params.slug);
  }
}
