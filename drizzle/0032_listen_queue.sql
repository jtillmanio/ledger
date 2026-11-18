-- Task 5.14 (TASK-106, F-59): the audiobooks you mean to listen to next, in
-- order, the same shape as 0014's run_queue (data model 2.16) with no user_id
-- (D-91). Positions are contiguous from 1, and a move or removal rewrites them
-- in one transaction, so the order's UNIQUE is DEFERRABLE INITIALLY DEFERRED,
-- which drizzle can't express (hand-edited; the snapshot matches
-- src/db/schema.ts all the same). Creates only: no down file.
CREATE TABLE "listen_queue" (
	"book_id" text PRIMARY KEY NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "listen_queue_order" UNIQUE("position") DEFERRABLE INITIALLY DEFERRED
);
--> statement-breakpoint
ALTER TABLE "listen_queue" ADD CONSTRAINT "listen_queue_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;
