CREATE TABLE "owned_copies" (
	"book_id" text NOT NULL,
	"format" text NOT NULL,
	CONSTRAINT "owned_copies_book_id_format_pk" PRIMARY KEY("book_id","format"),
	CONSTRAINT "owned_copies_format_check" CHECK ("owned_copies"."format" IN ('physical', 'audio'))
);
--> statement-breakpoint
ALTER TABLE "owned_copies" ADD CONSTRAINT "owned_copies_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;