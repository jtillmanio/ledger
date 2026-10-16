---
id: TASK-025
title: 1.16 Dates in America/New_York
status: Ready
depends_on: [TASK-010]
size: L
model: opus
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
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
