CREATE TABLE "read_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"book_id" text,
	"placement_id" integer,
	"finished_on" date,
	"finished_on_precision" text DEFAULT 'exact' NOT NULL,
	"reread_of" integer,
	CONSTRAINT "read_events_one_item_check" CHECK (num_nonnulls("read_events"."book_id", "read_events"."placement_id") = 1),
	CONSTRAINT "read_events_finished_on_precision_check" CHECK (
    "read_events"."finished_on_precision" IN ('exact', 'approximate', 'none')
    AND ("read_events"."finished_on" IS NULL) = ("read_events"."finished_on_precision" = 'none'))
);
--> statement-breakpoint
ALTER TABLE "read_events" ADD CONSTRAINT "read_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "read_events" ADD CONSTRAINT "read_events_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "read_events" ADD CONSTRAINT "read_events_placement_id_run_issues_id_fk" FOREIGN KEY ("placement_id") REFERENCES "public"."run_issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "read_events" ADD CONSTRAINT "read_events_reread_of_read_events_id_fk" FOREIGN KEY ("reread_of") REFERENCES "public"."read_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "read_events_user_book_idx" ON "read_events" USING btree ("user_id","book_id");--> statement-breakpoint
CREATE INDEX "read_events_user_placement_idx" ON "read_events" USING btree ("user_id","placement_id");--> statement-breakpoint
-- Hand-edited (task 1.5, D-21). A year-only finish becomes that year's July 1st,
-- 'approximate', never 'exact'; a row that already has a finish date keeps it,
-- and a row with neither stays NULL / 'none'. books_by_year reads the column, so
-- it goes first; db:views / Release re-create it from etl/views.sql on finished_on.
-- Lossless down: drizzle/down/0011_dated_reading_log.sql.
DROP VIEW IF EXISTS "books_by_year";--> statement-breakpoint
UPDATE "book_status"
SET "finished_on" = make_date("finished_year", 7, 1), "finished_on_precision" = 'approximate'
WHERE "finished_year" IS NOT NULL AND "finished_on" IS NULL;--> statement-breakpoint
ALTER TABLE "book_status" DROP COLUMN "finished_year";