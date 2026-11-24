-- Reverses 0035_drop_open_library.sql. Run by hand, in one transaction so a
-- failure leaves nothing half-reverted:
--   psql "$URL" -1 -v ON_ERROR_STOP=1 -f drizzle/down/0035_drop_open_library.sql
-- drizzle-kit does not run it; delete 0035's row from
-- drizzle.__drizzle_migrations before migrating up again.
--
-- Lossy, accepted at the plan gate (owner, 2026-11-23; TASK-132): this
-- restores the shape, not the data. books.open_library_id comes back NULL on
-- every book, because a dropped column keeps no values, and open_library_cache
-- comes back empty (a rebuildable copy of Open Library's answers, read by
-- nothing since 1.4f). Before 1.26 a rebuild at a commit before TASK-131
-- refills the ids from etl/data/book_details.csv's 1.14 rows. Every other
-- column is untouched either way.
CREATE TABLE "open_library_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"body" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "books" ADD COLUMN "open_library_id" text;
