---
id: TASK-010
title: 1.5 Dated reading log
status: Draft
depends_on: [TASK-009]
size: L
model: opus
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-010 — 1.5 Dated reading log

## Goal

Finishing a book records when you finished it: today, a picked date, just the year, or no date. Reading something again adds to its history rather than overwriting it. A finished book always shows up under the right year.

## Context

- Roadmap: `docs/TASKS.md` § 1.5 Dated reading log (sitting 5, last; it must land before real rereads overwrite history). The roadmap entry and its **Check:** are the contract.
- **Why this is one large task** (`workflow.splitPolicy: never-split`): a migration that adds `read_events` and drops `book_status.finished_year`, with a lossless down file; the backfill; every reader of `finished_year` (view, index, queries, page, writes); `etl/extract.py`'s output; and the status and finish-date controls. They have to change together or a finished book drops out of its year.
- **Schema change, stop and ask at plan time** (CLAUDE.md), though the roadmap specifies it: `read_events(…, book_id, placement_id, finished_on date, finished_on_precision text, reread_of)`, with `CHECK (num_nonnulls(book_id, placement_id) = 1)` and the same date/precision pairing CHECK as the other two tables. Comic events carry `placement_id`, never `issue_id` (0.8a). `read_events` goes in `USER_TABLES` (Hard rule 7). Dropping `finished_year` ships `drizzle/down/<tag>.sql`, and that down must be **lossless**: it restores `finished_year` from `finished_on`, and a `none` row stays `none` with a NULL date (S-10). `drizzle/down/0004_date_precision.sql` is not the model for this.
- Architecture: `docs/ARCHITECTURE.md` § 2. Decisions — 2.17 (a date with its precision; year-only is `YYYY-07-01` `approximate`) and 2.14 (`read_events` carries `placement_id` for comics).
- Data model: `src/db/schema.ts` `bookStatus` (`finished_on`, `finished_on_precision` exist since migration 0004; `finished_year` goes), `issueProgress`. Readers to move to `extract(year FROM finished_on)`: `etl/views.sql` `books_by_year` and index `status_user_year`; `src/db/queries.ts` `listBooks` (its year filter), `readWithoutYear`; `src/app/books/page.tsx` (the year cell); `src/db/writes.ts` `saveBookStatus`; `src/app/api/progress/book/route.ts`. `etl/extract.py` emits `finished_on` and `finished_on_precision` instead of `finished_year` (standing rule 4: re-run against both workbooks and diff the CSVs). After D-41 it sees only `to_read` rows.
- Design: mockup `blist`, second frame (the status button group *To read · Reading · Read · DNF*, where DNF is a grey stop and not a warning; choosing *Read* opens *Finished*: **Today · Pick a date · Year only · No date**). The same control goes in the book detail sheet when 3.5 builds it.
- Decisions: D-10 and D-21 (precision; the finish year is derived), D-41 (no read state from the workbook), R1-03 (the status control moves here from 3.4), R0-C1 (a status change must not null `rating`), R3-05 (don't retype the 0004 columns), S-05, S-10.
- **Open question for the owner:** the roadmap says "make `issue_progress.completed_at` user-editable" but names no screen, and the issue sheet is 3.5. The draft adds *Change date…* to the spine row's menu (from TASK-002), using the same four-option finish-date control, plus the write path that 3.5 reuses.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): test asserts a book finished 2024-03-11 appears in both a March 2024 query and a 2024 query; that reading it again creates a second `read_events` row with `reread_of` set and leaves the first intact; and that `book_status` still reports one current status. A backfilled year lands as `YYYY-07-01` with precision `approximate`, and a date with the wrong precision violates the CHECK. Test that marking a book `read` from the master list writes the event and leaves an existing rating intact (R0-C1), and that `to_read → reading → read` round-trips through the UI. A book marked read through the UI on 2026-10-02 appears under the 2026 year chip and in `books_by_year` for 2026; a `read` book with no date appears under *No year*. Choosing *Year only* for 2019 in the finish-date control stores `2019-07-01` / `approximate`, never `exact`, and *No date* stores NULL / `none`. `finished_year` no longer exists. Up → down → up preserves the rows, including their precision.
- [ ] AC-2: The up → down → up test asserts row values, not just that it ran. It covers a `book_status` row with `finished_year = 2019` (back as `2019-07-01` / `approximate`, then `2019` after down), an `exact` 2024-03-11 row (`finished_year = 2024` after down), and a `none` row (NULL date and `none` after both trips). `read_events` rows written before the down are gone after it and recreated empty by the second up. `npm run check:migrations` passes with the down file present.
- [ ] AC-3: A `read_events` row with both `book_id` and `placement_id` set, or neither, violates its CHECK. A comic event references `run_issues.id`. `read_events` is in `USER_TABLES`, and `test/export-tables.test.ts` passes.
- [ ] AC-4: `etl/extract.py` writes `finished_on` / `finished_on_precision` columns and no `finished_year` to `book_status.csv`. `etl/test_extract.py` asserts the header, and `npm run test:db:reset` (migrate, then views) succeeds. No `finished_year` reference is left in `etl/`, `src/` or `etl/views.sql`: `git grep finished_year` returns only `drizzle/` migrations and the down file.
- [ ] AC-5: On a spine row that is read here, *Change date…* opens the four-option finish-date control. Saving *Pick a date* writes that `completed_at` as `exact`, *Year only* writes July 1st as `approximate`, and *No date* writes NULL / `none`. No other placement's row changes.
- [ ] AC-6: The status control and the finish-date control meet the UX floor (`docs/TASKS.md` § *The UX floor, for every UI task*): the status group is a real button group with the current value `aria-pressed`; DNF is grey and nothing in it resolves to `--danger`; the finish-date options are named radio inputs; focus returns to the opener when the control closes; screenshots at every `ui.viewports` width, light and dark.

## Out of scope

- Ratings, notes and the top-books reorder (3.4).
- The book and issue detail sheets (3.5), which reuse these controls.
- Reading sessions and minutes (2.1b), and pace maths over `read_events` (2.1, 2.2).
- Spread over a range for books. It exists only for ranges of issues (1.1).
- Re-reading the workbook's Read tabs (D-41 keeps them out).

## Files likely touched

- `src/db/schema.ts`: `read_events`, drop `book_status.finished_year`. `drizzle/<tag>.sql` and `drizzle/meta/*` are generated, then hand-edited for the backfill.
- `drizzle/down/<tag>.sql` (new, by hand, lossless).
- `src/db/export-tables.ts`: add `read_events`.
- `etl/views.sql`: `books_by_year` and `status_user_year` on `extract(year FROM finished_on)`.
- `etl/extract.py`, `etl/test_extract.py`: emit `finished_on` and precision.
- `src/db/queries.ts` (`listBooks`, `readWithoutYear`), `src/db/writes.ts` (`saveBookStatus` takes a date and precision, appends to `read_events`).
- `src/app/api/progress/book/route.ts`, `src/app/api/progress/issue/route.ts` (or a new date route): the date writes.
- `src/app/books/page.tsx`, `src/components/BookStatus.tsx` (new), `src/components/FinishDate.tsx` (new), `src/components/IssueRow.tsx` (*Change date…*).
- `test/reading-log.test.ts` (new, DB), `test/reading-log-migration.test.ts` (new, up → down → up), `etl/test_views.sql`.

## Verification

- Automated: `test/reading-log.test.ts` covers the 2024-03-11 queries, the reread with `reread_of`, one current status, the R0-C1 rating survival, the UI round trip, *Year only* and *No date*, *No year*, and *Change date…* (AC-1, AC-5). `test/reading-log-migration.test.ts` covers up → down → up with exact, approximate and none rows (AC-2). The CHECKs and the export list are covered in AC-3. `etl/test_extract.py` and `etl/test_views.sql` cover AC-4. `npm run check:migrations`.
- Manual: `npm run rebuild` on the development database, then mark a book *Read → Year only → 2019* on the master list → expected: it shows under 2019 and the database has `2019-07-01` / `approximate`. Mark it read again today → expected: two events, and the status is still *read*.

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
