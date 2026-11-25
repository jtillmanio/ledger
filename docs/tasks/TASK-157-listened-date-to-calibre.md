---
id: TASK-157
title: 4.4c A listen's date in Calibre, and a date changed on either side (1 of 2) — #listened_date
status: Ready
depends_on: []
size: M
model: opus
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
---

# TASK-157 — 4.4c A listen's date in Calibre, and a date changed on either side (1 of 2) — #listened_date

## Goal

The Calibre sync writes the finish of the latest listen into Calibre's `#listened_date`, the way it writes `#date_read`.

## Context

- Roadmap: `docs/05-roadmap.md` § 4.4c A listen's date in Calibre, and a date changed on either side (M16 in `docs/06-tasklist.md`). Feature F-58. Its **Check:** is AC-1, verbatim; proposed in PR #342 and agreed when it merged (2026-11-25).
- **Split, 1 of 2.** This part writes `#listened_date` out; TASK-158 takes a changed date in, the side that changed winning (D-184).
- **What exists.** `etl/calibre_sync.py` (task 4.4, D-133) writes `COLUMNS = ("#read", "#date_read", "#ledger_status", "#owned")` with `calibredb set_metadata`, `READ_COLUMNS` held back until `CALIBRE_SYNC_READS` is on; `field_value` formats each. The app's side, `src/db/calibre-sync.ts`, answers `holdingsFor` (the latest read's finish and precision) and lists `out` writes per `CALIBRE_COLUMNS`; 4.4b compares a year-only Calibre date by its year.
- **The listen's finish** is the latest `read_events` row with `format = 'audio'` (1.23, D-85), its day at noon Eastern; a year-only finish is kept as 4.4b keeps it; no dated listen clears the column. It is a read, so it waits for `CALIBRE_SYNC_READS` like `#date_read`.
- Rules: `.claude/rules/schema.md` (the sync writes back only through `calibredb`; its column list gains `#listened_date` in this PR). `docs/COMMANDS.md` names the new flag. Decisions: D-133, D-184, D-85.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves its writes, the missing column and the switch, TASK-158 the changed-date clauses):
with
the test database and `CALIBRE_SYNC_READS` on: a book with a text read
finished 2026-03-01 and an audio read finished 2026-05-02 gets `#date_read` and
`#listened_date` 2026-05-02, and a book with only a text read gets no
`#listened_date`. On the next run, with Calibre's `#listened_date` changed to
2026-05-09 and the Ledger unchanged, the audio read finishes 2026-05-09 and the
report lists it under *in*, with nothing out for that column; with both sides
changed, the Ledger's date is written and the report lists the conflict. A
library without `#listened_date` is named and skipped, and the run succeeds.
With `CALIBRE_SYNC_READS` off, a changed Calibre date writes nothing to
`read_events`.
- [ ] AC-2: Given `CALIBRE_SYNC_READS` off, `#listened_date` is not written, as `#date_read` isn't, and the run names it as held.
- [ ] AC-3: `py etl/calibre_sync.py --listened-column '#my_listen'` writes that column; the default is `#listened_date`.
- [ ] AC-4: Given a listen finished `approximate` in 2025 and Calibre's `#listened_date` showing 2025 alone, the run writes nothing for it (4.4b's rule).

## Out of scope

- Taking Calibre's `#listened_date` into the Ledger (TASK-158).
- Creating the column in the owner's Calibre (the owner does it).

## Files likely touched

- `etl/calibre_sync.py` — `#listened_date` in the columns, `--listened-column`, `field_value`.
- `etl/test_calibre_sync.py` — the flag, the held column.
- `src/db/calibre-sync.ts` — `CALIBRE_COLUMNS`, the latest listen in `holdingsFor`, its `out`.
- `test/calibre-sync.test.ts` — AC-1's write clauses, AC-2, AC-4.
- `docs/COMMANDS.md`, `.claude/rules/schema.md` — the new column.

## Verification

- Automated: `test/calibre-sync.test.ts` on the test database; `py -m unittest etl.test_calibre_sync`.
- Manual: none against the owner's library; the owner's first sync with the column shows it in the run's `out`.

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
