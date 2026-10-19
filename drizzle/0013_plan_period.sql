-- Task 1.7 (D-37, D-38, R0-04): one period column on reading_plan. A plan row
-- sits at a quarter ('2027-Q1', ordered), a year ('2027') or On deck
-- ('on_deck'); its year is derived from the period, so it can never disagree
-- with the quarter. Someday is every to_read book with no plan row.
-- Hand-edited from drizzle-kit's output: the period is composed from the
-- legacy columns before they go, existing quarter rows are numbered by
-- books.title, then book_id, and the quarter order's UNIQUE is DEFERRABLE
-- INITIALLY DEFERRED, which drizzle can't express (the snapshot matches
-- src/db/schema.ts all the same). A book held in two years keeps both rows.
-- plan_granularity goes too: there are no months (D-38).
-- Down: drizzle/down/0013_plan_period.sql (refuses while an on_deck row exists).
ALTER TABLE "reading_plan" ADD COLUMN "period" text;--> statement-breakpoint
ALTER TABLE "reading_plan" ADD COLUMN "ordinal" integer;--> statement-breakpoint
UPDATE "reading_plan"
SET "period" = "planned_year"::text || COALESCE('-Q' || "planned_quarter", '');--> statement-breakpoint
UPDATE "reading_plan" p
SET "ordinal" = n.rn
FROM (
  SELECT rp.user_id, rp.book_id, rp.period,
         row_number() OVER (PARTITION BY rp.user_id, rp.period ORDER BY b.title, rp.book_id) AS rn
  FROM "reading_plan" rp
  JOIN "books" b ON b.id = rp.book_id
  WHERE rp.planned_quarter IS NOT NULL
) n
WHERE p.user_id = n.user_id AND p.book_id = n.book_id AND p.period = n.period;--> statement-breakpoint
ALTER TABLE "reading_plan" ALTER COLUMN "period" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "reading_plan" DROP CONSTRAINT "reading_plan_user_id_book_id_planned_year_pk";--> statement-breakpoint
ALTER TABLE "reading_plan" ADD CONSTRAINT "reading_plan_user_id_book_id_period_pk" PRIMARY KEY("user_id","book_id","period");--> statement-breakpoint
ALTER TABLE "reading_plan" DROP COLUMN "planned_year";--> statement-breakpoint
ALTER TABLE "reading_plan" DROP COLUMN "planned_quarter";--> statement-breakpoint
ALTER TABLE "reading_plan" ADD CONSTRAINT "reading_plan_quarter_order" UNIQUE("user_id","period","ordinal") DEFERRABLE INITIALLY DEFERRED;--> statement-breakpoint
ALTER TABLE "reading_plan" ADD CONSTRAINT "reading_plan_period_check" CHECK ("reading_plan"."period" ~ '^[0-9]{4}(-Q[1-4])?$' OR "reading_plan"."period" = 'on_deck');--> statement-breakpoint
ALTER TABLE "reading_plan" ADD CONSTRAINT "reading_plan_ordinal_check" CHECK (("reading_plan"."ordinal" IS NULL) = ("reading_plan"."period" !~ '-Q'));--> statement-breakpoint
ALTER TABLE "reading_settings" DROP CONSTRAINT "reading_settings_plan_granularity_check";--> statement-breakpoint
ALTER TABLE "reading_settings" DROP COLUMN "plan_granularity";
