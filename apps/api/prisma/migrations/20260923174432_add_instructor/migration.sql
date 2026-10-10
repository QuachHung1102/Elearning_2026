-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'INSTRUCTOR';

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "instructor_id" UUID;

-- CreateIndex
CREATE INDEX "courses_instructor_id_idx" ON "courses"("instructor_id");

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
