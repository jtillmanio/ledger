---
id: TASK-025
title: 1.16 Dates in America/New_York
status: In progress
depends_on: [TASK-010]
size: L
model: opus
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: 2ccb788
---

# TASK-025 — 1.16 Dates in America/New_York

## Goal

A read marked *Today* late on the last evening of a month shows the day it was actually read, in Eastern time, everywhere the app shows it. Rows stored before the change still read the same calendar day after it.

## Context

- Roadmap: `docs/TASKS.md` § 1.16 Dates in `America/New_York` (sitting 5, after 1.5, and before START-HERE Step 14's final load). The roadmap entry and its **Check:** are the contract. Owner, 2026-10-10, follow-up from PR #67 (task 1.1).
- **Why this is one large task** (`workflow.splitPolicy: never-split`): storing a calendar day as Eastern midnight and formatting every date in Eastern have to land together. Otherwise a row written one way is read the other and moves a day.
- **Stop and ask at plan time** (CLAUDE.md: this changes how a stored date is written and read). The plan names every column it reinterprets: `issue_progress.completed_at` is a `timestamptz`. `book_status.finished_on` and `read_events.finished_on` are `date` columns (migration 0004, and 0011 from task 1.5), so they carry no time zone. The plan also says whether existing `completed_at` rows convert through a migration with a lossless down file (CLAUDE.md, *Migrations that drop or retype*) or through a re-extract before cutover.
- Where "today" is decided now (from TASK-010, 1.5):
  - `src/lib/finish-date.ts` `serverToday()` is the server's one *today*, UTC until this task. It feeds the future-day refusal on `/api/progress/book`, `PATCH /api/progress/issue` and `/api/progress/range`, and the books' *Today* (`resolveFinish`).
  - The pickers' `max` and the client *Today* are `localToday()` in `src/components/FinishDate.tsx` and `today()` in `src/components/RangeSheet.tsx`.
  - A picked day is written as its UTC midnight by `markRange` and `redateIssue` (`src/db/writes.ts`). *Today* on a comic is `now()`.
- Where dates are formatted, all in UTC now: `readWhen` (`src/lib/format.ts`; the spine's *read in …* hint and the run's *✓ read · date* badge, through `src/db/queries.ts`), the inbox's month (`src/lib/inbox.ts`), and the finish-date control's *Saved as …* line (`dayName` in `src/components/FinishDate.tsx`).
- Architecture: `docs/ARCHITECTURE.md` § 2. Decisions, 2.17 (a date with its precision). Decisions: D-10, D-21, D-65. Precision `none` stays NULL / `none` through any conversion (S-10).
- Design: the spine (`design/mockups.html` `spine`, the range sheet `range`) and `blist`'s second frame. Copy doesn't change, only which day it names.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): a vitest at `2026-10-31T21:30-04:00` marks *Today* and the row reads October 31 in the spine and the toast. A row stored before the change reads the same calendar day after it. A `none`-precision row is still `none` with a NULL date. The up → down → up test asserts row values, if a migration is used.
- [ ] AC-2: With the clock at `2026-10-31T23:30-04:00` (`2026-11-01T03:30Z`), a *Pick a date* of `2026-10-31` is accepted by `/api/progress/range`, `PATCH /api/progress/issue` and `/api/progress/book`, and `2026-11-01` is refused by each with 400. A book marked read with *Today* at that moment stores `finished_on = 2026-10-31`.
- [ ] AC-3: A picked day written by the range sheet or *Change date…* reads back as that same calendar day in `readWhen` and in the spine. Given *Pick a date* `2026-03-01`, the row's month reads `Mar 2026`, not `Feb 2026`, with the formatter's zone set to `America/New_York`.
- [ ] AC-4: Every client *today* (the pickers' `max`, the *Today* choice's *Saved as …* line) is the Eastern calendar day. At `2026-10-31T23:30-04:00`, the finish-date control's date input has `max="2026-10-31"`, whatever time zone the test runner is in.
- [ ] AC-5: The spine, the range sheet and the finish-date control still meet the UX floor (`docs/TASKS.md` § *The UX floor, for every UI task*): nothing changes but the day they name. Screenshots at each `ui.viewports` width, light and dark.

## Out of scope

- A time-zone setting, or any zone but `America/New_York`.
- Logging comic reads in `read_events` (D-65).
- Showing a time of day anywhere: dates stay calendar days and months.
- Retyping `book_status.finished_on` or `read_events.finished_on`. They are `date` columns already (R3-05).

## Files likely touched

- `src/lib/finish-date.ts`: `serverToday()` in Eastern.
- `src/lib/format.ts` (`readWhen`), `src/lib/inbox.ts`: format in Eastern.
- `src/db/writes.ts`: `markRange` and `redateIssue` store a day as its Eastern midnight.
- `src/components/FinishDate.tsx`, `src/components/RangeSheet.tsx`: the client *today* and `dayName` in Eastern.
- `src/app/api/progress/issue/route.ts`: `restore` keeps its exact text, unchanged in behaviour.
- `drizzle/<tag>.sql` and `drizzle/down/<tag>.sql` if existing `completed_at` rows convert by migration; otherwise `etl/extract.py` / the cutover note.
- `test/dates-eastern.test.ts` (new), and the 1.1 and 1.5 date tests (`test/range-marking.test.ts`, `test/reading-log.test.ts`) where they assert UTC midnights.

## Verification

- Automated: `test/dates-eastern.test.ts` covers AC-1 to AC-4 with the clock faked to `2026-10-31T21:30-04:00` and `2026-10-31T23:30-04:00`. If a migration is used, an up → down → up test asserts an exact row, an approximate row and a `none` row (AC-1).
- Manual: after 8pm Eastern on a month's last day, tick an issue with *Today* on the development database → expected: the spine and the toast name that day's month, not the next one.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- Candidate decision: a calendar day in `issue_progress.completed_at` is stored as its `America/New_York` midnight, every date is shown in Eastern, and migration 0012 moves existing UTC-midnight rows to Eastern midnight (amends the owner's 2026-10-10 "stored as its UTC midnight") → docs/review/decisions.md § D-67 (approved at plan)

## Plan

**Owner decision at the gate (CLAUDE.md, a stored date's meaning changes).** One column is reinterpreted: `issue_progress.completed_at` (`timestamptz`). `book_status.finished_on` and `read_events.finished_on` are `date`: their values don't change; only the *today* that writes them moves to Eastern. Existing rows convert **by migration** `drizzle/0012_dates_in_new_york.sql` (data only, `npx drizzle-kit generate --custom --name dates_in_new_york`) with a lossless `drizzle/down/0012_dates_in_new_york.sql`. Up: a row whose `completed_at` is exactly a UTC midnight (a picked day, Spread, Year only, Original copies of those) becomes the same calendar day's Eastern midnight: `((completed_at AT TIME ZONE 'UTC')::date::timestamp AT TIME ZONE 'America/New_York')`. A `now()` row is a moment and is left alone; `none` rows (NULL) are untouched. Down: a row exactly at an Eastern midnight goes back to that day's UTC midnight. Rejected: no migration and rely on Step 14's final load (workbook reads are all `none`), because development and preview rows would then read a day early and the **Check:** requires they don't.

Steps:
1. `src/lib/finish-date.ts`: `ZONE = "America/New_York"`; `easternDay(at: Date)` (`Intl` `en-CA`, `timeZone: ZONE`) and `today(now = new Date())` replace `serverToday`; `isFuture` and `resolveFinish` (Today, and Year only's cap, now the Eastern year rather than `getUTCFullYear`) use it. The module stays pure so the client imports it.
2. `src/lib/format.ts` `readWhen`: a bare `YYYY-MM-DD` (the books' `date` columns, `BookStatus.tsx`) formats as that calendar day, zone-free; a timestamp formats in `ZONE`. `src/lib/inbox.ts` month formatter: `timeZone: ZONE`.
3. `src/db/writes.ts`: `markRange` `date` and `spread` use `AT TIME ZONE 'America/New_York'`; `redateIssue` writes `${on}::date::timestamp AT TIME ZONE 'America/New_York'`; Today stays `now()`; doc comments updated.
4. `src/components/FinishDate.tsx` `localToday()` and `src/components/RangeSheet.tsx` `today()` return `today()` from step 1. `dayName` already formats a day string zone-free; its input is now Eastern.
5. Today decided in UTC elsewhere (inside the roadmap's "everywhere the app decides it"; strike at the gate if not): `src/db/queries.ts` upcoming releases `CURRENT_DATE` → `(now() AT TIME ZONE 'America/New_York')::date`; `src/app/api/export/route.ts` file stamp → `today()`.
6. The migration and down file above; `src/app/api/progress/issue/route.ts` `restore` unchanged.
7. Docs: `docs/ARCHITECTURE.md` § 2. Decisions 2.17 and `.claude/rules/schema.md` (the date bullet) gain one line: a calendar day is stored as its Eastern midnight and every date is shown in Eastern (1.16). Tick 1.16 in `docs/TASKS.md`.

Files: `src/lib/finish-date.ts`, `src/lib/format.ts`, `src/lib/inbox.ts`, `src/db/writes.ts`, `src/db/queries.ts`, `src/app/api/export/route.ts`, `src/components/FinishDate.tsx`, `src/components/RangeSheet.tsx`, `drizzle/0012_dates_in_new_york.sql`, `drizzle/meta/_journal.json`, `drizzle/meta/0012_snapshot.json`, `drizzle/down/0012_dates_in_new_york.sql`, `test/dates-eastern.test.ts` (new), `test/dates-eastern-migration.test.ts` (new), `test/range-marking.test.ts`, `test/reading-log.test.ts`, `docs/ARCHITECTURE.md`, `.claude/rules/schema.md`, `docs/TASKS.md`.

Test strategy (fake timers `toFake: ["Date"]`):
- AC-1 → `test/dates-eastern.test.ts` "Today at 21:30 Eastern on Oct 31": clock `2026-11-01T01:30Z`; a placement read at that moment (Postgres `now()` can't be faked, so the row is stamped with it) reads `Oct 2026` through `getRun`'s `last_read_when` and `read_elsewhere_when`, and the toast's `finishWords({ mode: "today" })` is `31 October 2026`. `test/dates-eastern-migration.test.ts` (0011's pattern, one rolled-back transaction): down, then legacy rows: exact `2026-03-01T00:00Z`, approximate `2019-07-01T00:00Z`, a moment `2026-11-01T01:30:00.123456Z`, a `none`; up → `2026-03-01T05:00Z`, `2019-07-01T04:00Z`, the moment unchanged, `none` with NULL, and `readWhen` gives `Mar 2026`, `~Jul 2019`, `Oct 2026`; down → the UTC values exactly; up again → same as the first up.
- AC-2 → same file, clock `2026-11-01T03:30Z`, through the route handlers: `2026-10-31` gets 200 and `2026-11-01` gets 400 from `/api/progress/range`, `PATCH /api/progress/issue` and `/api/progress/book`; a book's Today stores `finished_on = 2026-10-31`.
- AC-3 → same file: `markRange` and `redateIssue` with `2026-03-01` store `2026-03-01T05:00:00Z`, and `readWhen` and `getRun` read `Mar 2026`; `readWhen("2026-03-01", "exact")` is `Mar 2026` too.
- AC-4 → same file: with `process.env.TZ` set to `Pacific/Kiritimati` and then `Pacific/Honolulu`, at `2026-11-01T03:30Z` `today()` is `2026-10-31`, and `renderToStaticMarkup(createElement(FinishDate, …))` has `max="2026-10-31"`.
- AC-5 → ui-verifier: the spine, the range sheet and the finish-date control at every `ui.viewports` width, light and dark, copy unchanged.
- Existing: `test/range-marking.test.ts` (lines 117–118, 137–138) and `test/reading-log.test.ts` (340–341) expect Eastern midnights (`…T05:00:00.000Z` in winter, `…T04:00:00.000Z` in summer).

Risks / open questions:
- Approve the migration route above, or choose re-extract-only (then AC-1's "row stored before" sentence can't hold on development).
- A `now()` mark at exactly 00:00:00.000000 UTC (or Eastern) would be taken for a day. Microsecond timestamps make that negligible; the down file says so.
- Migration number: 0012 assumes this lands before TASK-011, whose migration becomes 0013. The second one to land regenerates its number (the staleness check forces a re-plan).
- DST: `AT TIME ZONE` handles both offsets, and the tests cover a March (EST) day and a July (EDT) day.

Plan revision 1 (implementation): `test/reading-log.test.tsx` joins the Files. Its *Change date… → Year only* case (line 302) asserts the UTC midnight the app wrote, `2019-07-01T00:00:00.000Z`; step 3 makes it `…T04:00:00.000Z`. It is the same kind of edit as `test/reading-log.test.ts:341`.

Plan revision 2 (verify R1): `test/resume-strip.test.tsx` joins the Files. Its *exact over guessed* case inserts a stored July 1st as `2025-07-01T00:00:00Z`, which now reads `Jun 2025` in Eastern. The fixture stores the day as 1.16 does, `2025-07-01T04:00:00Z`; the assertion (`Jul 2025`) is unchanged.

Size check: L by `never-split` (task Context says why: the write and the read must land together). About 19 files, one data-only migration with its down file, attended.

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
