-- REVIEW F-31: deleting a lesson counts and cascades its progress rows by lesson_id,
-- and only (user_id, lesson_id) and (user_id, updated_at) were indexed.
CREATE INDEX "lesson_progress_lesson_id_idx" ON "lesson_progress"("lesson_id");
