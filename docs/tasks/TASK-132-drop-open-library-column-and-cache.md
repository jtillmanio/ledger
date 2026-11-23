---
id: TASK-132
title: 6.19 Remove Open Library (2 of 2) — the column, the cache table, the client and the documents
status: In progress
depends_on: [TASK-131]
size: M
model: opus
autonomy: attended
ui: false
plan_status: approved
planned_at_commit: 0f7d74c
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
- *From TASK-131 (PR #325):* (1) `etl/test_views.sql` asserts the books catalog columns from `information_schema` (around line 1249) and still lists `open_library_id`; its list drops the column with this migration. (2) Since TASK-131 every load leaves `books.open_library_id` NULL, so *metadata pending* already marks the books known only from 1.14's rows (about 2,000 on the committed `book_details.csv`), and `Cover` draws the pending box before it reads `cover_url`, so their covers hide until this task changes *pending*: land it before rebuilding a database the owner looks at. (3) The lowercase `open library` review reason stays in `etl/extract.py` (`RETIRED_LOOKUP`) and in tests and fixtures (`etl/testdata/before-6.19/`): decided rows stay (the entry), so AC-1's `Open Library` is read case-sensitively over `etl/*.py`, which no longer names `open_library`, `openlibrary` or `Open Library`.

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

- (approved at plan) Before the Release that carries 0035: about 2,000 production books known only by an Open Library id turn *metadata pending*, and `Cover` / `RowCover` draw the pending box ahead of a known `cover_url` (about 1,750 such books on the 2026-11-23 extract, where the committed `book_details.csv` has 98 Hardcover rows). Run a full `npm run enrich:books` then extract (production is rebuildable until cutover) or the 4.2 backfill, and decide whether a pending book with a cover should draw it. → owner checklist
- (approved at plan) `etl/.openlibrary-cache.sqlite` leaves `.gitignore`, so the owner's copy shows as untracked: delete it. → owner checklist
- (approved at plan) The e2e specs' `openLibrary()` helpers (`covers`, `follows`, `plan-picker`) open the Library page, not the source → not tracked: not Open Library, and `test/` is outside AC-1's grep

## Plan

Approved 2026-11-23 (owner pre-approved the recommended options). Schema change confirmed at the gate (CLAUDE.md *Stop and ask*): drop `books.open_library_id` and `open_library_cache`.

**Steps**

1. Migration `drizzle/0035_drop_open_library.sql` from `npm run db:generate` (with `--name drop_open_library`), header hand-written: drop `open_library_cache`, drop `books.open_library_id`. No view at any commit has named either (`git log -S open_library_id -- etl/views.sql` and the same for the table: nothing), so production at its oldest live `views.sql` holds no dependency and no `pg_depend` sweep is needed; a bare `DROP COLUMN` would fail loudly, never silently, if one existed, and the test asserts through `pg_depend` that no view depends on the column before the up. `drizzle/down/0035_drop_open_library.sql` re-creates both in their old shape; ids come back NULL (lossy by nature: a dropped column keeps no values; AC-2).
2. `src/`: delete `src/lib/openlibrary.ts` (no test file exists; nothing imports it). `src/db/schema.ts` drops `openLibraryId` and `openLibraryCache` (the `hardcoverCache` comment stops naming it); `src/db/export-tables.ts` drops it from `NOT_EXPORTED`; `src/db/writes.ts` drops `BookRow.openLibraryId`; `src/db/queries.ts` *pending* = `b.hardcover_id IS NULL` in `listBooks`, `topBooksYear`, `rankSorterRead`, `bookDetail`, `librarySearch`, and the doc comment; `Cover.tsx` / `CoverImage.tsx` comments.
3. Tests: new `test/open-library-drop-migration.test.ts` (up → down → up; *pending* through the five queries; the grep guard over `src/` and `etl/*.py`). `test/db.ts` and `test/comics-load.test.ts` (the cache), `test/schema-additions.test.ts` and `test/hardcover-search.test.ts` (the column), `test/add-book.test.ts` (comment), `etl/test_views.sql` (the books catalog columns).
4. Documents: `docs/02-architecture.md`, `docs/03-data-model.md`, `docs/01-product.md`, `docs/HANDOFF.md`, `design/mockups.html` + `design/mockups-index.md`, `.gitignore`, `.claude/rules/git.md` (never-commit list and Project notes), `.claude/kit.json` (the `largeFiles` hint reworded: retired, delete it). Under the Goal (*no document still names it as a source*), also `docs/04-design.md` § Live-API states, `docs/DIAGRAMS.md`, `docs/SERVICES.md` (Open Library: Retired, 6.19). `.claude/rules/schema.md` unchanged: its lines describe `book_details.csv`, which still holds 1.14's rows (TASK-131's ETL). `CLAUDE.md` unchanged: it lists no caches.

**Files**: `drizzle/0035_drop_open_library.sql`, `drizzle/down/0035_drop_open_library.sql`, `drizzle/meta/0035_snapshot.json`, `drizzle/meta/_journal.json`; `src/db/{schema,queries,writes,export-tables}.ts`; `src/lib/openlibrary.ts` (deleted); `src/components/{Cover,CoverImage}.tsx`; `test/open-library-drop-migration.test.ts` (new); `test/{db,comics-load.test,schema-additions.test,hardcover-search.test,add-book.test}.ts`; `etl/test_views.sql` (not in Files likely touched; TASK-131's note); the documents above (`docs/04-design.md`, `docs/DIAGRAMS.md`, `docs/SERVICES.md` not in Files likely touched).

**Test strategy**

- AC-1: `test/open-library-drop-migration.test.ts` › "goes down and up again…" (up → down → up) and "src/ and etl/*.py name no open_library, openlibrary or Open Library" (case-sensitive `Open Library`, per TASK-131's note); `npm run check:migrations`; `npm run test:all` = CI's full run (D-141).
- AC-2: the same up → down → up test: shape after up (no column, no table), after down (column `text` nullable, table's three columns with their types), the seeded books' ids NULL after down, other columns unchanged.
- AC-3: `test/open-library-drop-migration.test.ts` › "metadata pending marks only the book with no Hardcover id" through `listBooks`, `topBooksYear`, `rankSorterRead`, `bookDetail`, `librarySearch`.
- AC-4: the grep guard plus a manual `grep` over the six documents, `.gitignore` and `git.md`.
- AC-5: `test/export-tables.test.ts` unchanged and green (the table leaves the schema and the list together).

**What the owner sees** (fresh extract, 2026-11-23): 4,292 of 4,390 books have no Hardcover id, *pending* before and after this task (TASK-131 already NULLs the column on a load). Against a database loaded before TASK-131 (production), up to 2,000 books with only an Open Library id turn *pending*; about 1,750 have a cover the pending box hides. Follow-up (a).

**Size**: ~30 files, over the line, kept whole: this is part 2 of the entry's split, and the documents add files but no layer (Context).

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
