CREATE TABLE "inbox" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"raw_text" text NOT NULL,
	"kind" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"book_id" text,
	"run_id" text,
	CONSTRAINT "inbox_kind_check" CHECK ("inbox"."kind" IS NULL OR "inbox"."kind" IN ('books', 'comics', 'watch')),
	CONSTRAINT "inbox_raw_text_check" CHECK (btrim("inbox"."raw_text") <> ''),
	CONSTRAINT "inbox_one_link_check" CHECK (num_nonnulls("inbox"."book_id", "inbox"."run_id") <= 1),
	CONSTRAINT "inbox_linked_resolved_check" CHECK (("inbox"."book_id" IS NULL AND "inbox"."run_id" IS NULL) OR "inbox"."resolved_at" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "inbox" ADD CONSTRAINT "inbox_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox" ADD CONSTRAINT "inbox_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox" ADD CONSTRAINT "inbox_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inbox_open_idx" ON "inbox" USING btree ("user_id","created_at" DESC NULLS LAST) WHERE "inbox"."resolved_at" IS NULL;