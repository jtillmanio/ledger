ALTER TABLE "books" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "subjects" text[];--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "story_arc" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "story_arc_source" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "store_date" date;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "store_date_source" text;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_story_arc_source_check" CHECK (
    ("issues"."story_arc" IS NULL) = ("issues"."story_arc_source" IS NULL)
    AND ("issues"."story_arc_source" IS NULL OR "issues"."story_arc_source" IN ('metron', 'hand')));--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_store_date_source_check" CHECK (
    ("issues"."store_date" IS NULL) = ("issues"."store_date_source" IS NULL)
    AND ("issues"."store_date_source" IS NULL OR "issues"."store_date_source" IN ('metron', 'hand')));