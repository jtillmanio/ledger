-- Reverses 0026_rank_on_read.sql. Run by hand, in one transaction so a
-- failure leaves nothing half-reverted:
--   psql "$URL" -1 -v ON_ERROR_STOP=1 -f drizzle/down/0026_rank_on_read.sql
-- drizzle-kit does not run it; delete 0026's row from
-- drizzle.__drizzle_migrations before migrating up again.
--
-- One book_status row holds one rank, so the book takes its latest read's
-- (the highest read_events.id): the read whose finish book_status.finished_on
-- mirrors (D-133), so 3.4's code reads the rank in that read's year (owner at
-- 3.4b's plan gate, 2026-11-13). A rank on an earlier read of the same book, in
-- another year, is lost going down; the gap it leaves is healed by the next
-- rank write to that year. A read 0026 logged for a ranked status stays: it is
-- the read book_reads counted from the status, so every year counts the same.
ALTER TABLE "book_status" ADD COLUMN "year_rank" integer;
UPDATE "book_status" s
SET "year_rank" = e."year_rank"
FROM "read_events" e
WHERE e."user_id" = s."user_id" AND e."book_id" = s."book_id" AND e."year_rank" IS NOT NULL
  AND e."id" = (SELECT max(l."id") FROM "read_events" l WHERE l."user_id" = s."user_id" AND l."book_id" = s."book_id");
ALTER TABLE "read_events" DROP COLUMN "year_rank";
