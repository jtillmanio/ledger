---
id: TASK-039
title: 1.17 Started and finished: a start date for books, a derived span for runs
status: In progress
depends_on: []
size: L
model: opus
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: 4d09f77
---

# TASK-039 — 1.17 Started and finished: a start date for books, a derived span for runs

## Goal

When you start a book, the day you started is kept, and every finished read keeps its own start, rereads included. A run shows when you started it and, once finished, the span it took, from the reads you have already logged.

## Context

- Roadmap: `docs/05-roadmap.md` § 1.17 Started and finished: a start date for books, a derived span for runs (M9, sitting 9, after 1.24 and before 1.23). The roadmap entry and its **Check:** are the contract. **Before cutover**, for 1.5's reason: a start not captured on the day can't be recovered. 1.23 (audiobooks) follows it because both change `book_status` and `read_events`.
- **Why this is one large task** (`workflow.splitPolicy: never-split`): a migration adding four columns, the write path and its undo, a view column, and the start shown on four screens (the book row, the status control, the run hero, Status's Done rows). The columns, the write path and the screens that read them land together.
- **Schema change: stop and ask at plan time** (CLAUDE.md), though the roadmap and data model 2.18 propose it: `book_status.started_on date NULL`, `started_on_precision text NOT NULL DEFAULT 'none'`, and the same pair on `read_events`, each with 2.17's CHECK pair (`IN ('exact','approximate','none')` and NULL exactly when `none`). Nothing is dropped or retyped, so there is no `drizzle/down/` file (Hard rule 7), and no new table, so `src/db/export-tables.ts` is unchanged. The new columns carry no `user_id` (D-91); the tables' existing `user_id` columns go in 6.18.
- Data model: `docs/03-data-model.md` § 2. Decisions — 2.17 (a date with its precision; year-only is `YYYY-07-01` `approximate`) and 2.18 (a read has a start, stored for books and derived for runs); § 4.1 By task (1.17's row).
- Writes: `src/db/writes.ts` `saveBookStatus` and `undoBookStatus`, through `POST /api/progress/book` (`src/app/api/progress/book/route.ts`). Today comes from 1.16's `today()` in `src/lib/finish-date.ts` (Eastern); `resolveFinish` and `isFuture` are the finish's validation, and a finish after today is already refused with a 400 (1.5).
- **To settle at the plan gate** (the entry leaves these open; each is a question for the owner, not a guess):
  - *"Unless a start already exists"* against *"Rereading it sets a fresh `started_on`"*: the plan says which moves into *Reading* keep the stored start (for example *Reading → To read → Reading*) and which begin a new read (*Read → Reading*, and *DNF → Reading*?).
  - Whether finishing clears `book_status.started_on` or keeps it beside the finish (the book row shows both until the next read begins).
  - Whether a start is editable while the book is *Read* (the latest `read_events` row's start, as *Finished* edits the latest row's finish today), and whether a future start is refused as a future finish is.
  - What *Undo* of a status change restores: the start it stamped, and on a finish the event's copy too.
- Views: `etl/views.sql` `run_state` has `finished_at`, the latest `completed_at` of the run's own live placements (`live_run_issues`), shown only once the run is read. `started_at` is the earliest, beside it, under the same lateral join; `MIN` skips NULLs, so `none` reads count toward neither. `etl/test_views.sql` already tests `finished_at` ignoring a read from another run (`zz-fin-r`): the pattern for the new cases.
- Extract and load: extract loads no start dates (D-41); Calibre's reads (1.18, D-73, D-87) load into `read_events` with no start. `etl/load.ps1` and `etl/load.sh` name their `\copy` columns, so the new columns take their `'none'` default and neither file changes; the plan confirms it with a load against the TEST database.
- Where it shows: the book row's meta on the master list (`src/app/books/list/page.tsx`, `row-meta`), the status control's date line (`src/components/BookStatus.tsx`, `src/components/FinishDate.tsx`: *Started …* beside *Finished …*, both with 1.5's picker, *Today · Pick a day · Year only · No date*), the run hero's span line (`src/components/IssueRow.tsx` `runhero`, data from `runDetail` in `src/db/queries.ts`; *Started Mar 2026*, or *Mar–Sep 2026* once finished) and 1.9's Done rows (`src/app/comics/status/page.tsx` with `doneRuns`; `src/app/books/status/page.tsx` with `src/components/StatusBookRow.tsx`). Days taken (*16 days*) is computed in the query, never stored (Hard rule 2). 3.5's book sheet shows both dates later (noted there).
- Design: mockup `blist` (the status control and its *Finished* date line), `spine` (the run hero), `status` (Done rows), in `design/mockups.html`; none draws a start yet. The feel pass draws *Started 21 Sep* on the books dashboard's current-read card (`design/Ledger Feel Review.dc.html`), the form the start's copy follows. Standing rule 6: the frames this task changes are redrawn in the same PR (`ui.redrawFiles`).
- Decisions: D-10 and D-21 (a date's precision; the finish year is derived), D-41 (no read state from the workbook), D-65 (`read_events` is the books' log; a reread is *Reading → Read*), D-73 and D-87 (Calibre's reads), D-91 (single user), R0-C1 (a status change never nulls `rating`), S-10.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim):
  - Setting a book to Reading writes `started_on` as today in Eastern, `exact`.
  - Finishing it appends a `read_events` row carrying the same start.
  - Rereading it sets a fresh `started_on` and leaves the first read's row as it
    was.
  - A start after the finish is refused and writes nothing; a `none` start has a
    NULL date.
  - `etl/test_views.sql`: `run_state.started_at` is the earliest dated read of the
    run's own placements, ignores a read of the same issue in another run and a
    `none` read, and is NULL for a run with no dated read.
  - `npm run test:db:reset` migrates from zero.
- [ ] AC-2: Against the TEST database (`test/reading-log.test.ts` or a new `test/start-dates.test.ts`): a `book_status` or `read_events` row with `started_on` set and precision `none`, or NULL and precision `exact`, violates its CHECK. A start after the finish returns 400 from `POST /api/progress/book`, and the book's `book_status` and `read_events` rows are byte-for-byte what they were. Setting *Reading* on a book whose existing `rating` is 4 leaves it 4 (R0-C1).
- [ ] AC-3: Given *Year only* 2025 chosen for a start, the stored start is `2025-07-01` / `approximate`; given *No date*, NULL / `none`; and *Undo* of the change that stamped a start puts back the start, precision and status that were there before (`undoBookStatus`).
- [ ] AC-4: On the master list, a book being read shows *Started* with its start in its row, and a finished one with a dated start shows its start, its finish and the days taken; the days taken equal the finish minus the start in days, computed in the query (a fixture: started 2026-03-01, finished 2026-03-17 shows *16 days*). A book with a `none` start shows no start and no days.
- [ ] AC-5: Given a run with dated reads in March and September 2026, its hero's span line reads *Started Mar 2026* while unread placements remain and *Mar–Sep 2026* once every placement is read, and its row on Status's *Done* tab shows the same span. A run whose reads are all `none` shows no span line.
- [ ] AC-6: The status control's date line and the run hero's span line meet the UX floor (`docs/04-design.md` § 10. The UX floor): *Started* and *Finished* are real buttons whose accessible names include the date they hold; the start's picker options are named radio inputs; the refused-start reason sits under the control and is announced; focus returns to the opener when the picker closes; nothing in either resolves to `--danger`; screenshots at every `ui.viewports` width, light and dark.

## Out of scope

- Loading start dates from the workbook (D-41) or from Calibre (1.18 loads Calibre's reads as Calibre has them, D-87).
- Audiobooks and *Listening* (1.23), which builds on these columns.
- Comic reads in `read_events`, or a stored start for a run: a run's start is derived only.
- 3.5's book and issue sheets, and 6.17's activity page, which show these dates later.
- Reading sessions and pace (2.1b, 2.1).
- Recounting `docs/STATUS.md` beyond this entry's tick.

## Files likely touched

- `src/db/schema.ts`: the four columns and two CHECKs; `drizzle/<tag>.sql` and `drizzle/meta/*` generated by `npm run db:generate`.
- `src/db/writes.ts`: `saveBookStatus` stamps, copies and refuses; `undoBookStatus` restores.
- `src/app/api/progress/book/route.ts`: the start in the request and the answer, and the 400.
- `src/lib/finish-date.ts`: the start's validation beside the finish's.
- `etl/views.sql` (`run_state.started_at`), `etl/test_views.sql` (AC-1's view cases).
- `src/db/queries.ts`: `listBooks`, `runDetail`, `doneRuns` and the books Done query select the start, the span and the days taken.
- `src/components/BookStatus.tsx`, `src/components/FinishDate.tsx`: *Started …* beside *Finished …*.
- `src/app/books/list/page.tsx`, `src/components/StatusBookRow.tsx`, `src/components/IssueRow.tsx`, `src/app/comics/status/page.tsx`: where it shows.
- `test/reading-log.test.ts` or `test/start-dates.test.ts` (new, DB), `test/reading-log.test.tsx` (the control), `test/e2e/status.spec.ts` or a new spec (the screens, with axe).
- `design/mockups.html`, `design/mockups-index.md`: the `blist`, `spine` and `status` frames that gain a start.
- `docs/03-data-model.md` § 2.18: *proposed, settled at its plan gate* becomes settled, with the plan's answers.

## Verification

- Automated: the DB test covers AC-1's book bullets, AC-2 and AC-3; `etl/test_views.sql` (`npm run test:views`) covers AC-1's view bullet; `npm run test:db:reset` from zero; `test/reading-log.test.tsx` and the e2e spec cover AC-4 to AC-6.
- Manual: on `npm run dev`, set a to-read book to *Reading* → expected: its row shows *Started* with today. Set it *Read → Today* → expected: its row shows the start, the finish and the days taken. Set it *Reading* again → expected: a fresh start, and the first read still in the log. Pick a start after the finish → expected: the reason under the control, and nothing saved. Undo each step, leaving the development data as found.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- `docs/03-data-model.md` § 2.18 says *proposed, settled at its plan gate*: settle it with the plan's answers (approved at plan) → docs/03-data-model.md § 2.18 (settled in this branch)

## Plan

Approved 2026-11-03 (owner), with the schema change. The plan gate settled:

- **A start belongs to the read in progress.** `book_status.started_on` is the
  start of the read not yet finished. Finishing moves it into the log: the new
  `read_events` row carries it and `book_status`'s goes back to NULL / `none`.
  A Read book's row reads its start from its latest `read_events` row.
- **Entering Reading stamps today (Eastern, `exact`) unless `book_status`
  already holds a start.** So *To read → Reading* and *DNF → Reading* keep the
  stored start (DNF never finished a read), and *Read → Reading* always gets a
  fresh one, because finishing cleared it.
- **The start is editable while Read**: *Started* on a Read book edits the
  latest read's start, as *Finished* edits its finish. A start after today is
  refused, as a finish is; so is a start after the finish (by year when either
  is `approximate`).
- **Undo** puts back the start, its precision and the status that were there,
  and for a re-dated read the event's start too.

Steps:

1. `src/db/schema.ts`: `started_on date NULL`, `started_on_precision text NOT
   NULL DEFAULT 'none'` on `book_status` and `read_events`, each with 2.17's
   CHECK pair; `npm run db:generate` writes `drizzle/0020_*` and meta. Nothing
   dropped or retyped: no down file; no new table: `export-tables.ts` unchanged.
2. `src/lib/finish-date.ts`: `resolveStart(choice, finish?, now)` beside
   `resolveFinish`, and `startAfterFinish(start, finish)`.
3. `src/db/writes.ts` `saveBookStatus` takes an optional `start` (accepted with
   `reading` and `read` only), stamps on entering Reading, copies onto the
   appended read and clears `book_status`'s, edits the latest read's start on a
   Read re-date; `BookStatusChange.prior` / `.edited` carry the start;
   `undoBookStatus` restores it. `src/app/api/progress/book/route.ts`: `start`
   in, 400 on a refused start before any write, the stored start in the answer.
4. `etl/views.sql`: `run_state.started_at`, the `MIN(completed_at)` of the same
   lateral join (`MIN` skips the `none` reads' NULLs). `etl/test_views.sql`:
   AC-1's view cases.
5. `src/db/queries.ts`: `listBooks` and `booksDone` select the shown start
   (`book_status`'s while not Read, the latest read's while Read) and
   `days_taken` (finish minus start, only when both are `exact`); `runDetail`
   and `doneRuns` select `started_at` and its precision.
6. `src/lib/format.ts`: `startWhen` (*21 Sep*, the year when not this year;
   `~2025` for a year only), `readDays` (*16 days*), `runSpan` (*Started Mar
   2026* / *Mar–Sep 2026*).
7. UI: `src/components/FinishDate.tsx` takes a legend (*Started* / *Finished*);
   `src/components/BookStatus.tsx` gains the date line, *Started …* and
   *Finished …* as buttons named with their dates, each opening the picker,
   the reason under the control in a live region, focus back on the opener;
   `src/app/books/list/page.tsx` row line; `src/components/StatusBookRow.tsx` +
   `src/app/books/status/page.tsx` Done rows; `src/components/IssueRow.tsx` +
   `src/app/comics/[runId]/page.tsx` the hero's span line;
   `src/app/comics/status/page.tsx` Done rows; `src/app/globals.css` the line's
   layout (tokens only).
8. `design/mockups.html` (`blist`, `spine`, `status` frames) and
   `design/mockups-index.md` redrawn; `docs/03-data-model.md` § 2.18 settled
   with the answers above.

Files beyond "Files likely touched": `src/lib/format.ts` (the formatters),
`src/app/comics/[runId]/page.tsx` (passes the span), `src/app/books/status/page.tsx`
(passes the dates), `src/app/globals.css` (the date line). Over 8 files with
schema and UI together: `never-split` keeps it whole, attended.

Test strategy:

- AC-1 book bullets, AC-2, AC-3: `test/start-dates.test.ts` (new, TEST DB,
  through the route), plus the queries behind AC-4 (16 days, `none` shows
  nothing) and AC-5 (both spans, `none`-only run has none).
- AC-1 view bullet: `etl/test_views.sql`; from zero: `npm run test:db:reset`.
- AC-4 to AC-6 on screen: `test/reading-log.test.tsx` (button names, radio
  inputs, the announced reason, focus return, no `--danger`) and
  `test/e2e/start-dates.spec.ts` (new: list row, run hero, Done rows, axe).
- Load: `load.ps1` / `load.sh` name their `\copy` columns, so the new columns
  take `'none'`; `test/load-scripts.test.ts` already pins the lists.

Risk: the hero's span is the server's, so a run's very first mark shows
*Started* after the next load (finishing already refreshes, `RefreshOnce`).

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
