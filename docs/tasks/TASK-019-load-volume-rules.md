---
id: TASK-019
title: 1.12 Load the volume map into volume_rules
status: Draft
depends_on: [TASK-018]
size: S
model: sonnet
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
---

# TASK-019 — 1.12 Load the volume map into volume_rules

## Goal

The approved volume rules (which year a bare series name means) are in the database before cutover, so they can be edited in the app later instead of retyped by hand.

## Context

- Roadmap: `docs/TASKS.md` § 1.12 Load the volume map into `volume_rules` (sitting 7; it must land before Step 14's final load, the last time `load` runs). It is the load half of 3.9. The roadmap entry and its **Check:** are the contract.
- Data model: `src/db/schema.ts` `volumeRules` (created by 0.3, empty today). `etl/extract.py` `load_volume_map` reads `etl/data/volume_map.csv` and applies the approved rules to labels, but never writes them to `seed/`.
- What changes: extract writes `seed/volume_rules.csv` from the same approved rows (series text verbatim, `run_id` NULL for an any-run rule, `issue_from` / `issue_to` NULL for any issue, `year`). A row flagged `approved with no year` is not written. `etl/load.ps1` and `etl/load.sh` copy it after `runs` (its `run_id` is a foreign key), and `npm run rebuild`'s row counts list it (`etl/rebuild.ps1`, `etl/rebuild.sh`).
- No schema change, and nothing reads the table until 3.9. Labels are already normalised by extract.
- Decisions: D-16, D-18 (load first, then run in parallel; no load after Step 14). Standing rule 4: a new seed file, other outputs unchanged. Re-run against both workbooks and diff. psql `\copy` paths need forward slashes on Windows (CLAUDE.md).
- `depends_on` TASK-018 records the sitting's build order, not a data dependency.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): `npm run test:etl` covers a fixture map holding a run-scoped rule, an any-run rule and an approved row with no year, and asserts that `seed/volume_rules.csv` holds exactly the first two, with `run_id` NULL on the second. `npm run rebuild` (development) reports a `volume_rules` count equal to the approved rows in `volume_map.csv`.
- [ ] AC-2: The CSV's header matches `volume_rules`' column order, so `\copy` needs no column list beyond the one `load` already uses for other tables. An issue-range rule keeps its `issue_from` and `issue_to`, and an any-issue rule writes them as NULL (empty in the CSV, loaded as NULL).
- [ ] AC-3: `etl/load.ps1` and `etl/load.sh` both copy `volume_rules` after `runs`, and both still refuse when `LEDGER_LIVE=true` (the existing guard is untouched). `rebuild`'s row-count report includes `volume_rules`.
- [ ] AC-4: Every other CSV extract writes is byte-identical before and after the change on the current workbooks, and the PR quotes the diff summary (standing rule 4).

## Out of scope

- The volume map editor (3.9).
- The bulk-entry *always use 2004* switch (see TASK-005).
- Any schema change, or reading `volume_rules` anywhere in the app.
- Running `load` against production. That is the owner's Step 14.

## Files likely touched

- `etl/extract.py`: write `seed/volume_rules.csv`.
- `etl/test_extract.py`: the fixture map and its assertions.
- `etl/load.ps1`, `etl/load.sh`: copy it after `runs`.
- `etl/rebuild.ps1`, `etl/rebuild.sh`: the row count.

## Verification

- Automated: `npm run test:etl` covers the three fixture rows and the NULLs (AC-1, AC-2).
- Manual: `npm run rebuild` on the development database → expected: a `volume_rules` count equal to the approved rows with a year in `etl/data/volume_map.csv`. Diff the other seed CSVs before and after → expected: identical (AC-4).

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
