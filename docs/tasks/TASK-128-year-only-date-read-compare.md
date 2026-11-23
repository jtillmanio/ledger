---
id: TASK-128
title: 4.4b A year-only Calibre date isn't rewritten every sync
status: Draft
depends_on: []
size: S
model: sonnet
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
---

# TASK-128 — 4.4b A year-only Calibre date isn't rewritten every sync

## Goal

Once the sync writes reads into Calibre, a book whose Calibre date-read column shows only a year stops being rewritten on every run: a Ledger finish in that same year counts as already in step.

## Context

- Roadmap: `docs/05-roadmap.md` § 4.4b (added 2026-11-23, from TASK-082 and TASK-083's schema-review note that TASK-061's Context carried). Its **Check:** is AC-1, verbatim; proposed, and agreed by the owner merging the PR that adds it. Listed in `docs/06-tasklist.md` M16 beside 4.4.
- **Why before the books cutover.** The owner sets `CALIBRE_SYNC_READS=true` at the switch (TASK-061 § Context; `docs/OWNER-CHECKLIST.md` § Actions from follow-ups). Until then the command sends `#read` and `#date_read` in `missingColumns`, so `out()` skips them and the bug can't show. It is not in 1.26's **Depends on**; whether it should be is the owner's call.
- **The loop, in code.** `etl/calibre.py` `read_date` (around line 288): a display format with no `d` and no `M` returns `str(day.year)`, `approximate`; one with `M` but no `d` keeps the stored day, `approximate`. `src/db/calibre-sync.ts` `calibreRead` (around line 392) turns a four-character `dateRead` into `YYYY-07-01`, `approximate`. The write-back (`out("#date_read", theirs.finishedOn, h.finishedOn)`, around line 593) compares with `same()`, by day. `etl/calibre_sync.py` `field_value` writes the Ledger's day at noon Eastern (D-67), and the next run reads it back as the year.
- **The fix the entry names:** when Calibre's value came as a year alone, compare years. A day-precise column, and a month-and-year one (which carries the stored day), compare days as now. The inbound side for a book new to the Ledger stays July 1st, `approximate` (data model 2.17; `docs/03-data-model.md` 2.17).
- Rules: `.claude/rules/schema.md` § *Calibre is the source of truth for a book's data and its reads* (the write-back paragraph). Decisions: D-67, D-87, D-88, D-133.
- Tests to extend: `test/calibre-sync.test.ts` (recorded payloads against the route's function on `TEST_DATABASE_URL`); `test/calibre-sync-command.test.ts` runs the Python command end to end with `CALIBRE_SYNC_READS=true` and may want one year-only fixture column (the plan decides).

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): `npm
test` on the test database, with no column skipped: a Calibre record whose
date read is the year `2024` and a Ledger book finished 2024-03-14 (`exact`)
returns no `#date_read` write and logs none under what went out, and a second
run over the same records writes nothing either; the same record with the
Ledger finish on 2023-11-02 returns one `#date_read` write, `2023-11-02`; a
day-precise Calibre date of 2024-07-01 against the Ledger's 2024-03-14 returns
one write, as today; a book new to the Ledger from the year-only record has one
read finished 2024-07-01, `approximate`.
- [ ] AC-2: Given a year-only Calibre date `2024` and a Ledger book with no finish (read, `none`, or no read at all), the sync returns the write it returns today (`#date_read` cleared or `#read` changed as now): matching by year never hides a missing finish.
- [ ] AC-3: Given a month-and-year Calibre date whose stored day is 2024-03-10 (`approximate`) and a Ledger finish of 2024-03-14, the sync returns one `#date_read` write, `2024-03-14`: only a year-only value is compared by year.
- [ ] AC-4: `.claude/rules/schema.md`'s write-back paragraph says a year-only date-read value is compared by its year, in the same PR.

## Out of scope

- Turning `CALIBRE_SYNC_READS` on, or anything else the owner does at the switch.
- How the command writes a date (`etl/calibre_sync.py` `field_value`) or how `etl/calibre.py` reads one.
- The *Calibre* page (TASK-083's), and deciding a near spelling (4.6, TASK-129).
- Adding 4.4b to 1.26's **Depends on**: an owner decision, not this task's.

## Files likely touched

- `src/db/calibre-sync.ts` — the `#date_read` comparison in the write-back.
- `test/calibre-sync.test.ts` — AC-1 to AC-3.
- `.claude/rules/schema.md` — AC-4.

## Verification

- Automated: `test/calibre-sync.test.ts` (AC-1, AC-2, AC-3) on `TEST_DATABASE_URL`; `npm run test:no-e2e`.
- Manual: none. The owner sees the effect after the switch: a second `npm run calibre:sync` over an unchanged library lists nothing under *Went out to Calibre*.

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
