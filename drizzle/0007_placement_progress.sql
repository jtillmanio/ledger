-- 0007 — task 0.8a: read state belongs to the placement, not the issue
-- (ARCHITECTURE 2.14). run_issues gets a surrogate id; issue_progress keys on it.
--
-- Hand-written rather than generated: drizzle-kit reads issue_id dropped and
-- placement_id added as a possible rename and stops to ask. The snapshot was
-- generated in two steps (add, then drop), so it matches src/db/schema.ts.
--
-- On a loaded database:
--   * run_issues.id is numbered in physical row order, not sheet order (D-16).
--     The next `npm run rebuild` loads extract's sheet-order ids.
--   * Each issue-keyed progress row becomes one row per placement of that issue,
--     soft-deleted placements included, with its date and precision unchanged.
--     That keeps every view's answer what it was the moment before; the next
--     rebuild loads the workbook's per-row Completed values instead. A progress
--     row on an issue with no placement at all stops the migration.
--
-- Views depend on issue_progress.issue_id, so they are dropped here. Re-apply
-- them with `npm run db:views` (Release, rebuild and the loaders all do it).
-- Reversed by drizzle/down/0007_placement_progress.sql.
DROP VIEW IF EXISTS live_run_issues CASCADE;
--> statement-breakpoint
ALTER TABLE "run_issues" DROP CONSTRAINT "run_issues_run_id_sequence_pk";
--> statement-breakpoint
ALTER TABLE "run_issues" ADD COLUMN "id" serial PRIMARY KEY NOT NULL;
--> statement-breakpoint
-- Deferred, so one UPDATE can shift every later sequence by one (R0-15).
-- drizzle-kit writes a plain UNIQUE; schema.ts cannot say DEFERRABLE.
ALTER TABLE "run_issues" ADD CONSTRAINT "run_issues_run_id_sequence_unique" UNIQUE("run_id","sequence") DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE "issue_progress" ADD COLUMN "placement_id" integer;
--> statement-breakpoint
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM "issue_progress" p
  WHERE NOT EXISTS (SELECT 1 FROM "run_issues" ri WHERE ri."issue_id" = p."issue_id");
  IF n > 0 THEN
    RAISE EXCEPTION '0007: % issue_progress row(s) are on issues no run places, so they have no placement to move to. Nothing was changed.', n;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "issue_progress" DROP CONSTRAINT "issue_progress_user_id_issue_id_pk";
--> statement-breakpoint
INSERT INTO "issue_progress" ("user_id", "issue_id", "placement_id", "completed_at", "completed_at_precision")
  SELECT p."user_id", p."issue_id", ri."id", p."completed_at", p."completed_at_precision"
  FROM "issue_progress" p
  JOIN "run_issues" ri ON ri."issue_id" = p."issue_id"
  WHERE p."placement_id" IS NULL;
--> statement-breakpoint
DELETE FROM "issue_progress" WHERE "placement_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "issue_progress" DROP CONSTRAINT "issue_progress_issue_id_issues_id_fk";
--> statement-breakpoint
ALTER TABLE "issue_progress" DROP COLUMN "issue_id";
--> statement-breakpoint
ALTER TABLE "issue_progress" ALTER COLUMN "placement_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "issue_progress" ADD CONSTRAINT "issue_progress_user_id_placement_id_pk" PRIMARY KEY("user_id","placement_id");
--> statement-breakpoint
ALTER TABLE "issue_progress" ADD CONSTRAINT "issue_progress_placement_id_run_issues_id_fk" FOREIGN KEY ("placement_id") REFERENCES "public"."run_issues"("id") ON DELETE cascade ON UPDATE no action;
