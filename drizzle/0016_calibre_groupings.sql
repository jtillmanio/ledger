CREATE TABLE "book_subseries" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"series_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "universe_position" real;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "subseries_id" text;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "subseries_position" real;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "calibre_id" integer;--> statement-breakpoint
ALTER TABLE "book_subseries" ADD CONSTRAINT "book_subseries_series_id_book_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."book_series"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_subseries_id_book_subseries_id_fk" FOREIGN KEY ("subseries_id") REFERENCES "public"."book_subseries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_calibre_id_key" UNIQUE("calibre_id");