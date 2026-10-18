-- Task 1.16 (D-67): a calendar day in issue_progress.completed_at is stored as
-- its America/New_York midnight, no longer its UTC midnight (owner, 2026-10-10).
-- Data only, no column changes. A row exactly at a UTC midnight is a stored day
-- (a picked day, Spread, Year only's July 1st, Original dates copied from one)
-- and moves to the same calendar day's Eastern midnight, so it reads the same
-- day in Eastern. A Today read is now(), a moment, and keeps its value; a
-- 'none' read has a NULL date and is not touched.
-- Lossless down: drizzle/down/0012_dates_in_new_york.sql.
UPDATE "issue_progress"
SET "completed_at" = (("completed_at" AT TIME ZONE 'UTC')::date::timestamp AT TIME ZONE 'America/New_York')
WHERE "completed_at_precision" <> 'none'
  AND ("completed_at" AT TIME ZONE 'UTC')::time = '00:00';
