CREATE TABLE "shelf_follows" (
	"shelf_id" text PRIMARY KEY NOT NULL,
	"state" text DEFAULT 'tracking' NOT NULL,
	CONSTRAINT "shelf_follows_state_check" CHECK ("shelf_follows"."state" IN ('tracking', 'reading'))
);
--> statement-breakpoint
ALTER TABLE "shelf_follows" ADD CONSTRAINT "shelf_follows_shelf_id_shelves_id_fk" FOREIGN KEY ("shelf_id") REFERENCES "public"."shelves"("id") ON DELETE cascade ON UPDATE no action;