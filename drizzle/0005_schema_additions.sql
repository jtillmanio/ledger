-- 0005 — task 0.3: reading_settings, eras, volume_rules, shelves + shelf_books,
-- soft-delete columns, book metadata columns and three value CHECKs.
--
-- Generated, then hand-edited in two places:
--   * run_issues' era foreign key is SET NULL ("era_id"). drizzle-kit writes a
--     bare SET NULL, which on a composite key would null run_id as well.
--   * books.word_count_source is backfilled before its pairing CHECK.
CREATE TABLE "eras" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"ordinal" integer NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "eras_run_id_ordinal_unique" UNIQUE("run_id","ordinal"),
	CONSTRAINT "eras_id_run_id_unique" UNIQUE("id","run_id")
);
--> statement-breakpoint
CREATE TABLE "reading_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"minutes_per_day" integer DEFAULT 45 NOT NULL,
	"words_per_minute" integer DEFAULT 185 NOT NULL,
	"words_per_page" integer DEFAULT 275 NOT NULL,
	"plan_granularity" text DEFAULT 'quarter' NOT NULL,
	"theme" text DEFAULT 'system' NOT NULL,
	"show_covers" boolean DEFAULT true NOT NULL,
	CONSTRAINT "reading_settings_plan_granularity_check" CHECK ("reading_settings"."plan_granularity" IN ('quarter', 'month')),
	CONSTRAINT "reading_settings_theme_check" CHECK ("reading_settings"."theme" IN ('system', 'light', 'dark'))
);
--> statement-breakpoint
CREATE TABLE "shelf_books" (
	"shelf_id" text NOT NULL,
	"book_id" text NOT NULL,
	"ordinal" integer NOT NULL,
	CONSTRAINT "shelf_books_shelf_id_book_id_pk" PRIMARY KEY("shelf_id","book_id")
);
--> statement-breakpoint
CREATE TABLE "shelves" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	CONSTRAINT "shelves_kind_check" CHECK ("shelves"."kind" IN ('books', 'titles'))
);
--> statement-breakpoint
CREATE TABLE "volume_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"series" text NOT NULL,
	"run_id" text,
	"issue_from" integer,
	"issue_to" integer,
	"year" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "book_status" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "word_count_source" text;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "page_count" integer;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "cover_url" text;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "open_library_id" text;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "hardcover_id" integer;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "run_issues" ADD COLUMN "era_id" integer;--> statement-breakpoint
ALTER TABLE "run_issues" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "eras" ADD CONSTRAINT "eras_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_settings" ADD CONSTRAINT "reading_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shelf_books" ADD CONSTRAINT "shelf_books_shelf_id_shelves_id_fk" FOREIGN KEY ("shelf_id") REFERENCES "public"."shelves"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shelf_books" ADD CONSTRAINT "shelf_books_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shelves" ADD CONSTRAINT "shelves_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volume_rules" ADD CONSTRAINT "volume_rules_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_issues" ADD CONSTRAINT "run_issues_era_id_run_id_eras_fk" FOREIGN KEY ("era_id","run_id") REFERENCES "public"."eras"("id","run_id") ON DELETE SET NULL ("era_id") ON UPDATE no action;--> statement-breakpoint
-- A loaded database already holds books with a word count, all typed into the
-- workbook, so they are stated. Without this the CHECK below refuses them.
UPDATE "books" SET "word_count_source" = 'stated' WHERE "word_count" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_word_count_source_check" CHECK (
    ("books"."word_count" IS NULL) = ("books"."word_count_source" IS NULL)
    AND ("books"."word_count_source" IS NULL OR "books"."word_count_source" IN ('stated', 'estimated')));--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_verdict_check" CHECK ("events"."verdict" IS NULL OR "events"."verdict" IN ('read-it', 'tie-ins-only', 'summary-is-fine'));--> statement-breakpoint
ALTER TABLE "prereqs" ADD CONSTRAINT "prereqs_type_check" CHECK ("prereqs"."type" IN ('hard', 'soft'));--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_tier_check" CHECK ("runs"."tier" IS NULL OR "runs"."tier" BETWEEN 1 AND 5);