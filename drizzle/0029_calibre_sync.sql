CREATE TABLE "calibre_decisions" (
	"calibre_id" integer PRIMARY KEY NOT NULL,
	"decision" text NOT NULL,
	"book_id" text,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calibre_decisions_decision_check" CHECK (
    "calibre_decisions"."decision" IN ('merge', 'separate') AND ("calibre_decisions"."decision" = 'merge') = ("calibre_decisions"."book_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "calibre_syncs" (
	"id" serial PRIMARY KEY NOT NULL,
	"ran_at" timestamp with time zone DEFAULT now() NOT NULL,
	"report" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calibre_decisions" ADD CONSTRAINT "calibre_decisions_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;