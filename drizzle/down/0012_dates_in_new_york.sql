-- Reverses 0012_dates_in_new_york.sql. Run by hand, in one transaction so a
-- failure leaves nothing half-reverted:
--   psql "$URL" -1 -v ON_ERROR_STOP=1 -f drizzle/down/0012_dates_in_new_york.sql
-- drizzle-kit does not run it; delete 0012's row from
-- drizzle.__drizzle_migrations before migrating up again.
--
-- Lossless (S-10): a row exactly at an Eastern midnight is a stored day and goes
-- back to that calendar day's UTC midnight, which the next up moves forward
-- again. A now() read keeps its value, and a 'none' row keeps its NULL date and
-- its precision. The one row either direction would misread is a Today read
-- stamped at exactly 00:00:00.000000 (UTC going up, Eastern coming down), which
-- microsecond timestamps make negligible.
UPDATE "issue_progress"
SET "completed_at" = (("completed_at" AT TIME ZONE 'America/New_York')::date::timestamp AT TIME ZONE 'UTC')
WHERE "completed_at_precision" <> 'none'
  AND ("completed_at" AT TIME ZONE 'America/New_York')::time = '00:00';
