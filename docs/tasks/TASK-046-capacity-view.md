---
id: TASK-046
title: 2.1 Capacity view
status: Ready
depends_on: [TASK-011, TASK-045]
size: M
model: opus
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
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
- *From TASK-045 (2.0, task/2.0-settings):* the owner chose (a) at 2.0's plan gate (2026-11-04). 2.0 proves its half of the Check (an edit of `reading_settings` is read live, and Settings' *a year* card moves), and this task's AC-2 is the half that proves "45 → 60 min/day moves the 2027 figure" against the view. 2.0's roadmap box and its task-list Done cell stay open until this task closes; tick both then. 2.0 ships `readingSettings(userId)` in `src/db/queries.ts` (the row, or the defaults 45 / 185 / 275 when there is none) and `src/lib/settings.ts` (`wordsPerYear`, the bounds): read capacity through them, never from `reading_settings` directly.
- *From TASK-045 (2.0, task/2.0-settings), open question for the plan:* the mockup's *Estimate missing counts* switch has no column in `reading_settings`, and 2.0 leaves it off Settings. This task already falls back to `page_count × 275` (*Estimates* above): decide whether estimates can be switched off, and if so where the switch is kept (a column is the owner's to approve) and that Settings draws it.
- Readers, later: 2.2's *This quarter* strip (its planned total must equal this task's figure for that quarter, 2.2's Check), 2.2b's rail rule, 2.3's move sheet, 2.7's rebalance.
- Decisions: D-37 (levels), D-38 (no months), D-7 (figures in prose are sample data; the Check builds its own fixture), D-85 and the 2026-10-31 settlement in TASK-043 (listens don't count against capacity), D-94. S-06 (the Check's corrected figure).

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): test with 45 min/day at 185 wpm over 2027 and a fixture plan of
3.58M words returns 118% ± 1% (3,585,000 / 3,038,625), and reports what share
rests on estimates. (The check once said 4.1M, which is 135%: S-06.)
- [ ] AC-2: Given that fixture, changing `minutes_per_day` from 45 to 60 changes 2027's capacity to 60 × 185 × 365 = 4,051,500 and its load to 88% ± 1%, with no other write; each 2027 quarter's capacity is a quarter of the year's.
- [ ] AC-3: Given a book in `2027-Q1`, one in bare `2027`, one `on_deck` and a Someday book (no plan row): 2027's planned total includes the first two; 2027-Q1's includes only the first; no quarter includes the bare-year book; neither the On deck nor the Someday book appears in any total.
- [ ] AC-4: Given 2027 with a 300k `stated` book and a book with no word count and 400 pages, the year reports 300k stated plus the 400-page book's estimate marked estimated, and an estimated share equal to estimate ÷ total; a book with neither a count nor a page count is counted and reported as unknown (never as 0 words), and an implausible page count is treated as the plan states.
- [ ] AC-5: A soft-deleted book (`deleted_at` set) planned in 2027 counts in no total; the view's cases are in `etl/test_views.sql` and `npm run test:views` passes, with every existing case unchanged.

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
