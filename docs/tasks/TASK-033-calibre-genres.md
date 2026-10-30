---
id: TASK-033
title: 1.18c Calibre genres
status: In progress
depends_on: [TASK-032]
size: M
model: opus
autonomy: attended
ui: false
plan_status: approved
planned_at_commit: c0ef78d
---

# TASK-033 — 1.18c Calibre genres

## Goal

Each book carries every genre the owner gave it in Calibre, with Calibre's hierarchy kept, instead of the single genre the workbook's Read tabs imply.

## Context

- Roadmap: `docs/05-roadmap.md` § 1.18c (after 1.18b). The roadmap entry and its **Check:** are the contract.
- The owner's library (read 2026-10-27): `#genre` is a multi-valued text column with 127 values, written as dotted paths (`Fantasy.Epic Fantasy`, `Young Adult.Fantasy.Romantasy`). Numbers here are the owner's data, not fixtures.
- Today `books.genre` is one text value, set by `etl/extract.py` from the column of the workbook Read tab a book sits in (`listed_read`, the per-year genre-column tabs).
- Pattern to copy: 1.18b (TASK-032): a `--genre-column` lookup in `etl/calibre.py`, a fixture column in `etl/test_calibre.py`, the fold in `fold_calibre()`.
- **Stop and ask** at the plan gate before the migration (roadmap, CLAUDE.md): the proposal is `book_genres(book_id, genre)`, no `user_id` (D-91), joining `src/db/export-tables.ts` (hard rule 7). The plan lists every screen and view that reads `books.genre` today, since it stays until they move.
- Data model: `docs/03-data-model.md` § 4.1 By task (1.18c). `src/db/schema.ts` `books.genre`.
- Decisions: D-90, D-91, D-87.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): `npm run test:etl`, with the fixture given a `#genre` column, shows a book with two Calibre genres loads two `book_genres` rows with their full paths, a book with none keeps its workbook genre, and a re-run is byte-identical. Then the real library's genre count in the PR.
- [ ] AC-2: Given a fixture whose genre column has the lookup name `#genres`, `--genre-column '#genres'` loads the same rows; a library without the column runs, loads no `book_genres` rows, and reports the missing column once.
- [ ] AC-3: `book_genres` is in `src/db/export-tables.ts` (`test/export-tables.test.ts` passes), and `etl/load.ps1` and `etl/load.sh` both copy it after `books` and truncate it (`test/load-scripts.test.ts`). A book's genre listed twice in Calibre loads one row.
- [ ] AC-4: Re-running extract against both workbooks on `main` and on the branch, the `seed/` CSV diff shows only the new `book_genres.csv`; `books.csv` is unchanged (standing rule 4; summary in the PR).

## Out of scope

- Moving any screen or view off `books.genre`, or dropping the column: the plan lists them as follow-ups.
- Filtering or browsing by genre in the app.
- Editors, illustrators and translators (L-5).

## Files likely touched

- `src/db/schema.ts`, `drizzle/<tag>.sql` and its snapshot: `book_genres`.
- `src/db/export-tables.ts`, `test/export-tables.test.ts`.
- `etl/calibre.py`, `etl/test_calibre.py`: read `#genre`; the flag; the fixture column.
- `etl/extract.py`, `etl/test_extract.py`: write `seed/book_genres.csv`.
- `etl/data/calibre_books.csv`: the genres column.
- `etl/load.ps1`, `etl/load.sh`, `test/load-scripts.test.ts`.

## Verification

- Automated: `npm run test:etl` covers AC-1 and AC-2 with no network; `test/export-tables.test.ts` and `test/load-scripts.test.ts` cover AC-3.
- Manual: `npm run calibre -- --dry-run` over the real library → expected: the number of books with genres and of distinct genres, quoted in the PR. `npm run extract` on `main` and on the branch into temp folders, then a CSV diff → expected: only `book_genres.csv` is new.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- Move the master list (`src/db/queries.ts` `listBooks`' genre filter and row line, `src/app/books/list/page.tsx`'s genre chips) and the `books_by_year` view (`yearSummary`) to `book_genres`, falling back to `books.genre` for a book with none, then drop `books.genre` with a down file; the later readers (2.10's rail genre hue, the book page, 6.x's genre-mix chart) noted (approved at plan) → docs/05-roadmap.md § Phase 4 (new item)
- `docs/03-data-model.md` § 4.1, the 1.18c row: approved by the owner 2026-10-30 (approved at plan) → docs/03-data-model.md § 4.1
- Candidate decision: `book_genres` is Calibre's genres only, each the full dotted path as Calibre writes it; `books.genre` stays the workbook's, and readers fall back to it until it is dropped (approved at plan) → docs/review/decisions.md

## Plan

_Approved 2026-10-30 at c0ef78d. Owner's answers at the gate: the schema, yes; the reading below, yes; `npm run rebuild` on development at the end, yes._

**Reading of the spec (confirmed):** `book_genres` holds Calibre's genres only; `books.genre` stays the workbook's for every book (AC-2: no column, no rows; AC-4: `books.csv` unchanged). A book with no Calibre genre keeps its workbook genre in `books.genre` and has no `book_genres` rows. "Calibre's genres replace the workbook's" lands when the screens move (follow-up).

**Steps**

1. **Schema.** `book_genres(book_id text NOT NULL → books.id, genre text NOT NULL, PRIMARY KEY (book_id, genre))`; no `user_id` (D-91), no `deleted_at`. `npm run db:generate` → 0017, add-only (no down file). Joins `src/db/export-tables.ts`.
2. **`etl/calibre.py`.** `custom_column()` returns every value of a multi-valued column (`is_multiple`); `--genre-column` (default `#genre`), a missing column reported once. `calibre_books.csv` gains a last column, `genres`: full dotted paths, deduped case-insensitively, sorted, joined `; `. The report prints books with genres and distinct genres; `changes()` reports `genres`.
3. **`etl/extract.py`.** `fold_calibre()` gives each Calibre book its genres (a held book, or a second Calibre book on one book, loads none); `seed/book_genres.csv` (`book_id, genre`), one row per pair.
4. **Loaders.** `etl/load.ps1`, `etl/load.sh`: truncate `book_genres`, copy it after `books`. `etl/rebuild.ps1`, `etl/rebuild.sh` count it.
5. **Docs.** `.claude/rules/schema.md` (a genres line), `docs/COMMANDS.md` (the flag).
6. **Real runs.** `npm run calibre -- --dry-run` (counts), `npm run calibre -- --offline` (the sidecar); extract on `main` and on the branch into temp folders, CSV diff; `npm run rebuild` on development (approved).

**Files** (17; `never-split`, attended): `src/db/schema.ts`, `drizzle/0017_*` + meta, `src/db/export-tables.ts`, `etl/calibre.py`, `etl/extract.py`, `etl/test_calibre.py`, `etl/data/calibre_books.csv`, `etl/load.ps1`, `etl/load.sh`, `etl/rebuild.ps1`, `etl/rebuild.sh`, `test/load-scripts.test.ts`, `test/schema-additions.test.ts`, `.claude/rules/schema.md`, `docs/COMMANDS.md`; `etl/test_extract.py` only if it pins the seed file list. Not in Files likely touched: the rebuild twins (they count each table) and `test/schema-additions.test.ts`.

**Test strategy**

- AC-1: `etl/test_calibre.py` `Genres`: two genres → two rows with full paths; a book with none keeps its workbook `books.genre` and has no rows; a second run is byte-identical (sidecars and `book_genres.csv`).
- AC-2: `#genres` at another `custom_column_N` loads the same rows; no column → no rows, one report line.
- AC-3: a genre linked twice → one row; `test/export-tables.test.ts`; `test/load-scripts.test.ts` (truncate, copy after `books`, rebuild counts); `test/schema-additions.test.ts` (columns, primary key).
- AC-4: manual diff, summary in the PR.

**Risks**: a genre containing `;` would split in the sidecar; reported if one exists.

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
