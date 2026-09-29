ALTER TABLE "book_status" ALTER COLUMN "finished_on" SET DATA TYPE date USING NULLIF("finished_on"::text, '')::date;--> statement-breakpoint
ALTER TABLE "issue_progress" ALTER COLUMN "completed_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "book_status" ADD COLUMN "finished_on_precision" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "issue_progress" ADD COLUMN "completed_at_precision" text DEFAULT 'exact' NOT NULL;--> statement-breakpoint
-- D-R2-1: a database loaded before the extract dropped repeats holds 13 duplicate
-- (run, issue) placements. Progress is still issue-keyed here, so dropping the
-- later copy loses nothing; sequences keep a gap, which nothing depends on.
DELETE FROM "run_issues" a USING "run_issues" b
  WHERE a."run_id" = b."run_id" AND a."issue_id" = b."issue_id" AND a."sequence" > b."sequence";--> statement-breakpoint
ALTER TABLE "run_issues" ADD CONSTRAINT "run_issues_run_id_issue_id_unique" UNIQUE("run_id","issue_id");--> statement-breakpoint
ALTER TABLE "book_status" ADD CONSTRAINT "book_status_finished_on_precision_check" CHECK (
    "book_status"."finished_on_precision" IN ('exact', 'approximate', 'none')
    AND ("book_status"."finished_on" IS NULL) = ("book_status"."finished_on_precision" = 'none'));--> statement-breakpoint
ALTER TABLE "issue_progress" ADD CONSTRAINT "issue_progress_completed_at_precision_check" CHECK (
    "issue_progress"."completed_at_precision" IN ('exact', 'approximate', 'none')
    AND ("issue_progress"."completed_at" IS NULL) = ("issue_progress"."completed_at_precision" = 'none'));