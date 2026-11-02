---
id: TASK-044
title: 1.27 Extract resolves the wishlist, before cutover
status: Draft
depends_on: [TASK-030, TASK-029]
size: L
model: opus
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
---

# TASK-044 — 1.27 Extract resolves the wishlist, before cutover

## Goal

The old To-Read tab's lines are settled by `npm run extract`, before the final load: a line naming a book you have is that book (an Unlisted one moves to Someday), and every other line waits in a review sidecar you decide (`create`, `link` or `drop`), so the final load carries the answer. Then the unlinked wishlist screen and table go.

## Context

- Roadmap: `docs/05-roadmap.md` § 1.27 Extract resolves the wishlist, before cutover (M9, sitting 9, after 1.23, before the entries 1.25 pulls ahead and 1.26). The roadmap entry and its **Check:** are the contract; the Check was proposed with D-111 and merged with it (PR #183). Cutover (1.26, START-HERE Step 14 *Before the switch*, `docs/OWNER-CHECKLIST.md`) waits until no row is undecided.
- **Why this is one large task** (`workflow.splitPolicy: never-split`): extract's new sidecar, the migration that drops `wishlist`, and the removal of 1.4d's screen, writes, queries and tests land together. Dropping the table before extract settles the lines would lose them; settling them in extract while the screen still promotes the same lines on production would decide them twice.
- **Open question for the plan** (from the entry): about 386 lines need a decision on the 2026-11-02 development data (59 would be created, 20 of them close to a book already there; 327 series names, lines with no author or otherwise held, D-111). Whether a `reason` takes a default the owner can accept in bulk (`drop` every `series` row, `create` every `new` one) rather than deciding each row is the owner's call at the plan gate. If it is taken, the plan adds the AC for it; nothing here assumes it.
- **Schema: stop and ask at plan time** (CLAUDE.md: dropping a table and its columns). The entry asks for it: a migration that drops `wishlist` (`src/db/schema.ts`, `wishlist`: `id`, `genre`, `raw_entry`, `book_id` → `books.id`), with a hand-written `drizzle/down/<tag>.sql` that recreates it and an up → down → up test on the TEST database (`.claude/rules/schema.md`, *Migrations that drop or retype a column ship a down file*; `test/plan-period-migration.test.ts` is the pattern), and its `src/db/export-tables.ts` entry removed (Hard rule 7). The table holds no row extract can't rebuild from the workbook (data model 2.7), so the down file need not restore rows.
- Extract today (`etl/extract.py`, *unstructured wishlist*, `extract_books`): every non-empty To-Read line except `Top` and the `Goals` column becomes a `seed/wishlist.csv` row (`genre`, `raw_entry`, `book_id` always empty); `etl/test_extract.py` asserts it is never linked. The match is extract's own book comparison (D-61: title and author, case-insensitive; `BookIndex.find_book`, after `book_review.csv`'s merges, D-68), run after `fold_calibre` so a Calibre-only book (1.18, D-86, created at `unlisted`) is in the index. Near spellings use `trigrams` and `PAIR_SIMILAR_AT` = 0.5 (D-92). The sidecar follows `book_review.csv`'s life cycle (`review_book_pairs`, `write_book_review`: decided rows survive, undecided rows are rebuilt, a row whose line left the workbook is flagged `stale review`) and `write_calibre_missing`'s printed undecided count. The review sidecars are committed (`etl/data/book_review.csv` is), so the first real run's `etl/data/wishlist_review.csv` is too, and `package.json`'s `extract` script passes its path as it passes `--book-review`.
- The line form and the series guess live in the app today, and go with it: `parseBookLine` and `seriesLike` (`SERIES_WORD`) in `src/lib/book-parse.ts`, the wishlist's plain-hyphen `Title - Author` form (`test/book-parse.test.ts`, *the wishlist's form (task 1.4d)*), and `seriesNames()` in `src/db/queries.ts` (a line naming a series you have). Extract needs its own equivalent for `reason` (`series`, `no author`); `seriesLike` has no caller outside the wishlist code, so it and its test go, and `parseBookLine` stays (1.4's paste uses it).
- Statuses: an Unlisted or statusless book a line names, or a `link` row points at, loads at `to_read` with no `reading_plan` row (Someday is derived, D-37); any other status is kept (`read`, `reading`, a planned `to_read`). A `create` row's book is minted as extract mints any book (`BookIndex.upsert`, D-61's id rule) from the row's `title` and `author`, which the owner may have edited.
- What goes once it lands (the entry's list): the `?from=wishlist` branch of `src/app/books/add/page.tsx` (with its `Wishlist` function and title), `src/components/WishlistReview.tsx`, `src/components/WishlistLoading.tsx`, `src/lib/wishlist-review.ts`, `src/app/api/books/wishlist/route.ts`, `acceptWishlist` and `dismissWishlist` in `src/db/writes.ts`, `unresolvedWishlist` and `seriesNames` in `src/db/queries.ts`, the `.wishlist` rules in `src/app/globals.css`, their tests (`test/wishlist.test.ts`, `test/wishlist-screen.test.tsx`, `test/wishlist-review.test.ts`, `test/e2e/wishlist.spec.ts`), and the `wishlist` row in `design/mockups-index.md`. The Check's "`wishlist` appears nowhere in `src/`" also reaches the comments in `src/lib/book-parse.ts`, `src/components/ReviewTable.tsx` and `src/components/PasteBooks.tsx`. The table lists in `etl/load.ps1`, `etl/load.sh`, `etl/rebuild.ps1`, `etl/rebuild.sh` and `test/db.ts` name it too.
- *From TASK-043 (1.23):* its plan adds *Listening* to the status-word map in `src/lib/wishlist-review.ts`. Whichever lands second reconciles: this task deletes the file either way.
- Design: no screen gains anything. `design/mockups.html` still draws the `wishlist` frame (and its nav button); the entry names only the `design/mockups-index.md` row, so whether the frame goes too is a question for the plan gate.
- Decisions: D-111 (this entry; amends D-39), D-39 (the promotion it replaces), D-61 and D-68 (how extract compares and merges books), D-86 (Unlisted), D-37 (Someday is a `to_read` book with no plan row), D-92 (0.5 trigram similarity), D-87 (Calibre and the workbook), D-91 (no `user_id`). Data model 2.7 (`docs/03-data-model.md`), `docs/02-architecture.md` (F-18's row; the load section's note on `wishlist`), F-18 in `docs/01-product.md`, `docs/cutover-parity.md` (*Ideas for books to read someday* → 1.27).

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): `etl/test_*.py`: an extract over a To-Read tab holding an exact
  match to a seed book, an exact match to a Calibre-only book, a near spelling,
  a series name and a line with no author writes `wishlist_review.csv` with a
  row for each of the last three and none for the first two; the Calibre-only
  book loads at `to_read` with no `reading_plan` row, and the matched book's
  status is unchanged; rows decided `create`, `link` and `drop` load a new
  `to_read` book, the `near` book at `to_read`, and nothing; a second run keeps
  every decision and leaves the file byte for byte. The migration passes an
  up → down → up test on the TEST database; `wishlist` appears nowhere in
  `src/`; `npm run test:all` is green.
- [ ] AC-2: In the AC-1 fixture, `wishlist_review.csv` has exactly the columns `genre`, `raw_entry`, `title`, `author`, `reason`, `near`, `similarity`, `decision`, in that order, one row per `raw_entry`: the near spelling's row has reason `similar`, `near` naming the seed book it is closest to and `similarity` ≥ 0.5; the series name's row has reason `series`; the line with no author has reason `no author` and an empty `author`; a further fixture line with an author and no seed book at 0.5 or more has reason `new` and an empty `near`. Every new row's `decision` is empty. A `Top` line and the `Goals` column write no row, as today.
- [ ] AC-3: Given `wishlist_review.csv` holding a decided row whose `raw_entry` is no longer in the To-Read tab, extract keeps the row, reports it stale (`seed/unresolved.csv`, as `book_review.csv`'s stale rows are) and loads nothing from it; given a row whose `decision` is none of `create`, `link`, `drop`, extract reports it and treats it as undecided. Given three undecided rows, the run prints that three are undecided. A `link` row whose `near` book is at `read` leaves it at `read`; a `create` row whose `title` the owner edited creates the book under the edited title, not the line's.
- [ ] AC-4: After the migration on the TEST database, no `wishlist` table exists; after its down file, `wishlist` exists with columns `id`, `genre`, `raw_entry`, `book_id` and `book_id`'s foreign key to `books`; after up again, it is gone (`npm run test:db:reset` migrates from zero). `src/db/export-tables.ts` lists no `wishlist`, extract writes no `seed/wishlist.csv`, and `etl/load.ps1`, `etl/load.sh`, `etl/rebuild.ps1`, `etl/rebuild.sh` and `test/db.ts` name no `wishlist` table.
- [ ] AC-5: `npm run extract` passes `--wishlist-review etl/data/wishlist_review.csv` (or the plan's flag name) and, on the development workbooks, writes that file and prints its undecided count; the PR reports how many To-Read lines matched a book exactly (and how many of those were Calibre-only), and how many rows each `reason` holds. `design/mockups-index.md` has no `wishlist` row, and `docs/COMMANDS.md` names the new sidecar beside `book_review.csv`.

## Out of scope

- Deciding the rows of `etl/data/wishlist_review.csv`: that is the owner's, before cutover (`docs/OWNER-CHECKLIST.md`, START-HERE Step 14).
- Cutover itself and the final load (1.26).
- A screen for deciding wishlist rows: the sidecar is edited by hand, as `book_review.csv` is.
- `external_lists` (the BookTube top 10s): it keeps its raw text (data model 2.7).
- Adding a decided book to a plan level other than Someday (a quarter, a year, On deck): those come from the app after cutover.
- Changing 1.4's paste-a-list review (`src/components/PasteBooks.tsx`, `src/lib/book-review.ts`) beyond rewording a comment that names the wishlist.
- A `check_sidecars.py` check of the new file, unless the plan takes it on as `check_book_review` checks its own (then it is in the plan's file list).

## Files likely touched

- `etl/extract.py`: the To-Read pass (match, review rows, decisions, stale and undecided reporting, statuses), no `wishlist.csv`; the `--wishlist-review` argument.
- `etl/test_extract.py`: AC-1's extract cases, AC-2, AC-3; the old *never linked* assertion goes.
- `etl/data/wishlist_review.csv`: the first real run's output, committed as `book_review.csv` is.
- `package.json`: the `extract` script passes the sidecar.
- `src/db/schema.ts`: `wishlist` goes; `drizzle/<tag>.sql` and `drizzle/meta/*` from `npm run db:generate`; `drizzle/down/<tag>.sql` by hand.
- `test/<name>-migration.test.ts`: the up → down → up test (AC-4).
- `src/db/export-tables.ts`, `etl/load.ps1`, `etl/load.sh`, `etl/rebuild.ps1`, `etl/rebuild.sh`, `test/db.ts`: the table leaves every list.
- Removed: `src/components/WishlistReview.tsx`, `src/components/WishlistLoading.tsx`, `src/lib/wishlist-review.ts`, `src/app/api/books/wishlist/route.ts`, `test/wishlist.test.ts`, `test/wishlist-screen.test.tsx`, `test/wishlist-review.test.ts`, `test/e2e/wishlist.spec.ts`.
- Edited: `src/app/books/add/page.tsx` (the `?from=wishlist` branch), `src/db/writes.ts` (`acceptWishlist`, `dismissWishlist`, the `WishlistItem` import), `src/db/queries.ts` (`unresolvedWishlist`, `seriesNames`), `src/lib/book-parse.ts` (`seriesLike`, comments), `test/book-parse.test.ts` (*the wishlist's form*), `src/components/ReviewTable.tsx` and `src/components/PasteBooks.tsx` (comments), `src/app/globals.css` (`.wishlist`).
- `design/mockups-index.md` (the row); `design/mockups.html` only if the owner agrees at the plan gate.
- Docs that describe the table as current: `docs/COMMANDS.md`, `docs/03-data-model.md` (§ 1 overview row, 2.7), `docs/02-architecture.md`, `docs/START-HERE.md` (the sample extract output and the table list).

## Verification

- Automated: `etl/test_extract.py` cases for AC-1 to AC-3 (`py -m unittest etl.test_extract` or the project's runner); the migration test for AC-4 (vitest against `TEST_DATABASE_URL`); `npm run test:all` green with the wishlist suites removed; `rg -i wishlist src/` returns nothing.
- Manual: `npm run extract` on the development workbooks → `etl/data/wishlist_review.csv` is written, the run prints its undecided count, and a second run leaves the file unchanged (`git diff --stat` empty for it). `npm run rebuild` on development (ask first) → loads with no `wishlist` table, and a Calibre-only book a To-Read line named exactly shows at Someday on the master list.

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
