import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  CourseLevel,
  CourseStatus,
  LessonType,
} from '../generated/prisma/enums.js';
import { config } from '../config.js';
import {
  COVER_CONTENT_TYPES,
  RESOURCE_CONTENT_TYPES,
} from '../media/object-storage.js';
import { SLUG_PATTERN } from './slug.js';

const trim = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

/** `a,b` → `['a','b']`, dropping empties. A single value stays a one-item list. */
const csv = () =>
  Transform(({ value }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean)
      : value,
  );

/** Strips blank array entries before validation — pasting from Word brings them. */
const compactStrings = () =>
  Transform(({ value }) =>
    Array.isArray(value)
      ? value
          .map((entry) => (typeof entry === 'string' ? entry.trim() : entry))
          .filter((entry) => typeof entry === 'string' && entry.length > 0)
      : value,
  );

/** Page and pageSize are clamped, never rejected (ROADMAP.md A2.8). */
export class PageQuery {
  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  pageSize?: string;
}

export const COURSE_SORT_FIELDS = [
  'enrollmentCount',
  'publishedAt',
  'priceVnd',
  'ratingAverage',
] as const;

export const ADMIN_COURSE_SORT_FIELDS = [
  'updatedAt',
  'title',
  'enrollmentCount',
] as const;

export class CourseListQuery extends PageQuery {
  @IsOptional()
  @trim()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @csv()
  @IsArray()
  @Matches(SLUG_PATTERN, { each: true })
  category?: string[];

  @IsOptional()
  @csv()
  @IsArray()
  @IsEnum(CourseLevel, { each: true })
  level?: CourseLevel[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceVndMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceVndMax?: number;

  /** Outside the whitelist is a 400, never a silently ignored parameter. */
  @IsOptional()
  @IsIn(
    COURSE_SORT_FIELDS.flatMap((field) => [`${field}:asc`, `${field}:desc`]),
  )
  sort?: string;
}

export class AdminCourseListQuery extends PageQuery {
  @IsOptional()
  @trim()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @csv()
  @IsArray()
  @IsEnum(CourseStatus, { each: true })
  status?: CourseStatus[];

  @IsOptional()
  @IsIn(
    ADMIN_COURSE_SORT_FIELDS.flatMap((field) => [
      `${field}:asc`,
      `${field}:desc`,
    ]),
  )
  sort?: string;
}

export class SlugParam {
  @Matches(SLUG_PATTERN)
  slug: string;
}

export class CreateCategoryDto {
  @trim()
  @IsString()
  @Length(2, 80)
  name: string;

  @IsOptional()
  @Matches(SLUG_PATTERN)
  slug?: string;

  @IsOptional()
  @trim()
  @IsString()
  @MaxLength(280)
  description?: string;

  @IsOptional()
  @trim()
  @IsString()
  @MaxLength(40)
  icon?: string;
}

export class UpdateCategoryDto {
  @IsOptional()
  @trim()
  @IsString()
  @Length(2, 80)
  name?: string;

  @IsOptional()
  @Matches(SLUG_PATTERN)
  slug?: string;

  @IsOptional()
  @trim()
  @IsString()
  @MaxLength(280)
  description?: string;

  @IsOptional()
  @trim()
  @IsString()
  @MaxLength(40)
  icon?: string;
}

export class CategoryOrderDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  categoryIds: string[];
}

export class SectionOrderDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  sectionIds: string[];
}

export class LessonOrderDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  lessonIds: string[];
}

export class CreateCourseDto {
  @trim()
  @IsString()
  @Length(3, 160)
  title: string;

  @IsOptional()
  @Matches(SLUG_PATTERN)
  slug?: string;

  @IsOptional()
  @IsUUID('4')
  categoryId?: string;
}

export class UpdateCourseDto {
  @IsOptional()
  @trim()
  @IsString()
  @Length(3, 160)
  title?: string;

  @IsOptional()
  @Matches(SLUG_PATTERN)
  slug?: string;

  @IsOptional()
  @trim()
  @IsString()
  @MaxLength(240)
  subtitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  priceVnd?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  compareAtPriceVnd?: number | null;

  @IsOptional()
  @IsEnum(CourseLevel)
  level?: CourseLevel;

  @IsOptional()
  @trim()
  @IsString()
  @MaxLength(10)
  language?: string;

  @IsOptional()
  @IsUUID('4')
  categoryId?: string | null;

  @IsOptional()
  @compactStrings()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  learningOutcomes?: string[];

  @IsOptional()
  @compactStrings()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  requirements?: string[];

  @IsOptional()
  @compactStrings()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  targetAudience?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(400)
  coverImageKey?: string;
}

export class SectionTitleDto {
  @trim()
  @IsString()
  @Length(1, 160)
  title: string;
}

export class CreateLessonDto {
  @trim()
  @IsString()
  @Length(1, 160)
  title: string;

  @IsEnum(LessonType)
  type: LessonType;
}

export class UpdateLessonDto {
  @IsOptional()
  @trim()
  @IsString()
  @Length(1, 160)
  title?: string;

  @IsOptional()
  @IsEnum(LessonType)
  type?: LessonType;

  @IsOptional()
  @IsString()
  @MaxLength(50_000)
  content?: string;

  @IsOptional()
  @IsUUID('4')
  videoAssetId?: string | null;

  @IsOptional()
  @IsBoolean()
  isPreview?: boolean;
}

export class CreateResourceDto {
  @IsString()
  @MaxLength(400)
  objectKey: string;

  @trim()
  @IsString()
  @Length(1, 200)
  filename: string;

  @IsIn(RESOURCE_CONTENT_TYPES)
  contentType: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(config.maxUploadBytes)
  sizeBytes: number;
}

export class CoverUploadUrlDto {
  @trim()
  @IsString()
  @Length(1, 200)
  filename: string;

  @IsIn(COVER_CONTENT_TYPES)
  contentType: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(config.maxUploadBytes)
  sizeBytes: number;
}

export class ResourceUploadUrlDto extends CoverUploadUrlDto {
  @IsIn(RESOURCE_CONTENT_TYPES)
  declare contentType: string;
}

export class CreateVideoDto {
  @trim()
  @IsString()
  @Length(1, 120)
  externalId: string;
}

export class ReportRangeQuery {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}
