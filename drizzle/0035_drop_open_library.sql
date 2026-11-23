-- Hand-edited (task 6.19, TASK-132, D-94): Open Library is gone. Nothing has
-- read it since 1.4f (Add books asks Hardcover) and the ETL stopped writing
-- books.open_library_id in TASK-131, so its id column and its cache table go;
-- *metadata pending* is `hardcover_id IS NULL`. No view in etl/views.sql has
-- ever named either (git log -S at every commit), so a database at any older
-- release holds no dependency on them, and both drops are bare: drizzle-kit's
-- CASCADE is removed, so a dependency nobody knew of fails the migration
-- rather than taking a view with it. Lossy down, accepted at the plan gate
-- (owner, 2026-11-23): drizzle/down/0035_drop_open_library.sql restores the
-- shape, with the ids NULL and the cache empty.
DROP TABLE "open_library_cache";--> statement-breakpoint
ALTER TABLE "books" DROP COLUMN "open_library_id";
