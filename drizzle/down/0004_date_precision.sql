-- Reverses 0004_date_precision.sql. Run by hand; drizzle-kit does not.
-- Lossy by design: precision is dropped, and a NULL completed_at (a read with no
-- date) comes back as now(), which is the state the column was in before.
ALTER TABLE "run_issues" DROP CONSTRAINT IF EXISTS "run_issues_run_id_issue_id_unique";
ALTER TABLE "issue_progress" DROP CONSTRAINT IF EXISTS "issue_progress_completed_at_precision_check";
ALTER TABLE "book_status" DROP CONSTRAINT IF EXISTS "book_status_finished_on_precision_check";
UPDATE "issue_progress" SET "completed_at" = now() WHERE "completed_at" IS NULL;
ALTER TABLE "issue_progress" ALTER COLUMN "completed_at" SET NOT NULL;
ALTER TABLE "issue_progress" DROP COLUMN "completed_at_precision";
ALTER TABLE "book_status" DROP COLUMN "finished_on_precision";
ALTER TABLE "book_status" ALTER COLUMN "finished_on" SET DATA TYPE text USING "finished_on"::text;
