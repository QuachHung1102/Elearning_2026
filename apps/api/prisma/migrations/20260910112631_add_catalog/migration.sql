-- CreateEnum
CREATE TYPE "CourseStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CourseLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL_LEVELS');

-- CreateEnum
CREATE TYPE "LessonType" AS ENUM ('VIDEO', 'ARTICLE');

-- CreateEnum
CREATE TYPE "VideoProvider" AS ENUM ('DEMO', 'CLOUDFLARE_STREAM');

-- CreateEnum
CREATE TYPE "VideoAssetStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'ERRORED');

-- CreateEnum
CREATE TYPE "StorageProvider" AS ENUM ('DEMO', 'CLOUDFLARE_R2');

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" VARCHAR(280),
    "icon" VARCHAR(40),
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" UUID NOT NULL,
    "category_id" UUID,
    "slug" VARCHAR(120) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "subtitle" VARCHAR(240),
    "description" TEXT NOT NULL,
    "search_text" VARCHAR(400) NOT NULL DEFAULT '',
    "level" "CourseLevel" NOT NULL DEFAULT 'ALL_LEVELS',
    "language" VARCHAR(10) NOT NULL DEFAULT 'vi',
    "learning_outcomes" TEXT[],
    "requirements" TEXT[],
    "target_audience" TEXT[],
    "price_vnd" INTEGER NOT NULL,
    "compare_at_price_vnd" INTEGER,
    "status" "CourseStatus" NOT NULL DEFAULT 'DRAFT',
    "cover_image_storage" "StorageProvider",
    "cover_image_key" VARCHAR(400),
    "lesson_count" INTEGER NOT NULL DEFAULT 0,
    "total_duration_seconds" INTEGER NOT NULL DEFAULT 0,
    "enrollment_count" INTEGER NOT NULL DEFAULT 0,
    "rating_average" DECIMAL(2,1),
    "rating_count" INTEGER NOT NULL DEFAULT 0,
    "demo_stats" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMPTZ(3),
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sections" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lessons" (
    "id" UUID NOT NULL,
    "section_id" UUID NOT NULL,
    "video_asset_id" UUID,
    "title" VARCHAR(160) NOT NULL,
    "type" "LessonType" NOT NULL DEFAULT 'VIDEO',
    "content" TEXT,
    "is_preview" BOOLEAN NOT NULL DEFAULT false,
    "duration_seconds" INTEGER NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_assets" (
    "id" UUID NOT NULL,
    "provider" "VideoProvider" NOT NULL DEFAULT 'DEMO',
    "external_id" VARCHAR(120) NOT NULL,
    "status" "VideoAssetStatus" NOT NULL DEFAULT 'PENDING',
    "duration_seconds" INTEGER NOT NULL DEFAULT 0,
    "thumbnail_url" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "video_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_resources" (
    "id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "storage" "StorageProvider" NOT NULL DEFAULT 'DEMO',
    "object_key" VARCHAR(400) NOT NULL,
    "filename" VARCHAR(200) NOT NULL,
    "content_type" VARCHAR(120) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lesson_resources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_position_idx" ON "categories"("position");

-- CreateIndex
CREATE UNIQUE INDEX "courses_slug_key" ON "courses"("slug");

-- CreateIndex
CREATE INDEX "courses_status_published_at_idx" ON "courses"("status", "published_at");

-- CreateIndex
CREATE INDEX "courses_category_id_status_idx" ON "courses"("category_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sections_course_id_position_key" ON "sections"("course_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "lessons_video_asset_id_key" ON "lessons"("video_asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "lessons_section_id_position_key" ON "lessons"("section_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "video_assets_provider_external_id_key" ON "video_assets"("provider", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_resources_lesson_id_position_key" ON "lesson_resources"("lesson_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_resources_storage_object_key_key" ON "lesson_resources"("storage", "object_key");

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_video_asset_id_fkey" FOREIGN KEY ("video_asset_id") REFERENCES "video_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_resources" ADD CONSTRAINT "lesson_resources_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Handwritten: Prisma Schema Language has no CHECK syntax (DATA_MODEL.md §SQL viết tay).
-- Do not drop these when regenerating this migration.
ALTER TABLE "courses" ADD CONSTRAINT "courses_price_vnd_check" CHECK ("price_vnd" >= 0);
ALTER TABLE "courses" ADD CONSTRAINT "courses_compare_price_check" CHECK ("compare_at_price_vnd" IS NULL OR "compare_at_price_vnd" > "price_vnd");
