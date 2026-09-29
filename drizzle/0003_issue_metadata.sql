-- 0003 — one issue record per comic, placements in run_issues, credits,
-- story titles and cover URLs; runs lose their typed writer/artists.
--
-- Hand-written rather than generated: drizzle-kit reads a dropped-and-added
-- column as a possible rename and stops to ask. The data steps keep a loaded
-- database consistent — duplicate issue rows collapse onto one id per label,
-- placements and progress move with them — but ids stay the old run#sequence
-- form until the next `npm run rebuild` or load writes label slugs.
--
-- Views depend on issues.run_id, so they are dropped here. Re-apply them with
-- `npm run db:views` (rebuild and load.ps1 both do it).
DROP VIEW IF EXISTS run_span, run_progress CASCADE;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "run_issues" (
	"run_id" text NOT NULL,
	"sequence" integer NOT NULL,
	"issue_id" text NOT NULL,
	"type" text DEFAULT 'core' NOT NULL,
	"notes" text,
	CONSTRAINT "run_issues_run_id_sequence_pk" PRIMARY KEY("run_id","sequence")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "creators" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"metron_id" integer,
	CONSTRAINT "creators_metron_id_unique" UNIQUE("metron_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "issue_credits" (
	"issue_id" text NOT NULL,
	"creator_id" text NOT NULL,
	"role" text NOT NULL,
	"source" text NOT NULL,
	CONSTRAINT "issue_credits_issue_id_creator_id_role_pk" PRIMARY KEY("issue_id","creator_id","role"),
	CONSTRAINT "issue_credits_role_check" CHECK ("issue_credits"."role" IN ('writer', 'artist', 'inker', 'colorist', 'letterer', 'cover')),
	CONSTRAINT "issue_credits_source_check" CHECK ("issue_credits"."source" IN ('metron', 'hand'))
);
--> statement-breakpoint
-- Placements from the old per-run rows, each pointing at the first row that
-- carries its label (the survivor below).
INSERT INTO "run_issues" ("run_id", "sequence", "issue_id", "type", "notes")
SELECT i.run_id, i.sequence,
       (SELECT min(j.id) FROM "issues" j WHERE j.label = i.label),
       i.type, i.notes
FROM "issues" i;
--> statement-breakpoint
-- Progress moves to the survivor: read in any run means read.
INSERT INTO "issue_progress" ("user_id", "issue_id", "completed_at")
SELECT p.user_id, s.survivor, min(p.completed_at)
FROM "issue_progress" p
JOIN (SELECT id, (SELECT min(j.id) FROM "issues" j WHERE j.label = i.label) AS survivor
      FROM "issues" i) s ON s.id = p.issue_id
WHERE s.survivor <> p.issue_id
GROUP BY p.user_id, s.survivor
ON CONFLICT DO NOTHING;
--> statement-breakpoint
DELETE FROM "issues" i
WHERE i.id <> (SELECT min(j.id) FROM "issues" j WHERE j.label = i.label);
--> statement-breakpoint
ALTER TABLE "issues" DROP CONSTRAINT IF EXISTS "issues_run_id_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "issues" DROP COLUMN IF EXISTS "run_id";--> statement-breakpoint
ALTER TABLE "issues" DROP COLUMN IF EXISTS "sequence";--> statement-breakpoint
ALTER TABLE "issues" DROP COLUMN IF EXISTS "type";--> statement-breakpoint
ALTER TABLE "issues" DROP COLUMN IF EXISTS "notes";--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "story_title" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "story_title_source" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "cover_url" text;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_label_unique" UNIQUE("label");--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_story_title_source_check" CHECK (
    ("issues"."story_title" IS NULL) = ("issues"."story_title_source" IS NULL)
    AND ("issues"."story_title_source" IS NULL OR "issues"."story_title_source" IN ('metron', 'hand')));--> statement-breakpoint
ALTER TABLE "runs" DROP COLUMN IF EXISTS "writer";--> statement-breakpoint
ALTER TABLE "runs" DROP COLUMN IF EXISTS "artists";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "run_issues" ADD CONSTRAINT "run_issues_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "run_issues" ADD CONSTRAINT "run_issues_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "issue_credits" ADD CONSTRAINT "issue_credits_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "issue_credits" ADD CONSTRAINT "issue_credits_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "run_issues_issue_id_idx" ON "run_issues" USING btree ("issue_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "issue_credits_creator_id_idx" ON "issue_credits" USING btree ("creator_id");
