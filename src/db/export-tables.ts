/**
 * Every table `GET /api/export` returns — the exit ramp (D-17). A task that
 * creates a table adds it here in the same PR; `test/export-tables.test.ts`
 * compares these lists with the database and fails on any table missing.
 */

/** Catalog tables: exported whole. */
export const CATALOG_TABLES = [
  "tracks", "blocks", "runs", "run_tracks", "issues", "run_issues", "creators",
  "issue_credits", "prereqs", "events", "event_runs",
  "eras", "volume_rules",
  "editions", "authors", "book_series", "books", "releases", "wishlist",
  "external_lists", "shelf_books",
] as const;

/** Tables with a `user_id` column: exported for the signed-in user only. */
export const USER_TABLES = [
  "issue_progress", "edition_progress", "book_status", "reading_plan",
  "reading_settings", "shelves", "inbox", "read_events", "run_queue",
] as const;

/** Deliberately left out: the export is the owner's data, not the account (D-17), nor a
 * rebuildable copy of a third-party API (D-53, D-62). */
export const NOT_EXPORTED = ["users", "metron_cache", "open_library_cache"] as const;
