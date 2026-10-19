-- Reverses 0013_plan_period.sql. Run by hand, in one transaction so a failure
-- leaves nothing half-reverted:
--   psql "$URL" -1 -v ON_ERROR_STOP=1 -f drizzle/down/0013_plan_period.sql
-- drizzle-kit does not run it; delete 0013's row from
-- drizzle.__drizzle_migrations before migrating up again, and re-apply
-- etl/views.sql after.
--
-- Lossless for every row the legacy columns can hold (S-10): a quarter row
-- comes back as its year and quarter, a year row as its year with a NULL
-- quarter, and a book held in two years keeps both rows. The quarter order has
-- no home before 0013; the next up numbers each quarter again by title, so it
-- is 1…N either way. plan_granularity comes back at its default, 'quarter'.
--
-- Refuses, changing nothing, while a row the legacy columns can't hold exists:
-- an On deck row has no year, and a book planned in a year and a quarter of
-- that year ('2027' and '2027-Q1') would be two rows under the legacy key
-- (user_id, book_id, planned_year). Move those books first.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "reading_plan" WHERE "period" = 'on_deck') THEN
    RAISE EXCEPTION 'reading_plan has On deck rows, which have no year before 0013: move them to a year or Someday first';
  END IF;
  IF EXISTS (SELECT 1 FROM "reading_plan" GROUP BY "user_id", "book_id", left("period", 4) HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'a book is planned in a year and a quarter of that year, which the legacy key cannot hold: move one first';
  END IF;
END $$;
DROP VIEW IF EXISTS "to_read_level";
DROP VIEW IF EXISTS "plan_period";
ALTER TABLE "reading_plan" ADD COLUMN "planned_year" integer;
ALTER TABLE "reading_plan" ADD COLUMN "planned_quarter" integer;
UPDATE "reading_plan"
SET "planned_year" = left("period", 4)::int,
    "planned_quarter" = CASE WHEN "period" ~ '-Q' THEN right("period", 1)::int END;
ALTER TABLE "reading_plan" ALTER COLUMN "planned_year" SET NOT NULL;
ALTER TABLE "reading_plan" DROP CONSTRAINT "reading_plan_user_id_book_id_period_pk";
ALTER TABLE "reading_plan" ADD CONSTRAINT "reading_plan_user_id_book_id_planned_year_pk" PRIMARY KEY("user_id","book_id","planned_year");
ALTER TABLE "reading_plan" DROP CONSTRAINT "reading_plan_quarter_order";
ALTER TABLE "reading_plan" DROP CONSTRAINT "reading_plan_period_check";
ALTER TABLE "reading_plan" DROP CONSTRAINT "reading_plan_ordinal_check";
ALTER TABLE "reading_plan" DROP COLUMN "ordinal";
ALTER TABLE "reading_plan" DROP COLUMN "period";
ALTER TABLE "reading_settings" ADD COLUMN "plan_granularity" text DEFAULT 'quarter' NOT NULL;
ALTER TABLE "reading_settings" ADD CONSTRAINT "reading_settings_plan_granularity_check" CHECK ("reading_settings"."plan_granularity" IN ('quarter', 'month'));
