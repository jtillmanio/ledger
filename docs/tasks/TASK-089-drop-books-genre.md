---
id: TASK-089
title: 4.5 Calibre's genres on every screen (2 of 2) — drop books.genre
status: Ready
depends_on: [TASK-088]
size: M
model: opus
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
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
