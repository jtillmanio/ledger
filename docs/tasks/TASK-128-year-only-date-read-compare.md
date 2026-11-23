---
id: TASK-128
title: 4.4b A year-only Calibre date isn't rewritten every sync
status: Review
depends_on: []
size: S
model: sonnet
autonomy: attended
ui: false
plan_status: approved
planned_at_commit: b4823c6
---

# TASK-128 — 4.4b A year-only Calibre date isn't rewritten every sync

## Goal

Once the sync writes reads into Calibre, a book whose Calibre date-read column shows only a year stops being rewritten on every run: a Ledger finish in that same year counts as already in step.

## Context

- Roadmap: `docs/05-roadmap.md` § 4.4b (added 2026-11-23, from TASK-082 and TASK-083's schema-review note that TASK-061's Context carried). Its **Check:** is AC-1, verbatim; proposed, and agreed by the owner merging the PR that adds it. Listed in `docs/06-tasklist.md` M16 beside 4.4.
- **Why before the books cutover.** The owner sets `CALIBRE_SYNC_READS=true` at the switch (TASK-061 § Context; `docs/OWNER-CHECKLIST.md` § Actions from follow-ups). Until then the command sends `#read` and `#date_read` in `missingColumns`, so `out()` skips them and the bug can't show. Since 2026-11-23 it is in 1.26's **Depends on** (D-172).
- **The loop, in code.** `etl/calibre.py` `read_date` (around line 288): a display format with no `d` and no `M` returns `str(day.year)`, `approximate`; one with `M` but no `d` keeps the stored day, `approximate`. `src/db/calibre-sync.ts` `calibreRead` (around line 392) turns a four-character `dateRead` into `YYYY-07-01`, `approximate`. The write-back (`out("#date_read", theirs.finishedOn, h.finishedOn)`, around line 593) compares with `same()`, by day. `etl/calibre_sync.py` `field_value` writes the Ledger's day at noon Eastern (D-67), and the next run reads it back as the year.
- **The fix the entry names:** when Calibre's value came as a year alone, compare years. A day-precise column, and a month-and-year one (which carries the stored day), compare days as now. The inbound side for a book new to the Ledger stays July 1st, `approximate` (data model 2.17; `docs/03-data-model.md` 2.17).
- Rules: `.claude/rules/schema.md` § *Calibre is the source of truth for a book's data and its reads* (the write-back paragraph). Decisions: D-67, D-87, D-88, D-133.
- Tests to extend: `test/calibre-sync.test.ts` (recorded payloads against the route's function on `TEST_DATABASE_URL`); `test/calibre-sync-command.test.ts` runs the Python command end to end with `CALIBRE_SYNC_READS=true` and may want one year-only fixture column (the plan decides).

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim): `npm
test` on the test database, with no column skipped: a Calibre record whose
date read is the year `2024` and a Ledger book finished 2024-03-14 (`exact`)
returns no `#date_read` write and logs none under what went out, and a second
run over the same records writes nothing either; the same record with the
Ledger finish on 2023-11-02 returns one `#date_read` write, `2023-11-02`; a
day-precise Calibre date of 2024-07-01 against the Ledger's 2024-03-14 returns
one write, as today; a book new to the Ledger from the year-only record has one
read finished 2024-07-01, `approximate`.
- [x] AC-2: Given a year-only Calibre date `2024` and a Ledger book with no finish (read, `none`, or no read at all), the sync returns the write it returns today (`#date_read` cleared or `#read` changed as now): matching by year never hides a missing finish.
- [x] AC-3: Given a month-and-year Calibre date whose stored day is 2024-03-10 (`approximate`) and a Ledger finish of 2024-03-14, the sync returns one `#date_read` write, `2024-03-14`: only a year-only value is compared by year.
- [x] AC-4: `.claude/rules/schema.md`'s write-back paragraph says a year-only date-read value is compared by its year, in the same PR.

## Out of scope

- Turning `CALIBRE_SYNC_READS` on, or anything else the owner does at the switch.
- How the command writes a date (`etl/calibre_sync.py` `field_value`) or how `etl/calibre.py` reads one.
- The *Calibre* page (TASK-083's), and deciding a near spelling (4.6, TASK-129).

## Files likely touched

- `src/db/calibre-sync.ts` — the `#date_read` comparison in the write-back.
- `test/calibre-sync.test.ts` — AC-1 to AC-3.
- `.claude/rules/schema.md` — AC-4.

## Verification

- Automated: `test/calibre-sync.test.ts` (AC-1, AC-2, AC-3) on `TEST_DATABASE_URL`; `npm run test:no-e2e`.
- Manual: none. The owner sees the effect after the switch: a second `npm run calibre:sync` over an unchanged library lists nothing under *Went out to Calibre*.

## Follow-ups

- An exact Ledger day in the same year as a year-only Calibre date never reaches Calibre unless the owner changes the column's display format (schema-reviewer's minor note). → not tracked: it is what the roadmap's Check asks for (a year in step with the Ledger's year), and Calibre cannot show the day.
- The second-run half of AC-1 could assert the whole `out` is empty (spec-reviewer and test-auditor notes). → not tracked: the second payload equals the first, whose whole `out` is asserted empty, so the added line proves nothing more.

## Plan

Approved by the owner, 2026-11-23.

**Cause.** `src/db/calibre-sync.ts`'s write-back compares `#date_read` by day
(`out("#date_read", theirs.finishedOn, h.finishedOn)`); a year-only `dateRead`
(`"2024"`) is `2024-07-01` through `calibreRead`, so any other Ledger day in
2024 differs, and goes out on every run.

**Steps**

1. Tests first, confirmed failing: a new `describe("a year-only date read
   (task 4.4b)")` in `test/calibre-sync.test.ts`, with the file's
   `book`/`read`/`status` helpers and `missingColumns: []` (no column skipped):
   - AC-1: year `2024` vs a Ledger finish 2024-03-14 (`exact`) → no
     `#date_read` in `report.out` (nor the logged report), and a second run
     over the same records → none; vs 2023-11-02 → one write, `to:
     "2023-11-02"`; a day-precise `2024-07-01` vs 2024-03-14 → one write; a
     book new to the Ledger from the year-only record → one read, 2024-07-01,
     `approximate`.
   - AC-2: year `2024` vs (a) a book read with precision `none`, (b) a book
     with no read at all → today's writes (`#date_read` cleared; `#read` and
     `#date_read`).
   - AC-3: `dateRead: "2024-03-10"`, `approximate` (month and year) vs
     2024-03-14 → one write, `2024-03-14`.
2. Fix, in `syncCalibre`'s write-back loop: when `rec.dateRead` is four
   characters and the Ledger's `finishedOn` is in that year, Calibre's side
   compares as the Ledger's day, so `same()` holds and nothing goes out.
   Everything else unchanged, the log's `from` (`2024-07-01`) included;
   `calibreRead` and the inbound side untouched.
3. AC-4: `.claude/rules/schema.md`'s write-back paragraph gains one clause: a
   date-read value Calibre shows as a year alone is in step with any Ledger
   finish in that year (task 4.4b); a day or month-and-year value compares by
   day.

**Files**

- `src/db/calibre-sync.ts`: the `#date_read` comparison.
- `test/calibre-sync.test.ts`: AC-1 to AC-3.
- `.claude/rules/schema.md`: AC-4.
- This task file.

**Test strategy.** AC-1–AC-3 in `test/calibre-sync.test.ts` on
`TEST_DATABASE_URL`; AC-4 is the rules diff, checked by spec-reviewer. No
`test/calibre-sync-command.test.ts` fixture: the bug and the fix live entirely
in the route's comparison, and the Python read and write are out of scope.

**Risks.** None found: one comparison, reached only by a four-character
`dateRead`.

**Follow-ups.** None found at plan.

## Review log

Verify R1 FAIL (1: `books-dashboard.test.ts`, an unrelated 5 s timeout under full parallel load; passes alone, 51/51) → R2 PASS | Audit R1 PASS (the in-step test fails on the base, the other six are guards) | Spec R1 APPROVE | Schema R1 APPROVE | UI n/a (`ui: false`) | CI R1 PASS (`check`, all ten e2e shards, Vercel) | Drift R1 merge as-is (0 behind) | Round 2 reviews not needed: nothing changed after either approved.

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 2 (R1's one failure was an unrelated timeout)
- Review rounds: 1
- First-pass AC FAILs: 0
- Plan revisions after approval: 0
