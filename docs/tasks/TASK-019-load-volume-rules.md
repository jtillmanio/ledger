---
id: TASK-019
title: 1.12 Load the volume map into volume_rules
status: Ready
depends_on: [TASK-018]
size: L
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-019 — 1.12 Load the volume map into volume_rules

## Goal

The approved volume rules (which year a bare series name means) are in the database before cutover. When pasting issues, choosing *Always use 2004 for Captain America* adds a rule, so the same ambiguity isn't asked about again.

## Context

- Roadmap: `docs/TASKS.md` § 1.12 Load the volume map into `volume_rules` (sitting 7; it must land before Step 14's final load, the last time `load` runs). It is the load half of 3.9. The roadmap entry and its **Check:** are the contract.
- **Why this is one large task** (`workflow.splitPolicy: never-split`): the owner moved the bulk-entry review's volume switch here on 2026-10-09 (it was open question 2 on TASK-005). The roadmap entry was amended to match. That adds the switch in TASK-005's review table, its staged write in TASK-005's insert, and the parser's caller reading the rules, on top of the ETL load.
- Data model: `src/db/schema.ts` `volumeRules` (`series`, `run_id` NULL = any run, `issue_from` / `issue_to` NULL = any issue, `year`). It was created by 0.3 and is empty today. `etl/extract.py` `load_volume_map` reads `etl/data/volume_map.csv` and applies the approved rules to labels, but never writes them to `seed/`.
- The load: extract writes `seed/volume_rules.csv` from the same approved rows (series text verbatim, `run_id` NULL for an any-run rule, `issue_from` / `issue_to` NULL for any issue, `year`). A row flagged `approved with no year` is not written. `etl/load.ps1` and `etl/load.sh` copy it after `runs` (its `run_id` is a foreign key), and `npm run rebuild`'s row counts list it (`etl/rebuild.ps1`, `etl/rebuild.sh`).
- The switch: mockup `bulk` draws *Always use 2004 for Captain America* on a row flagged *ambiguous volume* by TASK-004's parser. It stages an any-run, any-issue rule. Nothing is written until TASK-005's confirm, which writes the rule in the same transaction as the insert. TASK-005's caller passes the table's rules to the parser, so a series with a rule resolves to its year and isn't flagged. Changing or removing a rule stays 3.9's.
- No schema change. Labels are already normalised by extract.
- Decisions: D-16, D-18 (load first, then run in parallel; no load after Step 14). Standing rule 4: a new seed file, other outputs unchanged. Re-run against both workbooks and diff. psql `\copy` paths need forward slashes on Windows (CLAUDE.md).
- `depends_on` TASK-018 records the sitting's build order. The switch also needs TASK-004 and TASK-005, which come earlier in the chain.
- *From TASK-005 (1.3c, PR #74):* The *Always use 2004* switch goes on the ambiguous-volume row: `ReviewTable` draws a row's decision groups in order, so the switch follows the *Volume year* group (`src/lib/bulk-review.ts`, `decide`, the `ambiguous_volume` branch). The insert is `insertIssuesIntoRun(runId, after, labels, { within })` in `src/db/writes.ts`: write the staged volume rule inside `within` and it stands or falls with the insert (`test/bulk-insert.test.ts`, *a throw inside `within` … rolls the whole insert back*).

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): `npm run test:etl` covers a fixture map holding a run-scoped rule, an any-run rule and an approved row with no year, and asserts that `seed/volume_rules.csv` holds exactly the first two, with `run_id` NULL on the second. `npm run rebuild` (development) reports a `volume_rules` count equal to the approved rows in `volume_map.csv`.
- [ ] AC-2: The CSV's header matches `volume_rules`' column order. An issue-range rule keeps its `issue_from` and `issue_to`, and an any-issue rule writes them as NULL (empty in the CSV, loaded as NULL). `etl/load.ps1` and `etl/load.sh` both copy it after `runs` and still refuse when `LEDGER_LIVE=true` (the existing guard is untouched). `rebuild`'s row-count report includes `volume_rules`.
- [ ] AC-3: Given known volumes in which `Captain America` has several years and no rule, the line `Captain America #1` is flagged *ambiguous volume* and its row offers *Always use <year> for Captain America* once a year is picked. Switching it on and confirming writes exactly one `volume_rules` row (`series = 'Captain America'`, `run_id` NULL, `issue_from` and `issue_to` NULL, the picked year) in the same transaction as the insert. Cancelling, or switching it off before confirm, writes no rule.
- [ ] AC-4: With that rule in the table, pasting `Captain America #2` into any run is not flagged *ambiguous* and resolves to `Captain America (<year>) #2`. A forced failure in the insert's transaction leaves `volume_rules` unchanged.
- [ ] AC-5: The switch meets the UX floor (`docs/TASKS.md` § *The UX floor, for every UI task*): it is a real switch (`role="switch"` or a checkbox) named *Always use <year> for <series>*, at least 24px, keyboard operable, readable in both themes; screenshots of an ambiguous row with the switch at every `ui.viewports` width, light and dark.
- [ ] AC-6: Every other CSV extract writes is byte-identical before and after the change on the current workbooks, and the PR quotes the diff summary (standing rule 4).

## Out of scope

- The volume map editor: changing or removing a rule, and run- or issue-scoped rules from the app (3.9).
- Any schema change.
- Running `load` against production. That is the owner's Step 14.
- Writing rules back to `etl/data/volume_map.csv`. After cutover the table is the record, and nothing writes back to the workbook or its sidecars from the app.

## Files likely touched

- `etl/extract.py`: write `seed/volume_rules.csv`.
- `etl/test_extract.py`: the fixture map and its assertions.
- `etl/load.ps1`, `etl/load.sh`: copy it after `runs`.
- `etl/rebuild.ps1`, `etl/rebuild.sh`: the row count.
- `src/components/ReviewTable.tsx`: the switch on an ambiguous row.
- `src/db/queries.ts`: the rules, passed to the parser with the known volumes.
- `src/db/writes.ts`, `src/app/api/runs/[runId]/issues/route.ts`: write a staged rule inside TASK-005's insert transaction.
- `test/bulk-insert.test.ts`, `test/review-table.test.tsx`: the switch cases.

## Verification

- Automated: `npm run test:etl` covers the three fixture rows and the NULLs (AC-1, AC-2). `test/bulk-insert.test.ts` against `TEST_DATABASE_URL` covers the rule written with the insert, no rule on cancel, the rollback, and the next paste resolving (AC-3, AC-4). `test/review-table.test.tsx` covers the switch's name and keyboard use (AC-5).
- Manual: `npm run rebuild` on the development database → expected: a `volume_rules` count equal to the approved rows with a year in `etl/data/volume_map.csv`, and the other seed CSVs identical to before (AC-6). On a run's *Add issues → Type it*, paste `Captain America #1`, pick a year, switch *Always use* on and confirm → expected: pasting `Captain America #2` is no longer flagged.

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
