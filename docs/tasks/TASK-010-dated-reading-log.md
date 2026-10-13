---
id: TASK-010
title: 1.5 Dated reading log
status: Review
depends_on: [TASK-009]
size: L
model: opus
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: 99f72e3
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
- **Settled by the owner, 2026-10-09:** `issue_progress.completed_at` is edited from *Change date…* in the spine row's menu (from TASK-002), using the same four-option finish-date control. The write path is shared, and 3.5's issue sheet reuses it.
- **A future day is refused by the server, not just the picker** (follow-up from PR #67, task 1.1). The range sheet's *Pick a date* caps its `max` at the reader's local today, but `POST /api/progress/range` accepts a future day and returns 200. This task makes every finish date editable, so the shared write path rejects a day after today with a 400, the range route included. "Today" is UTC until 1.16 (dates in `America/New_York`) changes it.
- *From #71 (docs backfill):* **1.16 has no task file yet.** It follows this task in sitting 5 (`docs/TASKS.md` § Phase 1, the sittings table), but it was added to the roadmap after Phase 1 was converted (#61), so `/next-task` can't pick it up. Run `/new-task 1.16` before this task closes out, so sitting 5 doesn't end at 1.5.

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim): test asserts a book finished 2024-03-11 appears in both a March 2024 query and a 2024 query; that reading it again creates a second `read_events` row with `reread_of` set and leaves the first intact; and that `book_status` still reports one current status. A backfilled year lands as `YYYY-07-01` with precision `approximate`, and a date with the wrong precision violates the CHECK. Test that marking a book `read` from the master list writes the event and leaves an existing rating intact (R0-C1), and that `to_read → reading → read` round-trips through the UI. A book marked read through the UI on 2026-10-02 appears under the 2026 year chip and in `books_by_year` for 2026; a `read` book with no date appears under *No year*. Choosing *Year only* for 2019 in the finish-date control stores `2019-07-01` / `approximate`, never `exact`, and *No date* stores NULL / `none`. `finished_year` no longer exists. Up → down → up preserves the rows, including their precision.
- [x] AC-2: The up → down → up test asserts row values, not just that it ran. It covers a `book_status` row with `finished_year = 2019` (back as `2019-07-01` / `approximate`, then `2019` after down), an `exact` 2024-03-11 row (`finished_year = 2024` after down), and a `none` row (NULL date and `none` after both trips). `read_events` rows written before the down are gone after it and recreated empty by the second up. `npm run check:migrations` passes with the down file present.
- [x] AC-3: A `read_events` row with both `book_id` and `placement_id` set, or neither, violates its CHECK. A comic event references `run_issues.id`. `read_events` is in `USER_TABLES`, and `test/export-tables.test.ts` passes.
- [x] AC-4: `etl/extract.py` writes `finished_on` / `finished_on_precision` columns and no `finished_year` to `book_status.csv`. `etl/test_extract.py` asserts the header, and `npm run test:db:reset` (migrate, then views) succeeds. No `finished_year` reference is left in `etl/`, `src/` or `etl/views.sql`: `git grep finished_year` returns only `drizzle/` migrations and the down file.
- [x] AC-5: On a spine row that is read here, *Change date…* opens the four-option finish-date control. Saving *Pick a date* writes that `completed_at` as `exact`, *Year only* writes July 1st as `approximate`, and *No date* writes NULL / `none`. No other placement's row changes.
- [x] AC-6: The status control and the finish-date control meet the UX floor (`docs/TASKS.md` § *The UX floor, for every UI task*): the status group is a real button group with the current value `aria-pressed`; DNF is grey and nothing in it resolves to `--danger`; the finish-date options are named radio inputs; focus returns to the opener when the control closes; screenshots at every `ui.viewports` width, light and dark.

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

## Follow-ups

- `docs/ARCHITECTURE.md` still called `book_status.finished_year` the stored column (§ 1 tabs table, 2.17, the known-gaps list) (approved at plan) → docs/ARCHITECTURE.md § 2.17
- `docs/DIAGRAMS.md`'s books ERD still drew `finished_year` and had no `read_events` (approved at plan) → docs/DIAGRAMS.md § 2. Books data model
- `docs/HANDOFF.md`'s tabs table still read `books_by_year` over `finished_year` (approved at plan) → docs/HANDOFF.md § 4. Architecture decisions
- `docs/FEATURES.md` #4 still described `finished_year` as current (approved at plan) → docs/FEATURES.md § Part 2 — What you didn't list and probably want (#4)
- `.claude/rules/schema.md` said `finished_year` was still stored "until 1.5", and had no rule for the log (approved at plan) → .claude/rules/schema.md § A book's finish year is derived
- 1.16 had no task file, so `/next-task` couldn't reach it (approved at plan) → docs/tasks/TASK-025-dates-in-new-york.md (new, Draft)
- Candidate decision: `read_events` is the books' log, a reread is Reading → Read, and comic reads don't write it yet (approved at plan) → docs/review/decisions.md § D-65
- ui-verifier: *Change date…* opens on today's date, not the stored one, so reopening it after a save looks unchanged → not tracked: by design (plan step 11); showing the stored date needs the spine rows to carry `completed_at`, and 3.5's issue sheet lists each placement with its date
- ui-verifier: the top bar's *Ledger* link is 46×23px at phone and tablet widths → not tracked: already tracked in docs/tasks/TASK-014-app-shell.md § Context
- ui-verifier: *Show all 181* (`/books`) and *All runs* (run page) are 17px tall → not tracked: inline text links in a sentence, which WCAG 2.5.8's inline exception exempts from the 24px target; neither changed here

## Plan

Approved 2026-10-13. Size: ~24 files, schema and UI together; kept whole (`splitPolicy: never-split`, autonomy attended), because the readers of `finished_year` and its drop must land together.

**Owner decisions at the plan gate.** (A) `read_events` as below, and `finished_year` dropped. (B) Comic reads write no `read_events` in this task: the column, FK and CHECK exist; the comics mark paths are unchanged except *Change date…*, which writes `issue_progress` only. (C) A reread is `read → reading → read`: entering `read` from any other status appends an event with `reread_of` = the book's latest event; saving *Read* on a book already read edits the latest event's date and appends nothing. Leaving `read` keeps `finished_on` (R0-C1), and every year reader requires `status = 'read'`.

**Steps**
1. `src/db/schema.ts`: `readEvents` — `id serial`, `user_id → users` (cascade), `book_id → books` (cascade), `placement_id → run_issues` (cascade), `finished_on date`, `finished_on_precision text NOT NULL DEFAULT 'exact'`, `reread_of → read_events` (set null); CHECKs `num_nonnulls(book_id, placement_id) = 1` and the date/precision pairing; indexes `(user_id, book_id)`, `(user_id, placement_id)`. Drop `bookStatus.finishedYear`.
2. `npm run db:generate -- --name dated_reading_log` → `drizzle/0011_dated_reading_log.sql`, hand-edited: `DROP VIEW IF EXISTS books_by_year` (it reads the column), backfill `finished_on = make_date(finished_year, 7, 1)`, `approximate` where `finished_year IS NOT NULL AND finished_on IS NULL`, then the drop. No `read_events` backfill (AC-2: the second up recreates it empty; D-41: no workbook reads).
3. `drizzle/down/0011_dated_reading_log.sql`: lossless — drop `books_by_year` and `read_events`, add `finished_year`, set it to `extract(year FROM finished_on)`; precision and date untouched.
4. `etl/views.sql`: `books_by_year` on `extract(year FROM finished_on)::int`; `status_user_year` on `(user_id, (extract(year FROM finished_on)))`.
5. `src/db/queries.ts`: `listBooks` returns `read_year` (derived, only for `read`), `finished_on`, `finished_on_precision`; year filter `status = 'read' AND extract(year …) = y` or planned; *No year* = `read` with NULL `finished_on`; `readWithoutYear` likewise. `src/db/writes.ts` `undoAddBooks` drops its `finishedYear` guard.
6. `src/db/export-tables.ts` adds `read_events` to `USER_TABLES`; `test/db.ts` truncates it.
7. `etl/extract.py` writes `finished_on` (`YYYY-07-01`) / `finished_on_precision` (`approximate`, or blank / `none`); `etl/load.ps1` and `etl/load.sh` `\copy` those columns. Extract both workbooks to the scratchpad before and after and diff (standing rule 4).
8. `src/lib/finish-date.ts` (new): the four choices (`today | date | year | none`) → a date and precision; `day()` moves here; a day after today (UTC until 1.16) or a year after this one is refused. Used by the book, issue and range routes (the range route's future-day 400, PR #67's follow-up).
9. `src/db/writes.ts` `saveBookStatus(userId, { bookId, status, finish?, rating? })`: one transaction, row locked; decision C; returns `{ prior, appended?, edited? }`. `undoBookStatus` puts exactly that back (deletes the appended event only if it is still the latest, restores an edited event's date, restores status / date / precision or removes a row the write created) and refuses when anything moved.
10. `src/app/api/progress/book/route.ts`: POST validates status and finish (finish required for `read`); DELETE is the undo. `src/app/api/progress/issue/route.ts`: PATCH `{ placementId, finish }` re-dates a placement read here (404 otherwise), answers `prior`; undo reuses POST `restore`. `src/app/api/progress/range/route.ts`: future days → 400.
11. UI: `src/components/FinishDate.tsx` (fieldset *Finished*, named radios Today · Pick a date · Year only · No date, date input with `max` today, year stepper, the *Saved as 1 July 2022, approximate* line). `src/components/BookStatus.tsx` (row disclosure; status button group `aria-pressed`, DNF grey; *Read* opens *Finished* with Save / Cancel; focus back to the opener; undo toast). `src/app/books/page.tsx` renders it and the derived year. `src/components/IssueRow.tsx` row menu *Change date…* on rows read here → a `Sheet` with `FinishDate`. `src/app/globals.css` for the status group, DNF and stepper. `design/mockups.html` spine notes gain *Change date…* (the row menu is described there, not drawn).

**Files** (beyond *Files likely touched*, flagged): `etl/load.ps1`, `etl/load.sh` (the `\copy` names the column; AC-4), `src/lib/finish-date.ts` (shared validation), `src/app/api/progress/range/route.ts` (future-day 400, Context), `src/app/globals.css`, `design/mockups.html` (`ui.redrawFiles`), `test/db.ts`, `test/queries.test.ts` (R0-C1 test on `finished_on`), `test/reading-log.test.tsx` (UI).

**Test strategy**
- AC-1, AC-3, AC-5 server side: `test/reading-log.test.ts` — 2024-03-11 in a March 2024 and a 2024 query; reread appends with `reread_of`, first intact, one `book_status`; read from the list keeps rating; 2026-10-02 in the 2026 chip and `books_by_year`; `read` with no date under *No year*; *Year only* 2019 → `2019-07-01` / `approximate`; *No date* → NULL / `none`; wrong-precision and both/neither CHECK violations; comic event on `run_issues.id`; `finished_year` absent from `information_schema`; PATCH dates and other placements untouched; future days 400 on all three routes; undo restores exactly.
- AC-2: `test/reading-log-migration.test.ts` — down → up inside a rolled-back transaction with 2019 / exact 2024-03-11 / none rows and a `read_events` row.
- AC-1 UI, AC-5 UI, AC-6: `test/reading-log.test.tsx` (happy-dom; `fetch` routed into the real route handlers on the test database) — `to_read → reading → read` round trip, *Year only* / *No date*, *Change date…* sheet, `aria-pressed`, named radios, focus return. Screenshots: ui-verifier at every `ui.viewports` width, light and dark.
- AC-4: `etl/test_extract.py` (header and values), `etl/test_views.sql` (`books_by_year` derives the year), `npm run test:db:reset`, `git grep finished_year`.

**Revision 1 (review round 1, owner approved 2026-10-13).** Four safety fixes, each with a test: `undoAddBooks` refuses once the book has `read_events` (`test/add-book.test.ts`); `undoBookStatus` refuses once the status is no longer the one the write set (`BookStatusChange.status`); `redateIssue` refuses a placement whose issue or run is removed, as the mark's POST does; the down file drops the `status_user_year` expression index. Also changed, as consequences of the plan: `test/add-book.test.ts` (the books page's rows need `UndoProvider` and the router) and `test/placement-progress-migration.test.ts` (0011's down runs before 0007's). AC-4's grep is read as `git grep finished_year -- src etl` (owner, 2026-10-13): tests that prove the column is gone, and docs, still name it.

**Risks.** Postgres client under happy-dom (fallback: the UI test asserts requests, the DB test the handler). `extract(year …)` index must be immutable on `date` (it is). The manual step's "mark it read again" is done as Reading → Read (decision C).

## Review log

- Verify R1 FAIL(2: `add-book` page render without the router and undo stack; the 0007 round trip blocked by `read_events`' FK) → R2 PASS → R3 PASS (after review round 1's fixes)
- Audit R1 PASS (every AC PROVEN; nothing non-discriminating)
- Schema R1 APPROVE (minors: down file left the `status_user_year` index; a status-only undo didn't check the status — both fixed, plan revision 1)
- Spec R1 CHANGES (roadmap checkbox; follow-ups with no destination; the `undoAddBooks` guard unplanned and untested; `redateIssue` didn't check issue/run soft delete; AC-4's grep wording, read as `-- src etl` by the owner) → R2 APPROVE (with the follow-ups check)
- UI R1 PASS (360–1280, light and dark; DNF grey, never `--danger`; focus returns; no console errors; dev data restored)

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 3 (R1 FAIL, R2 and R3 PASS)
- Review rounds: 2
- First-pass AC FAILs: 0 (AC-4's wording was a spec gap, not a failure)
- Plan revisions after approval: 1
