---
id: TASK-131
title: 6.19 Remove Open Library (1 of 2) — extract, enrichment and load stop carrying it
status: In progress
depends_on: []
size: M
model: opus
autonomy: attended
ui: false
plan_status: approved
planned_at_commit: 729263a
---

# TASK-131 — 6.19 Remove Open Library (1 of 2) — extract, enrichment and load stop carrying it

## Goal

The ETL no longer reads, writes or loads anything from Open Library: a fresh extract and load produce the same books, page counts and covers without an `open_library_id` column or an `openlibrary` source.

## Context

- Roadmap: `docs/05-roadmap.md` § 6.19 Remove Open Library (D-94; owner, 2026-10-28; both removals approved). Its **Check:** is AC-1 of TASK-132, which proves it whole. Listed in `docs/06-tasklist.md` M21 (Phase 6); pulled ahead of 1.26 (D-172), so it lands while production is still rebuildable. Its precondition (1.14b and 1.4f merged, the owner content with Hardcover) is met: both are done, and since 1.4f nothing reads Open Library (*From TASK-040*, in the entry).
- **Split, 1 of 2** (`workflow.splitPolicy: split`: the entry spans the ETL, a migration, the app and seven documents). This part is the ETL: once the seed and the load stop naming the column, TASK-132 can drop it without breaking `load`. TASK-132 is the migration, the app code, the tests in `test/` and the documents.
- **What carries it today:**
  - `etl/extract.py`: `OPEN_LIBRARY = "open library"` (the `book_review.csv` reason, around line 1070), `BOOK_DETAILS_COLUMNS` and the books columns with `open_library_id` (around lines 1080 and 1129), the `openlibrary` source rule (around lines 1105, 1614–1642).
  - `etl/enrich_books.py`: `OLD_SOURCE = "openlibrary"` (around line 90, the rows every run drops), the empty `open_library_id` it writes on each `hardcover` row (around line 268), and the review filter on `ex.OPEN_LIBRARY` (around line 592).
  - `etl/load.ps1` (line 114) and `etl/load.sh`: the `\copy books(…open_library_id…)` column list.
  - `etl/test_views.sql` (around line 1249): the books column list it asserts.
  - Python tests: `etl/test_extract.py`, `etl/test_enrich_books.py`, `etl/test_calibre.py`.
- **Kept, by the entry:** decided `open library` rows in `book_review.csv` stay; they are decisions about the workbook's titles. So extract still honours a decided row with that reason (the plan says how it names the reason once the constant goes, and whether the Check's "appear nowhere in `etl/*.py`" allows the reason string; ask at the plan gate if it doesn't).
- **The sidecar on disk.** `etl/data/book_details.csv` has an `open_library_id` header today. The plan says whether extract tolerates the old header until the next `npm run enrich:books` rewrites it, or this PR rewrites the file once.
- **Never run against `.env` or `.env.live`.** `load` and `rebuild` against development still ask first (CLAUDE.md). Tests read `TEST_DATABASE_URL` only.
- Rules: `.claude/rules/schema.md` (the `book_details.csv` and Hardcover paragraphs around lines 64, 152, 187). Decisions: D-44, D-94, D-99.

## Acceptance criteria

- [ ] AC-1: `npm run extract` writes `seed/books.csv` with no `open_library_id` column, and `etl/load.ps1` and `etl/load.sh` load it into the TEST database with every books row's `hardcover_id`, `page_count` and `cover_url` equal to what the run before the change loaded (compared in a test on a fixture workbook and sidecars).
- [ ] AC-2: `etl/enrich_books.py` writes `book_details.csv` with no `open_library_id` column and no `openlibrary` row; given a sidecar that still has the old header and an `openlibrary` row, extract reads it and the run drops that row, as it does today.
- [ ] AC-3: A decided `book_review.csv` row whose reason is `open library` still applies on extract (the book takes its decided title), and an undecided one is still dropped.
- [ ] AC-4: `grep -n -i -E "open_library|openlibrary" etl/*.py etl/*.ps1 etl/*.sh` finds nothing outside the `book_review.csv` reason AC-3 keeps, and `py -m unittest discover etl` and `etl/test_views.sql` pass.

## Out of scope

- The migration, `books.open_library_id` and `open_library_cache` in the database, `src/` and `test/`: TASK-132.
- The documents and the mockup's notes: TASK-132.
- Deleting `etl/.openlibrary-cache.sqlite` from disk or `.gitignore`: TASK-132.
- Rewriting or deleting decided rows in `book_review.csv`.

## Files likely touched

- `etl/extract.py` — the columns and the `openlibrary` source rule.
- `etl/enrich_books.py` — the column and the old-source handling.
- `etl/load.ps1`, `etl/load.sh` — the `\copy books(…)` column list.
- `etl/test_views.sql` — the asserted books columns, if the plan drops the column from it here (else TASK-132).
- `etl/test_extract.py`, `etl/test_enrich_books.py`, `etl/test_calibre.py` — AC-1 to AC-3.

## Verification

- Automated: `py -m unittest discover etl` (AC-1 to AC-3); a load of the extracted fixture seed into `TEST_DATABASE_URL` (AC-1); `npm run test:no-e2e`.
- Manual: none. The owner's next `npm run extract` shows the same book count and match report as before.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- TASK-132: `etl/test_views.sql`'s books column list drops `open_library_id` with the migration; *metadata pending* already marks retired-only books after any load once this merges; the lowercase `open library` review reason stays in `etl/extract.py` (`RETIRED_LOOKUP`), so read the Check's `Open Library` case-sensitively (approved at plan)

## Plan

Approved by the owner with the recommendations below (2026-11-23).

**What the data says.** The committed `etl/data/book_details.csv` has 2,000
`openlibrary` rows (1,787 with a cover) and 98 `hardcover` rows, no other
source; today's extract still folds an `openlibrary` row's `cover_url` and
year (only its page count went, 1.14c). `book_review.csv` has 47 `open
library` rows, every one decided.

**Steps**

1. `etl/extract.py`: drop `open_library_id` from `BOOK_DETAILS_COLUMNS`,
   `BOOK_COLUMNS` and `fold_book_details`. A `retired(row)` helper (source
   not in `MATCH_SOURCES`) names 1.14's rows without the word: no page count,
   no match (as today), but their cover and year still fold, so every book
   keeps the cover it loads with today (AC-1). An old header still reads:
   extract takes only the columns it knows (AC-2).
2. The review reason: `OPEN_LIBRARY` becomes `RETIRED_LOOKUP = "open
   library"`. A decided row applies as today (renames the book, no false
   *stale review*); an undecided one is now dropped on extract (AC-3). The
   lowercase reason is the string AC-4 keeps; the roadmap Check's `Open
   Library` is capitalised.
3. `etl/enrich_books.py`: `OLD_SOURCE` becomes `ex.retired()`, the same
   behaviour (dropped as a run reaches the book, kept by a stopped or
   `--limit` run); `details()` writes no `open_library_id`; the docstring and
   prints stop naming Open Library; the undecided-review filter uses
   `ex.RETIRED_LOOKUP`.
4. `etl/load.ps1`, `etl/load.sh`: `open_library_id` leaves `\copy books(…)`;
   the column stays in the database, NULL, until TASK-132 drops it.
5. Tests. Legacy sidecar rows live in fixture CSVs in
   `etl/testdata/before-6.19/` (data, outside AC-4's `etl/*.py`):
   `book_details.csv` (the old header; a `hardcover`, an `openlibrary` and a
   `hand` row), `book_review.csv` (a decided and an undecided `open library`
   row), `calibre_books.csv`. The Python tests drop the column and use them;
   `test/books-load.test.ts` (new) builds the fixture workbooks with
   `test_extract.py`'s builders, runs `etl/extract.py`, then `load.ps1`
   (Windows) or `load.sh` (Linux, CI) on `TEST_DATABASE_URL` only, as
   `test/comics-load.test.ts` does.
6. Not here: `etl/test_views.sql` asserts the table's live columns
   (`information_schema`), so its list changes with TASK-132's migration;
   `etl/data/book_details.csv` is not rewritten (the next `enrich:books` writes
   the new header).

**Files**

- `etl/extract.py`, `etl/enrich_books.py`, `etl/load.ps1`, `etl/load.sh`: steps 1–4.
- `etl/test_extract.py`, `etl/test_enrich_books.py`, `etl/test_calibre.py`: the column gone, AC-2, AC-3.
- `etl/testdata/before-6.19/{book_details,book_review,calibre_books}.csv`: new fixtures (not in Files likely touched).
- `test/books-load.test.ts`: new, AC-1 (not in Files likely touched: the AC needs a real load).
- `etl/test_views.sql`: unchanged (step 6).

**Test strategy**

- AC-1: `test/books-load.test.ts` › "extract writes seed/books.csv with no
  open_library_id column" and "loads every book's hardcover_id, page_count and
  cover_url as before the change" (the values pinned are what the pre-change
  extract and load produce from the same fixture; run once against
  `origin/main`'s ETL to confirm).
- AC-2: `test_enrich_books.py` › the retired rows go and the written header
  has no `open_library_id`; a stopped run keeps the unreached ones.
  `test_extract.py` › a sidecar with the old header and an `openlibrary` row
  reads, folds its cover, gives no page count and no match.
- AC-3: `test_extract.py` › a decided `open library` merge renames the book;
  an undecided one is dropped from `book_review.csv`.
- AC-4: the grep, `py -m unittest discover etl`, `npm run test:views`.

**Risks.** After this load, `books.open_library_id` is NULL everywhere, so
*metadata pending* (`open_library_id IS NULL AND hardcover_id IS NULL`) marks
the retired-only books as soon as a load runs, not only after TASK-132: the
same end state, reached one PR earlier. Size: 8 code files and 3 fixture
CSVs, over the line; the fixtures are data, not another layer, so no further
split.

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
