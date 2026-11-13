ALTER TABLE "read_events" ADD COLUMN "year_rank" integer;--> statement-breakpoint
-- Hand-edited (task 3.4b, D-101): a rank belongs to a read, so a book reread in
-- another year can rank in both. 3.4's ranks move from the book to its latest
-- read, the read whose finish book_status.finished_on mirrors (D-133), where
-- its finish year is the one the rank was in. A ranked `read` status with no
-- log row (book_reads' second branch) has its read logged first, with the
-- status's finish, as saveBookStatus logs one when it leaves `read`.
-- Lossless down for every rank but an earlier read's in another year:
-- drizzle/down/0026_rank_on_read.sql.
INSERT INTO "read_events" ("user_id", "book_id", "finished_on", "finished_on_precision")
SELECT s."user_id", s."book_id", s."finished_on", s."finished_on_precision"
FROM "book_status" s
WHERE s."year_rank" IS NOT NULL AND s."status" = 'read' AND s."finished_on" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "read_events" e WHERE e."user_id" = s."user_id" AND e."book_id" = s."book_id");--> statement-breakpoint
UPDATE "read_events" e
SET "year_rank" = s."year_rank"
FROM "book_status" s
WHERE s."year_rank" IS NOT NULL AND e."user_id" = s."user_id" AND e."book_id" = s."book_id"
  AND e."id" = (SELECT max(l."id") FROM "read_events" l WHERE l."user_id" = s."user_id" AND l."book_id" = s."book_id")
  AND extract(year FROM e."finished_on") = extract(year FROM s."finished_on");--> statement-breakpoint
-- A rank no read could take (no finish, or a latest read in another year) is
-- named here, never dropped silently (D-93); the next rank write heals its year.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT s."book_id", s."year_rank" FROM "book_status" s
    WHERE s."year_rank" IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM "read_events" e
      WHERE e."user_id" = s."user_id" AND e."book_id" = s."book_id" AND e."year_rank" = s."year_rank")
  LOOP
    RAISE NOTICE 'rank % of % found no read to hold it', r."year_rank", r."book_id";
  END LOOP;
END $$;--> statement-breakpoint
ALTER TABLE "book_status" DROP COLUMN "year_rank";
