-- Reverses 0007_placement_progress.sql. Run by hand, in one transaction so a
-- failure leaves nothing half-reverted:
--   psql "$URL" -1 -v ON_ERROR_STOP=1 -f drizzle/down/0007_placement_progress.sql
-- drizzle-kit does not run it; delete 0007's row from
-- drizzle.__drizzle_migrations before migrating up again.
--
-- Lossy in one place only: an issue read in several runs collapses to one
-- issue-keyed row, which keeps the earliest dated read (exact before approximate
-- on a tie) and is undated only when every read was. A read with no date stays
-- precision 'none' with a NULL completed_at; nothing is stamped with now().
-- Views depend on issue_progress.placement_id: re-apply etl/views.sql after.
DROP VIEW IF EXISTS live_run_issues CASCADE;
ALTER TABLE "issue_progress" ADD COLUMN "issue_id" text;
UPDATE "issue_progress" p SET "issue_id" = ri."issue_id"
  FROM "run_issues" ri WHERE ri."id" = p."placement_id";
DELETE FROM "issue_progress" p
  USING (SELECT ctid, row_number() OVER (
           PARTITION BY "user_id", "issue_id"
           ORDER BY "completed_at" ASC NULLS LAST, "completed_at_precision" DESC, "placement_id") AS n
         FROM "issue_progress") d
  WHERE p.ctid = d.ctid AND d.n > 1;
ALTER TABLE "issue_progress" DROP CONSTRAINT "issue_progress_placement_id_run_issues_id_fk";
ALTER TABLE "issue_progress" DROP CONSTRAINT "issue_progress_user_id_placement_id_pk";
ALTER TABLE "issue_progress" DROP COLUMN "placement_id";
ALTER TABLE "issue_progress" ALTER COLUMN "issue_id" SET NOT NULL;
ALTER TABLE "issue_progress" ADD CONSTRAINT "issue_progress_user_id_issue_id_pk" PRIMARY KEY("user_id","issue_id");
ALTER TABLE "issue_progress" ADD CONSTRAINT "issue_progress_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "run_issues" DROP CONSTRAINT "run_issues_run_id_sequence_unique";
ALTER TABLE "run_issues" DROP COLUMN "id";
ALTER TABLE "run_issues" ADD CONSTRAINT "run_issues_run_id_sequence_pk" PRIMARY KEY("run_id","sequence");
