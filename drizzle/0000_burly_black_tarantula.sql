CREATE TABLE IF NOT EXISTS "authors" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "book_series" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"author_id" text,
	"total_books" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "book_status" (
	"user_id" text NOT NULL,
	"book_id" text NOT NULL,
	"status" text DEFAULT 'to_read' NOT NULL,
	"finished_year" integer,
	"year_rank" integer,
	"rating" double precision,
	"finished_on" text,
	CONSTRAINT "book_status_user_id_book_id_pk" PRIMARY KEY("user_id","book_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "books" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"author_id" text,
	"series_id" text,
	"series_position" real,
	"genre" text,
	"book_type" text DEFAULT 'Novel' NOT NULL,
	"word_count" integer,
	"published_year" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "edition_progress" (
	"user_id" text NOT NULL,
	"edition_id" text NOT NULL,
	"collected" boolean DEFAULT false NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	CONSTRAINT "edition_progress_user_id_edition_id_pk" PRIMARY KEY("user_id","edition_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "editions" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"book_type" text,
	"author" text,
	"character" text,
	"year" integer,
	"issues_text" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_tracks" (
	"event_id" text NOT NULL,
	"track_id" text NOT NULL,
	CONSTRAINT "event_tracks_event_id_track_id_pk" PRIMARY KEY("event_id","track_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "events" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"year" integer,
	"verdict" text,
	"home_run_id" text,
	"note" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "external_lists" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"year" integer,
	"rank" integer,
	"raw_title" text NOT NULL,
	"book_id" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "issue_progress" (
	"user_id" text NOT NULL,
	"issue_id" text NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "issue_progress_user_id_issue_id_pk" PRIMARY KEY("user_id","issue_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "issues" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"sequence" integer NOT NULL,
	"label" text NOT NULL,
	"type" text DEFAULT 'core' NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "prereqs" (
	"run_id" text NOT NULL,
	"prereq_run_id" text NOT NULL,
	"type" text NOT NULL,
	CONSTRAINT "prereqs_run_id_prereq_run_id_pk" PRIMARY KEY("run_id","prereq_run_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reading_plan" (
	"user_id" text NOT NULL,
	"book_id" text NOT NULL,
	"planned_year" integer NOT NULL,
	"planned_quarter" integer,
	CONSTRAINT "reading_plan_user_id_book_id_planned_year_pk" PRIMARY KEY("user_id","book_id","planned_year")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "releases" (
	"book_id" text PRIMARY KEY NOT NULL,
	"release_date" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "run_tracks" (
	"run_id" text NOT NULL,
	"track_id" text NOT NULL,
	CONSTRAINT "run_tracks_run_id_track_id_pk" PRIMARY KEY("run_id","track_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "runs" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"writer" text,
	"artists" text,
	"series_issues" text,
	"start_year" integer,
	"end_year" integer,
	"tier" integer,
	"block" integer,
	"sequence" integer,
	"spine" boolean DEFAULT false NOT NULL,
	"rating" integer,
	"why" text,
	"notes" text,
	"placeholder" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tracks" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"publisher" text DEFAULT 'Marvel' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wishlist" (
	"id" serial PRIMARY KEY NOT NULL,
	"genre" text,
	"raw_entry" text NOT NULL,
	"book_id" text
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "book_series" ADD CONSTRAINT "book_series_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "book_status" ADD CONSTRAINT "book_status_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "book_status" ADD CONSTRAINT "book_status_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "books" ADD CONSTRAINT "books_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "books" ADD CONSTRAINT "books_series_id_book_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."book_series"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "edition_progress" ADD CONSTRAINT "edition_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "edition_progress" ADD CONSTRAINT "edition_progress_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_tracks" ADD CONSTRAINT "event_tracks_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_tracks" ADD CONSTRAINT "event_tracks_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "events" ADD CONSTRAINT "events_home_run_id_runs_id_fk" FOREIGN KEY ("home_run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "external_lists" ADD CONSTRAINT "external_lists_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "issue_progress" ADD CONSTRAINT "issue_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "issue_progress" ADD CONSTRAINT "issue_progress_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "issues" ADD CONSTRAINT "issues_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prereqs" ADD CONSTRAINT "prereqs_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prereqs" ADD CONSTRAINT "prereqs_prereq_run_id_runs_id_fk" FOREIGN KEY ("prereq_run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reading_plan" ADD CONSTRAINT "reading_plan_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reading_plan" ADD CONSTRAINT "reading_plan_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "releases" ADD CONSTRAINT "releases_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "run_tracks" ADD CONSTRAINT "run_tracks_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "run_tracks" ADD CONSTRAINT "run_tracks_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wishlist" ADD CONSTRAINT "wishlist_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
