CREATE TABLE "book_genres" (
	"book_id" text NOT NULL,
	"genre" text NOT NULL,
	CONSTRAINT "book_genres_book_id_genre_pk" PRIMARY KEY("book_id","genre")
);
--> statement-breakpoint
ALTER TABLE "book_genres" ADD CONSTRAINT "book_genres_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE no action ON UPDATE no action;