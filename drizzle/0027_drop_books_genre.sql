-- Hand-edited (task 4.5, TASK-089, D-98): a book's genres come from Calibre
-- alone (book_genres, read through book_genre_levels), so the workbook's one
-- genre goes. 4.5's book_genre_levels read it for a book Calibre gives none,
-- and books_by_year reads that view, so both go first (CASCADE); Release and
-- db:views re-create them from etl/views.sql, which no longer names the column
-- (0011's pattern). Lossy down, accepted at the plan gate (owner, 2026-11-13):
-- drizzle/down/0027_drop_books_genre.sql brings the column back empty.
DROP VIEW IF EXISTS "book_genre_levels" CASCADE;--> statement-breakpoint
ALTER TABLE "books" DROP COLUMN "genre";
