-- Reverses 0011_dated_reading_log.sql. Run by hand, in one transaction so a
-- failure leaves nothing half-reverted:
--   psql "$URL" -1 -v ON_ERROR_STOP=1 -f drizzle/down/0011_dated_reading_log.sql
-- drizzle-kit does not run it; delete 0011's row from
-- drizzle.__drizzle_migrations before migrating up again, and re-apply
-- etl/views.sql after.
--
-- Lossless for book_status (S-10): finished_on and its precision were there
-- before 0011 and are left exactly as they are; finished_year is put back as
-- their year. An 'approximate' July 1st comes back as its year and, on the next
-- up, finds its date already set and keeps it. A 'none' row keeps a NULL date
-- and a NULL year. Nothing is stamped with now().
--
-- The reading log itself has no home before 0011: read_events is dropped, and
-- its rows with it. book_status still holds each book's latest read.
DROP VIEW IF EXISTS "books_by_year";
DROP VIEW IF EXISTS "book_reads";
-- etl/views.sql's index on extract(year FROM finished_on): an older views.sql
-- creates its own status_user_year only IF NOT EXISTS, so it has to go too.
DROP INDEX IF EXISTS "status_user_year";
DROP TABLE IF EXISTS "read_events";
ALTER TABLE "book_status" ADD COLUMN "finished_year" integer;
UPDATE "book_status" SET "finished_year" = extract(year FROM "finished_on")::int
WHERE "finished_on" IS NOT NULL;
