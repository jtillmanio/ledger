---
id: TASK-132
title: 6.19 Remove Open Library (2 of 2) — the column, the cache table, the client and the documents
status: Ready
depends_on: [TASK-131]
size: M
model: opus
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
---

# TASK-132 — 6.19 Remove Open Library (2 of 2) — the column, the cache table, the client and the documents

## Goal

Open Library is gone from the app: its id column, its cache table and its client are removed, and no document still names it as a source of book data.

## Context

- Roadmap: `docs/05-roadmap.md` § 6.19 Remove Open Library (D-94; owner, 2026-10-28: *both removals are approved*). Its **Check:** is AC-1, verbatim. Listed in `docs/06-tasklist.md` M21; pulled ahead of 1.26 (D-172).
- **Split, 2 of 2.** TASK-131 took it out of the ETL, so `load` no longer names the column. This part is the migration, `src/`, `test/` and the documents. The documents ride here because each names Open Library beside the code this part removes; they add files but no layer.
- **The schema change is approved in the entry** (dropping `books.open_library_id` and the `open_library_cache` table). The plan gate still confirms it, per CLAUDE.md *Stop and ask*. The migration drops a column and a table, so it ships `drizzle/down/<tag>.sql` and an up → down → up test (`.claude/rules/schema.md`; precedent `drizzle/0027_drop_books_genre.sql`, `drizzle/down/0027_drop_books_genre.sql` and `test/genre-drop-migration.test.ts`, TASK-089). Production lags `main` until a Release: no view in `etl/views.sql` names `open_library_id` today, and the plan says how it checks with `pg_depend` that none on the oldest live `views.sql` does.
- **What changes in meaning.** *Metadata pending* is `open_library_id IS NULL AND hardcover_id IS NULL` in five queries (`src/db/queries.ts`, around lines 580, 901, 936, 1041, 1688); it becomes `hardcover_id IS NULL`. A book with an Open Library id and no Hardcover id would turn *pending*. The plan counts them on a fresh extract (not a live database) and says what the owner sees.
- **What carries it in `src/` and `test/`:** `src/lib/openlibrary.ts` (deleted, with its tests); `src/db/schema.ts` (`openLibraryId` around line 295, `openLibraryCache` around line 698); `src/db/export-tables.ts` (`open_library_cache` in `NOT_EXPORTED`); `src/db/writes.ts` (`BookRow.openLibraryId`, set by nothing since 1.4f); comments in `src/components/Cover.tsx` and `CoverImage.tsx`; `test/db.ts`, `test/add-book.test.ts`, `test/schema-additions.test.ts`, `test/hardcover-search.test.ts`, `test/comics-load.test.ts`, and the e2e specs that mention it (`covers.spec.ts`'s `openLibrary` helper may be the Library page, not the source: the plan checks each). Covers don't depend on it: Add books accepts only Hardcover's CDN (`src/lib/hardcover.ts` `COVERS`).
- **The documents** (the entry's list, from TASK-040): `docs/02-architecture.md` § Metadata sources; `docs/03-data-model.md` 2.15; `docs/01-product.md` (the metadata row, F-15 and F-19 in the feature index, F-15's outcome, the 2.15 add table and its paragraph); `docs/HANDOFF.md` (the media table, the add rule, the API table, the live-API paragraph, the add-surface row); `design/mockups.html` (the `apistates` notes *Live-API states (Metron, TMDB, Open Library)* and *Same three lines on Open Library search*, and the shelf-detail note on *+ Add to shelf*) with `design/mockups-index.md`; `.gitignore` and `.claude/rules/git.md`'s never-commit list (`etl/.openlibrary-cache.sqlite`); `.claude/rules/schema.md`; the `largeFiles` hint in `.claude/kit.json` for `*.openlibrary-cache.sqlite`. The plan says whether `CLAUDE.md`'s list of caches changes too. `docs/archive/` is frozen and never edited. Decided `open library` rows in `book_review.csv` stay.
- Decisions: D-94, D-44, D-99. Hard rule 7 (the down migration).

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): the migration ships `drizzle/down/<tag>.sql` and passes an
  up → down → up test on the TEST database; `open_library`, `openlibrary` and
  `Open Library` appear nowhere in `src/` or `etl/*.py` outside `drizzle/`;
  `npm run test:all` is green.
- [ ] AC-2: After the up migration on the TEST database, `books` has no `open_library_id` column and `open_library_cache` does not exist; after the down, both are back with their types, and the column's values for the rows the test seeded are restored as NULL (the down says it restores the shape, not the ids).
- [ ] AC-3: Given a book with a `hardcover_id` and one with neither id, the Library's *metadata pending* marks only the second, read through every query that computed it.
- [ ] AC-4: `docs/02-architecture.md`, `docs/03-data-model.md`, `docs/01-product.md`, `docs/HANDOFF.md`, `design/mockups.html` and `design/mockups-index.md` no longer name Open Library as a source of book data, search or covers (a history note that says it was removed is allowed). `.gitignore` and `.claude/rules/git.md` no longer list `etl/.openlibrary-cache.sqlite`.
- [ ] AC-5: `src/db/export-tables.ts` no longer names `open_library_cache`, and its test still holds every table in `src/db/schema.ts` to one list.

## Out of scope

- Anything in the ETL (TASK-131).
- Deleting the owner's `etl/.openlibrary-cache.sqlite` from disk: it is gitignored and outside what Claude deletes unasked; the PR says the owner may delete it.
- Decided `open library` rows in `book_review.csv`.
- Running the migration anywhere but `TEST_DATABASE_URL`: Release takes it to production (START-HERE Step 13).

## Files likely touched

- `drizzle/<tag>.sql`, `drizzle/down/<tag>.sql`, `drizzle/meta/*` — the migration, from `npm run db:generate`.
- `src/db/schema.ts`, `src/db/queries.ts`, `src/db/writes.ts`, `src/db/export-tables.ts` — the column, the table, *pending*, the dead field.
- `src/lib/openlibrary.ts` and its test — deleted.
- `src/components/Cover.tsx`, `src/components/CoverImage.tsx` — comments.
- `test/open-library-drop-migration.test.ts` (new; the plan names it) — the up → down → up test.
- `test/db.ts`, `test/add-book.test.ts`, `test/schema-additions.test.ts`, `test/hardcover-search.test.ts`, `test/comics-load.test.ts` — the column gone.
- The documents in Context, `.gitignore`, `.claude/rules/git.md`, `.claude/rules/schema.md`, `.claude/kit.json` (`largeFiles` hint).

## Verification

- Automated: the up → down → up test and `npm run check:migrations` (AC-1, AC-2); the *pending* test (AC-3); `test/export-tables.test.ts` (AC-5); `npm run test:all` (AC-1).
- Manual: `grep -rn -i -E "open_library|openlibrary|open library" src etl/*.py` → expected: nothing (AC-1). On the dev server, after the owner allows `db:migrate` against development, the Library shows the same *metadata pending* books as before minus any the plan's count named.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

## Plan

_Written by /plan-batch or /implement-task Phase 1. Approved by the user (plan_status: approved) before any code is written._

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
