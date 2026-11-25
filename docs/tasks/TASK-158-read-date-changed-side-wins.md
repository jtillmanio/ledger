---
id: TASK-158
title: 4.4c A listen's date in Calibre, and a date changed on either side (2 of 2) — the side that changed wins
status: Ready
depends_on: [TASK-157]
size: M
model: opus
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
---

# TASK-158 — 4.4c A listen's date in Calibre, and a date changed on either side (2 of 2) — the side that changed wins

## Goal

From the books cutover, a read or listen date changed in Calibre comes into the Ledger, unless the Ledger changed it too, in which case the Ledger's stands and the run says so.

## Context

- Roadmap: `docs/05-roadmap.md` § 4.4c (M16). Feature F-58. Its **Check:** is AC-1, verbatim; proposed in PR #342 and agreed when it merged (2026-11-25).
- **Split, 2 of 2.** TASK-157 writes `#listened_date` out.
- **D-184** (amends D-133): for `#date_read` and `#listened_date`, compare Calibre's value with what it held at the end of the last run. Changed in Calibre only: re-date that read (the latest read, or the latest listen) through `redateBookRead` (`src/db/writes.ts`, 1.17b), and list it under *in*. Changed in the Ledger only: written out, as now. Both: the Ledger's is written and the run lists the conflict. A cleared Calibre date never unreads a book: a conflict. Only with `CALIBRE_SYNC_READS` on; before, reads come only through extract (D-87).
- **Stop and ask at plan time: the last value.** The run log (`calibre_syncs.report`) stores what changed (`in`, `out`), not every book's value. If the last value can't be read from it, keeping it is a new record, which is a schema change (CLAUDE.md). The plan states which, and asks before any migration.
- **What exists.** `syncCalibre` in `src/db/calibre-sync.ts` (one transaction, one log row); `src/lib/calibre-log.ts` and `src/app/settings/calibre/page.tsx` draw each run's changes.
- Rules: `.claude/rules/schema.md` (Calibre is the source of truth for a book's data; the Ledger's reads; rank moves only through the rank helpers: a re-date that moves a ranked read leaves its year, `leaveYear`). Decisions: D-133, D-184, D-87, D-169.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves the changed-date and conflict clauses, TASK-157 the writes):
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
- [ ] AC-2: Given Calibre's `#date_read` changed to another year on a ranked read and the Ledger unchanged, the read is re-dated and leaves its old year's ranking in the same transaction (`leaveYear`, D-169).
- [ ] AC-3: Given Calibre's date cleared on a read book, the book stays read, its date is unchanged, and the report lists the conflict.
- [ ] AC-4: Given the first run after this change (no earlier value to compare), nothing is taken in and the Ledger's dates are written, as before.

## Out of scope

- Any other Calibre column changing direction (status and owned stay the Ledger's).
- Showing conflicts anywhere but the run's report and its existing page listing.

## Files likely touched

- `src/db/calibre-sync.ts` — the comparison, the re-date, the conflict entries.
- `src/db/writes.ts` — `redateBookRead` reused under the sync's transaction.
- `src/lib/calibre-log.ts` — conflict entries read for the page, if the report shape gains a kind.
- `test/calibre-sync.test.ts` — AC-1's changed-date clauses, AC-2 to AC-4.
- `src/db/schema.ts`, `drizzle/` — only if the owner approves a record of last values.

## Verification

- Automated: `test/calibre-sync.test.ts` on the test database (two runs per case, with `CALIBRE_SYNC_READS` on and off).
- Manual: after the cutover, the owner changes one `#date_read` in Calibre and syncs → expected: the run's log lists it under *in* and the book's date line shows Calibre's day.

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
