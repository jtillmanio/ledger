-- Hand-edited (task 4.5, TASK-089, D-98): a book's genres come from Calibre
-- alone (book_genres, read through book_genre_levels), so the workbook's one
-- genre goes. Every view that reads the column goes first, CASCADE taking the
-- views built on it, found through pg_depend rather than by name (0007's
-- pattern): a database released before 4.5 (#252) has books_by_year reading
-- b.genre; one released after it has book_genre_levels, which books_by_year
-- reads. Release and db:views re-create them all from etl/views.sql, which no
-- longer names the column. plan_suggestions' body is a string, so it holds no
-- dependency; views.sql replaces it too. Lossy down, accepted at the plan gate
-- (owner, 2026-11-13): drizzle/down/0027_drop_books_genre.sql brings the column
-- back empty.
DO $$
DECLARE v text;
BEGIN
  FOR v IN
    SELECT DISTINCT c.oid::regclass::text
    FROM pg_depend d
    JOIN pg_rewrite rw ON rw.oid = d.objid
    JOIN pg_class c    ON c.oid = rw.ev_class AND c.relkind = 'v'
    WHERE d.classid = 'pg_rewrite'::regclass
      AND d.refclassid = 'pg_class'::regclass
      AND d.refobjid = 'books'::regclass
      AND d.refobjsubid = (SELECT a.attnum FROM pg_attribute a
                           WHERE a.attrelid = 'books'::regclass AND a.attname = 'genre' AND NOT a.attisdropped)
  LOOP
    EXECUTE format('DROP VIEW IF EXISTS %s CASCADE', v);
  END LOOP;
END $$;--> statement-breakpoint
ALTER TABLE "books" DROP COLUMN "genre";
