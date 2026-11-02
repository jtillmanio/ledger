-- Reverses 0019_drop_wishlist.sql. Run by hand, in one transaction so a
-- failure leaves nothing half-reverted:
--   psql "$URL" -1 -v ON_ERROR_STOP=1 -f drizzle/down/0019_drop_wishlist.sql
-- drizzle-kit does not run it; delete 0019's row from
-- drizzle.__drizzle_migrations before migrating up again.
--
-- The table comes back as 0000 made it, empty. Its rows were the old To-Read
-- tab's lines, which extract settles into etl/data/wishlist_review.csv since
-- task 1.27 (D-111): an older extract and load write them again, so nothing
-- that only lived here is lost.
CREATE TABLE "wishlist" (
	"id" serial PRIMARY KEY NOT NULL,
	"genre" text,
	"raw_entry" text NOT NULL,
	"book_id" text
);
ALTER TABLE "wishlist" ADD CONSTRAINT "wishlist_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE no action ON UPDATE no action;
