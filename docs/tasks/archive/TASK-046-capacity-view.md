---
id: TASK-046
title: 2.1 Capacity view
status: Done
depends_on: [TASK-011, TASK-045]
size: M
model: opus
autonomy: attended
ui: false
plan_status: approved
planned_at_commit: 66d0a59
---

# TASK-046 — 2.1 Capacity view

## Goal

The Ledger can say how full each planned year and quarter is against what you can actually read at your settings, and how much of that figure rests on estimated word counts, so the dashboard and the plan can answer "is 2027 overcommitted".

## Context

- Roadmap: `docs/05-roadmap.md` § 2.1 Capacity view (M10, after 2.0; pulled ahead of cutover by 1.25). The roadmap entry and its **Check:** are the contract. Features: F-21. Depends on 1.7 (TASK-011, the one `period` column and `plan_period`) and 2.0 (TASK-045, the settings it reads).
- **The rule** (the entry, D-37): planned word counts summed per year and per quarter against capacity. A quarter row (`2027-Q1`) counts against its quarter and its year; a bare-year row (`2027`) counts against its year and no quarter; On deck and Someday count against nothing. Annual capacity is minutes a day × words a minute × the days in the year (45 × 185 × 365 = 3,038,625 words); a quarter is a quarter of that (≈ 760k). Read year, quarter and level through `plan_period` and `to_read_level` (`etl/views.sql`), never by parsing `period` (`.claude/rules/schema.md`).
- **Estimates.** A word count missing a `stated` value falls back to `page_count × 275`, marked `estimated`; the result reports what share rests on estimates. Today `books.word_count_source` is `stated` or `estimated` (null exactly when the count is), and `reading_settings.words_per_page` is 275 by default: the plan says whether the fallback reads the setting or the constant the entry names, and how a book with neither a count nor a page count is reported (it can't silently count as 0).
- *From TASK-022 (1.14, PR #130), amended 2026-10-28 (D-94):* a page count is Calibre's `#pages`, else Hardcover's by ISBN, so a picture-book page count (16 pages × 275 = a 4,400-word *Sorcerer's Stone*) should be rarer, but **the plan still says how an implausible page count is treated**: a floor, a flag, or a `hand` row in `etl/data/book_details.csv`, which enrich never overwrites.
- **Ask at the plan gate:** whether a book already read still counts against the period it was planned in (2.2's strip reads *3 of 7 read · 615k planned*, which suggests planned includes the read ones); and whether a listen counts (owner, 2026-10-31, at 1.23: a listen runs alongside the year's reading, never against the word budget, so an `audio` read doesn't count against capacity).
- **Derived, never stored** (Hard rule 2): the view goes in `etl/views.sql` with its cases in `etl/test_views.sql`, and joins the views table in `docs/03-data-model.md` § 3. Views ("Views a task proposes … the capacity view 2.1"). A read for one year filters by that year before it aggregates (architecture § Operational posture). Raw SQL in `src/db/queries.ts` for anything joining views.
- TASK-045's open question may land AC-1 of 2.0 here: if the owner chose (a) at 2.0's plan gate, this task's AC-2 is where "changing 45 to 60 min/day moves the 2027 figure" is proven against the view.
- *From TASK-045 (2.0, PR #193):* the owner chose (a) at 2.0's plan gate (2026-11-04). 2.0 proves its half of the Check (an edit of `reading_settings` is read live, and Settings' *a year* card moves), and this task's AC-2 is the half that proves "45 → 60 min/day moves the 2027 figure" against the view. 2.0's roadmap box and its task-list Done cell stay open until this task closes; tick both then. 2.0 ships `readingSettings(userId)` in `src/db/queries.ts` (the row, or the defaults 45 / 185 / 275 when there is none) and `src/lib/settings.ts` (`wordsPerYear`, the bounds): read capacity through them, never from `reading_settings` directly.
- *From TASK-045 (2.0, PR #193), open question for the plan:* the mockup's *Estimate missing counts* switch has no column in `reading_settings`, and 2.0 leaves it off Settings. This task already falls back to `page_count × 275` (*Estimates* above): decide whether estimates can be switched off, and if so where the switch is kept (a column is the owner's to approve) and that Settings draws it.
- Readers, later: 2.2's *This quarter* strip (its planned total must equal this task's figure for that quarter, 2.2's Check), 2.2b's rail rule, 2.3's move sheet, 2.7's rebalance.
- Decisions: D-37 (levels), D-38 (no months), D-7 (figures in prose are sample data; the Check builds its own fixture), D-85 and the 2026-10-31 settlement in TASK-043 (listens don't count against capacity), D-94. S-06 (the Check's corrected figure).

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim): test with 45 min/day at 185 wpm over 2027 and a fixture plan of
3.58M words returns 118% ± 1% (3,585,000 / 3,038,625), and reports what share
rests on estimates. (The check once said 4.1M, which is 135%: S-06.)
- [x] AC-2: Given that fixture, changing `minutes_per_day` from 45 to 60 changes 2027's capacity to 60 × 185 × 365 = 4,051,500 and its load to 88% ± 1%, with no other write; each 2027 quarter's capacity is a quarter of the year's.
- [x] AC-3: Given a book in `2027-Q1`, one in bare `2027`, one `on_deck` and a Someday book (no plan row): 2027's planned total includes the first two; 2027-Q1's includes only the first; no quarter includes the bare-year book; neither the On deck nor the Someday book appears in any total.
- [x] AC-4: Given 2027 with a 300k `stated` book and a book with no word count and 400 pages, the year reports 300k stated plus the 400-page book's estimate marked estimated, and an estimated share equal to estimate ÷ total; a book with neither a count nor a page count is counted and reported as unknown (never as 0 words), and an implausible page count is treated as the plan states.
- [x] AC-5: A soft-deleted book (`deleted_at` set) planned in 2027 counts in no total; the view's cases are in `etl/test_views.sql` and `npm run test:views` passes, with every existing case unchanged.

## Out of scope

- Any screen: the strip is 2.2's (TASK-049), the rail 2.2b's (TASK-051), the move and rebalance sheets 2.3 and 2.7.
- Measured pace from sessions (2.1b) and an audiobook budget (owner, 2026-10-31: maybe later).
- Fixing page counts in the data: an implausible count is treated, not corrected, here.
- Monthly capacity (D-38).

## Files likely touched

- `etl/views.sql` — the capacity view(s), per year and per quarter, with the estimated share.
- `etl/test_views.sql` — AC-1, AC-3, AC-4, AC-5 cases.
- `src/db/queries.ts` — a typed read of a year's and a quarter's capacity for 2.2 to call.
- `test/capacity.test.ts` (new) — AC-2 through the query, against the TEST database.
- `docs/03-data-model.md` — § 3. Views, the new row.

## Verification

- Automated: `etl/test_views.sql` (via `npm run test:views`) for the view's cases; `test/capacity.test.ts` for the settings edit moving the figure.
- Manual: with `npm run dev` against the development database, query the view for 2027 and compare its planned total with the sum of 2027's books in the Library's *To read* filter → expected: equal, with the estimated share reported.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- 2.0's roadmap box and its task-list Done cell were to stay open until this task closed (TASK-045's note) → not tracked: both were already ticked when TASK-045 was accepted; nothing left to tick
- Decision: what counts against capacity (the owner's answers at the plan gate, 2026-11-04, and the stored-estimate ruling at spec review R1, option b) → docs/review/decisions.md § D-115 (approved at plan)
- 2.2's *This quarter* strip reads its figure through `planCapacity(userId, year)`: the quarter's `plannedWords` against `capacity` for *615k planned · 760k a quarter*, and `readBooks` of `books` for *3 of 7 read*; unknown books are counted but add no words → docs/tasks/TASK-049-books-dashboard.md § Context
- Schema review: a later change to either view's column list or types needs a `DROP VIEW plan_capacity, plan_book_words` first, as `CREATE OR REPLACE` can't change them → not tracked: informational, true of every view in `etl/views.sql`
- Schema review: `test/plan-period-migration.test.ts`'s after-down check names only `plan_period` and `to_read_level` → not tracked: the down file drops the new views first and the up → down → up test fails without it, which the test audit confirmed
- Manual check: the view's 2027 total equals the Library's *To read* 2027 filter only when no planned book is read and none is planned in two years (the filter lists every to-read book with any plan row in the year) → not tracked: expected, stated in the plan's Risk

## Plan

Approved by the owner 2026-11-04. Answers at the gate:

1. A read book still counts against the period it was planned in: `to_read`, `reading` and `read` count (2.2's *3 of 7 read · 615k planned*). `listening`, `dnf`, `unlisted`, and a read book whose only reads are listens (D-112) count against nothing.
2. A page count under 50 is implausible: that book counts as unknown, never estimated (the picture-book *Sorcerer's Stone*, 16 pages; a real novella like *Binti* is 96). The floor applies only to the view's own fallback: a count already stored as `estimated` (the add flow's pages × words per page, `newBookRow`) is trusted whatever its page count (owner, 2026-11-04, at spec review R1, option b).
3. Estimates can't be switched off: no column, no switch. The view reports stated and estimated words apart, so a reader can show either; the mockup's *Estimate missing counts* stays unbuilt, as 2.0 left it.

**The view** `plan_capacity` (`etl/views.sql`): one row per user and period, the year (`period` `2027`) and each of its four quarters (`2027-Q1`…; an empty quarter is a row at 0) for every year a counted book is planned in. Columns: `user_id, period, year, quarter` (NULL on the year row), `capacity` (minutes × wpm × the year's days; a quarter a quarter of it), `planned_words, stated_words, estimated_words, books, read_books, unknown_books, load` (planned ÷ capacity), `estimated_share` (estimated ÷ planned, NULL at 0). Capacity and `words_per_page` read `reading_settings` live; no row reads the column defaults 45 / 185 / 275. A book counts once, at its earliest dated period (`to_read_level`'s rule: a quarter before its own bare year), found with `NOT EXISTS`, not `DISTINCT ON`, so a `year =` filter pushes down before the aggregate. Year, quarter and level come from `plan_period` (no parsing of `period`); On deck counts nowhere, Someday has no plan row; soft-deleted books are out (through `plan_period`). A book's words: `word_count` when set (a stored `estimated` stays estimated); else `page_count × words_per_page` when the page count is at least 50, estimated; else unknown: in `books` and `unknown_books`, in no word total.

**Implemented as two views** (Phase 2): the per-book step is its own view, `plan_book_words` (one row per counted book: period, status, words, `word_source`), because `plan_capacity` reads it for the year row and each quarter, and a CTE read twice is materialized for every reader and year before the year filter applies. 2.3's move sheet can read a book's words from it.

**Revision 1** (approved by the owner 2026-11-04): `drizzle/down/0013_plan_period.sql` and `drizzle/down/0011_dated_reading_log.sql` drop `plan_period` and `book_reads` by name, without `CASCADE`, and the new views depend on them, so 0007's, 0011's and 0013's up → down → up tests failed. Each down file now drops `plan_capacity` and `plan_book_words` first, as 0013's already drops `to_read_level`; no row handling changes.

**Steps**

1. `etl/test_views.sql` cases first, seen failing: AC-1 (3,585,000 words at 45/185 over 2027 → 118% ± 1%, with its estimated share), AC-3 (the four levels), AC-4 (stated, a 400-page estimate, an unknown, a 16-page implausible count), AC-5 (a soft-deleted book), the answers above (read counts, listening/dnf/listen-only don't), and a book planned `2027-Q4` and `2028` counting once, in 2027.
2. The view in `etl/views.sql`.
3. `planCapacity(userId, year)` in `src/db/queries.ts`: the year and its four quarters, typed; a year with nothing planned filled from `readingSettings()` and `wordsPerYear()`.
4. `test/capacity.test.ts` (AC-2): 45 → 60 through 2.0's settings write gives 4,051,500 and 88% ± 1% with nothing else written, each quarter a quarter of the year; the view's capacity equals `wordsPerYear()`; no settings row reads the defaults; an empty year through `planCapacity`; `EXPLAIN` shows the `reading_plan` scan carries the year filter.
5. `docs/03-data-model.md` § 3. Views: the `plan_capacity` row.
6. Close-out: decision row in `docs/review/decisions.md`; roadmap ticks 2.1 and 2.0, task-list Done cells.

**Files:** `etl/views.sql`, `etl/test_views.sql`, `src/db/queries.ts`, `test/capacity.test.ts` (new), `docs/03-data-model.md`; `docs/review/decisions.md` (not in Files likely touched: the approved decision).

**Test strategy:** AC-1, AC-3, AC-4, AC-5 → `etl/test_views.sql` (`npm run test:views`); AC-2 → `test/capacity.test.ts`; manual: the view for 2027 against the Library's *To read* 2027 filter.

**Risk:** the manual check's "equal" holds only when no planned book is read and none is planned in two years: the Library's year filter lists every `to_read` book with any plan row in that year, the view also counts read books and counts a two-year book in its earlier year only. A difference of exactly those books is expected, and is reported, not called a failure.

## Review log

- Verify R1 round FAIL(1: the EXPLAIN test asserted a statistics-dependent scan) → full PASS | R2 round PASS (after review fixes)
- Audit R1 PASS (every AC PROVEN; 10 mutations caught; the down-file change discriminating)
- Spec R1 CHANGES (SPEC GAP: a stored estimate under 50 pages; owner chose b, trust it; follow-up destinations at close-out) → R2 APPROVE
- Schema R1 APPROVE (2 MINOR: make_date at year 0000, int product before float8; both fixed) → R2 APPROVE
- UI: not run (`ui: false`, no UI files)

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 2 (R1 round + full, R2 round)
- Review rounds: 2
- First-pass AC FAILs: 0
- Plan revisions after approval: 1 (the two down files)
