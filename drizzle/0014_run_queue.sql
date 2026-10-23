-- Task 1.10 (data model 2.16): the comics Up next queue, one ordered list of
-- runs per user with no dates. Ordinals are contiguous from 1, and a reorder
-- or removal rewrites them in one transaction, so the order's UNIQUE is
-- DEFERRABLE INITIALLY DEFERRED, which drizzle can't express (hand-edited; the
-- snapshot matches src/db/schema.ts all the same). Creates only: no down file.
CREATE TABLE "run_queue" (
	"user_id" text NOT NULL,
	"run_id" text NOT NULL,
	"ordinal" integer NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "run_queue_user_id_run_id_pk" PRIMARY KEY("user_id","run_id"),
	CONSTRAINT "run_queue_order" UNIQUE("user_id","ordinal") DEFERRABLE INITIALLY DEFERRED
);
--> statement-breakpoint
ALTER TABLE "run_queue" ADD CONSTRAINT "run_queue_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_queue" ADD CONSTRAINT "run_queue_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;
