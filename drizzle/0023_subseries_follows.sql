CREATE TABLE "subseries_follows" (
	"subseries_id" text PRIMARY KEY NOT NULL,
	"state" text DEFAULT 'tracking' NOT NULL,
	CONSTRAINT "subseries_follows_state_check" CHECK ("subseries_follows"."state" IN ('tracking', 'reading', 'off'))
);
--> statement-breakpoint
ALTER TABLE "series_follows" DROP CONSTRAINT "series_follows_state_check";--> statement-breakpoint
ALTER TABLE "universe_follows" DROP CONSTRAINT "universe_follows_state_check";--> statement-breakpoint
ALTER TABLE "subseries_follows" ADD CONSTRAINT "subseries_follows_subseries_id_book_subseries_id_fk" FOREIGN KEY ("subseries_id") REFERENCES "public"."book_subseries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series_follows" ADD CONSTRAINT "series_follows_state_check" CHECK ("series_follows"."state" IN ('tracking', 'reading', 'off'));--> statement-breakpoint
ALTER TABLE "universe_follows" ADD CONSTRAINT "universe_follows_state_check" CHECK ("universe_follows"."state" IN ('tracking', 'reading', 'off'));