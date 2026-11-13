---
id: TASK-089
title: 4.5 Calibre's genres on every screen (2 of 2) — drop books.genre
status: In progress
depends_on: [TASK-088]
size: M
model: opus
autonomy: attended
ui: false
plan_status: approved
planned_at_commit: b688fed
---

# TASK-089 — 4.5 Calibre's genres on every screen (2 of 2) — drop books.genre

## Goal

A book's genre has one source, Calibre's: the workbook's single genre column is gone, and no screen, total or load reads it.

## Context

- Roadmap: `docs/05-roadmap.md` § 4.5 Calibre's genres on every screen (M16). The entry and its **Check:** are the contract. Pulled ahead of 1.26 (D-139). This part's merge ticks the entry.
- **Split, 2 of 2.** TASK-088 moved every reader onto `book_genre_tree`, keeping `books.genre` only for a book with no Calibre genre. This part drops the column (D-98: *then `books.genre` is dropped*).
- **Stop and ask at plan time** (CLAUDE.md: changing a schema column):
  - the drop itself, with `drizzle/down/<tag>.sql` and an up → down → up test (`.claude/rules/schema.md`): the down file can restore the column but not its values once dropped. Before 1.26 the database is disposable and a rebuild refills it from the workbook; the plan says whether that loss is accepted or the values are kept somewhere for the down;
  - what a book with no Calibre genre shows and counts under once its fallback is gone (no genre at all is D-98's reading), on the Library, in `books_by_year` and in the plan rail's `--g8`.
- **Where `books.genre` is still named** after TASK-088: the schema (`src/db/schema.ts`); extract writes the workbook's genre into `seed/books.csv` (`etl/extract.py`; `seed/workbook_reads.csv` keeps its own `genre` column, which is a listing, not the load); the loaders' `\copy books(...)` column lists (`etl/load.ps1`, `etl/load.sh`); `etl/test_views.sql`'s catalog list; `plan_suggestions`' fallback (`etl/views.sql`, the `top_genre` CTE); TASK-088's fallbacks in `src/db/queries.ts`. `etl/load-comics.ps1` / `.sh` don't touch books.
- `etl/extract.py` is the migration from the workbooks: changing its output means re-running against both `.xlsx` files and diffing `seed/` (`.claude/rules/schema.md`).
- Decisions: D-90, D-98, D-139. Hard rules 2 and 7.
- *From TASK-088 (4.5, PR #252):* every reader now takes a book's genres through the view `book_genre_levels` (`etl/views.sql`), whose second `UNION ALL` branch (`books.genre` for a book with no `book_genres` row) is the only place `books.genre` is read. The drop removes that branch (and `top_genre`'s note in `plan_suggestions`); no query in `src/` or other view changes.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves *after the drop migration no query, view or loader names `books.genre`, and up → down → up keeps every `book_genres` row*. TASK-088 proves the filter and `books_by_year` clauses, before the drop): with one book given `book_genres` rows `Fantasy.Epic Fantasy` and
`Young Adult.Fantasy.Romantasy` and another with none and `books.genre` `Sci-Fi`,
the master list's genre filter finds the first under `Fantasy`, `Fantasy.Epic
Fantasy` and `Young Adult` and the second under `Sci-Fi`, and `books_by_year`
counts each; after the drop
migration no query, view or loader names `books.genre`, and up → down → up keeps
every `book_genres` row.
- [ ] AC-2: After the migration `books` has no `genre` column; `npm run test:db:reset` (migrate, then `etl/views.sql`) succeeds; a search of `src/`, `etl/*.py`, `etl/*.sql`, `etl/*.ps1` and `etl/*.sh` for `books.genre`, `b.genre` and the `genre` column of `books.csv` finds none (`seed/workbook_reads.csv`'s own column aside).
- [ ] AC-3: Up → down → up on a fixture with `book_genres` rows for two books keeps every `book_genres` row and its values; after the down `books.genre` exists again (with the values the plan gate settled); a precision-`none` read in the fixture is still `none` with a NULL date.
- [ ] AC-4: Extract over both workbooks writes `seed/books.csv` without a genre column and changes no other seed file except as the plan lists; `npm run test:etl` and `etl/test_views.sql` pass; `npm run rebuild` (development, asked first) loads.
- [ ] AC-5: A book with no Calibre genre renders and counts as the plan gate settled, on the Library and in `books_by_year`, with no error.

## Out of scope

- Moving readers (TASK-088).
- On deck by genre (4.5b, TASK-090).
- Removing `seed/workbook_reads.csv`'s `genre` column.

## Files likely touched

- `src/db/schema.ts`, `drizzle/<new migration>.sql`, `drizzle/meta/*`, `drizzle/down/<tag>.sql` — the drop.
- `etl/extract.py`, `etl/load.ps1`, `etl/load.sh` — no genre in `books.csv` or its `\copy`.
- `etl/views.sql`, `etl/test_views.sql` — the last fallbacks and the catalog list.
- `src/db/queries.ts` — TASK-088's fallbacks.
- `etl/test_extract.py`, `test/genre-drop-migration.test.ts` (new).

## Verification

- Automated: `test/genre-drop-migration.test.ts` (AC-1's up → down → up, AC-3), `npm run test:etl` and `etl/test_views.sql` (AC-4), `npm run check:migrations`.
- Manual: `npm run extract` against both workbooks, diff `seed/` → only `books.csv` loses its genre column; the PR reports the diff.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- `book_genre_levels` and `plan_suggestions` rows, and the 1.18c row, no longer name `books.genre` (approved at plan) → docs/03-data-model.md § 3. Views, § 4.1 By task

## Plan

Approved by the owner 2026-11-13 (attended). Plan-gate answers: keep the task whole (~30 files, most of them fixtures that must change with the drop); the down file restores `books.genre` as an all-NULL column (lossy, accepted: 1 seed book of 4,390 leaned on it, a to-read Fantasy, and the database is disposable before 1.26); a book with no Calibre genre has no genre at all (D-98): no genre on its Library row, under no chip, its read under NULL in `books_by_year`, `--g8` on the plan rail.

**Steps**
1. `src/db/schema.ts`: drop `books.genre`; `npm run db:generate` writes `drizzle/0027_*.sql` and its meta. Hand-edit the migration: `DROP VIEW IF EXISTS book_genre_levels CASCADE` (takes `books_by_year` with it) before the column drop, since dev and production hold 4.5's view, which names the column; Release re-creates both from `etl/views.sql` (0011's pattern).
2. `drizzle/down/0027_*.sql`: `ADD COLUMN genre text`, values NULL; header says why and how to run it.
3. `etl/views.sql`: `book_genre_levels` loses its workbook branch; comments on it, `books_by_year` and `plan_suggestions` updated.
4. `etl/extract.py`: genre leaves `BOOK_COLUMNS`, `upsert`/`new_book`, the merge fields and the wishlist fill; `workbook_reads`, `workbook_plans` and `wishlist_review` keep their own genre column.
5. `etl/load.ps1`, `etl/load.sh`: genre leaves `\copy books(...)`.
6. Fixtures: every `books(..., genre)` insert writes a `book_genres` row with the same value instead (identical `book_genre_levels` rows), or drops the genre where nothing reads it. Unit/SQL: `test/queries.test.ts`, `test/unlisted.test.ts`, `test/plan-rail.test.ts`, `test/plan-suggestions.test.ts`, `etl/test_views.sql` (catalog list, `zz-gy` fixtures), `etl/test_extract.py`. e2e: `test/e2e/global-setup.ts`, `status`, `start-dates`, `follows`, `book-list-search`, `audiobooks`, `library-sort`, `plan-rail`, `plan-rail-drag` specs. Tests of the workbook fallback (trim, Calibre over workbook) become "no Calibre genre, no genre".
7. `src/db/queries.ts`: comments only. `.claude/rules/schema.md`: the genre rule says what runs after the drop.

**Files**: as above, plus `test/genre-drop-migration.test.ts` (new). Outside "Files likely touched": the fixture files in step 6 and `.claude/rules/schema.md`.

**Test strategy**
- AC-1, AC-3: `test/genre-drop-migration.test.ts` › up → down → up in a rolled-back transaction: two books' `book_genres` rows and a precision-`none` read; after the down the column exists and is NULL; the old 4.5 `book_genre_levels` (naming `books.genre`) is re-created before the up, so the up proves the drop works on a database at 0026; every `book_genres` row and the `none` read survive.
- AC-2: the same file › no `genre` column on `books`; a scan of `src/`, `etl/*.py|sql|ps1|sh` finds no `books.genre` or `b.genre`, and the loaders' `\copy books(...)` names no genre. `npm run test:db:reset` passes.
- AC-4: `etl/test_extract.py` › `books.csv` header has no genre, `workbook_reads.csv` keeps its own; manual `npm run extract` and a `seed/` diff; `npm run rebuild` on development only when asked.
- AC-5: `test/queries.test.ts` (row genre null, no chip, filter finds it under none) and `etl/test_views.sql` (`books_by_year` counts it under NULL); `test/plan-rail.test.ts` already covers `--g8`.

**Risks**: a fixture missed only fails in the full browser suite (CI); grep `test/` for `genre)` / `, genre` before the first run. The migration's `DROP VIEW` leaves `plan_suggestions` (a string-body function) failing between migrate and views, as every Release already does.

**Revision 1 (during Phase 2, outside the file list, no behaviour change):** `test/audiobooks.test.ts`, `etl/test_enrich_books.py` (its `books.csv` fixture header; spec review R1), `test/plan-page.test.tsx` (its `--g1` fallback book is now `--g8`, AC-5) and `etl/test_calibre.py` also wrote or read `books.genre` (the AC-2 scan found the last); `src/app/books/list/page.tsx` and `src/lib/plan-rail.ts` had a comment saying "else the workbook's", corrected (comment only).

**Follow-ups** (approved at plan): `docs/03-data-model.md` § Views rows for `book_genre_levels` and `plan_suggestions`, and the 1.18c row.

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
