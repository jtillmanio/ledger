CREATE TABLE IF NOT EXISTS "blocks" (
	"id" text PRIMARY KEY NOT NULL,
	"track_id" text NOT NULL,
	"number" integer NOT NULL,
	"name" text,
	CONSTRAINT "blocks_track_id_number_unique" UNIQUE("track_id","number")
);
--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "cover_date" date;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "cover_date_source" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "metron_id" integer;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "block_id" text;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "why_source" text DEFAULT 'hand' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "blocks" ADD CONSTRAINT "blocks_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "runs" ADD CONSTRAINT "runs_block_id_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."blocks"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "runs" DROP COLUMN IF EXISTS "series_issues";--> statement-breakpoint
ALTER TABLE "runs" DROP COLUMN IF EXISTS "start_year";--> statement-breakpoint
ALTER TABLE "runs" DROP COLUMN IF EXISTS "end_year";--> statement-breakpoint
ALTER TABLE "runs" DROP COLUMN IF EXISTS "block";--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_cover_date_source_check" CHECK (
    ("issues"."cover_date" IS NULL) = ("issues"."cover_date_source" IS NULL)
    AND ("issues"."cover_date_source" IS NULL OR "issues"."cover_date_source" IN ('metron', 'hand')));--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_why_source_check" CHECK ("runs"."why_source" IN ('hand', 'claude'));