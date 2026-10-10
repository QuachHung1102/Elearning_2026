-- REVIEW F-10: a video asset belongs to whoever registered it; null = the site owner.
-- AlterTable
ALTER TABLE "video_assets" ADD COLUMN     "instructor_id" UUID;

-- Existing rows inherit the owner of the course their lesson belongs to.
UPDATE "video_assets" AS v
SET "instructor_id" = c."instructor_id"
FROM "lessons" AS l
JOIN "sections" AS s ON s."id" = l."section_id"
JOIN "courses" AS c ON c."id" = s."course_id"
WHERE l."video_asset_id" = v."id";

-- CreateIndex
CREATE INDEX "video_assets_instructor_id_idx" ON "video_assets"("instructor_id");

-- AddForeignKey
ALTER TABLE "video_assets" ADD CONSTRAINT "video_assets_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
