---
id: TASK-018
title: 2.11a Prerequisite cycle check
status: Draft
depends_on: [TASK-017]
size: S
model: sonnet
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
---

# TASK-018 — 2.11a Prerequisite cycle check

## Goal

Extract names every loop in the prerequisite graph so the owner can untangle them in the workbook. The final cutover load refuses to run while any loop is left.

## Context

- Roadmap: `docs/TASKS.md` § 2.11a Prerequisite cycle check. It is numbered in Phase 2 but **built in Phase 1's last sitting, before cutover (D-20)**, because the owner needs its output for the audit in `Comics.xlsx` before the sheet is frozen at Step 14. The roadmap entry and its **Check:** are the contract.
- Split from the old 2.11 (R3-15). This task is the loader check. The judgement calls about the 230 hard edges are the owner's, in `docs/OWNER-CHECKLIST.md`, and no task waits on them.
- Architecture: `docs/ARCHITECTURE.md` § 2. Decisions (the prereq graph). `etl/views.sql` `run_ancestors()` (depth cap 48, D-6; a run is never its own ancestor, R2-04).
- Data model: `etl/extract.py` writes `prereqs.csv` and `unresolved.csv`. Rows go `prereqs,prereq cycle`, one per component.
- Behaviour: a Tarjan pass over all extracted edges, hard and soft. Every strongly connected component larger than one is reported with its runs named, hard edges first. By default extract reports and carries on (a console count, the rows in `unresolved.csv`), so `npm run rebuild` keeps working through the weeks-long audit. `--fail-on-cycle` exits non-zero instead. START-HERE Step 14's final extract uses it.
- Decisions: D-2, D-6, D-7, D-20, R0-01, R2-04, R3-15. Standing rule 4: `unresolved.csv` gains rows but the other CSVs' formats don't change. Re-run against both workbooks and diff.
- `depends_on` TASK-017 records the sitting's build order, not a data dependency.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): `py -m unittest` covers a fixture whose PREREQS contain a cycle and asserts that extract writes the `prereq cycle` rows and exits 0 by default, and exits non-zero naming the runs with `--fail-on-cycle`. Against the real workbook, once the owner has finished the checklist, `npm run extract -- --fail-on-cycle` passes: a Tarjan pass over `prereqs.csv` finds no component larger than one, and no run appears in its own `run_ancestors()` (the view already excludes it, R2-04, so a cycle can no longer hide behind that). Record the resulting ready / blocked counts in HANDOFF so the dashboards' prose matches the data.
- [ ] AC-2: The fixture has two separate components (one of three runs mixing hard and soft edges, one of two runs with soft edges only) plus an acyclic chain. Extract writes exactly two `prereq cycle` rows, each naming every run in its component with the hard edges listed first, and nothing for the chain. A self-loop (a run listed as its own prereq) is reported as a component.
- [ ] AC-3: `npm run extract` accepts `--fail-on-cycle` and passes it through. `docs/START-HERE.md` Step 14's final extract command includes it. The `CLAUDE.md` command list mentions the flag.
- [ ] AC-4: Running extract on the current workbooks with and without the change produces identical CSVs apart from the new `unresolved.csv` rows, and the PR quotes the diff summary (standing rule 4).

## Out of scope

- Deciding which edges to change or soften. That is the owner's checklist (`docs/OWNER-CHECKLIST.md`).
- The in-app invariant after cutover (3.3's prereq editor).
- Changing `run_ancestors()` or the readiness views.
- The second half of AC-1 (the real workbook passing): it is run by the owner after the checklist, and recorded in this task's Review log when it happens.

## Files likely touched

- `etl/extract.py`: the Tarjan pass, the rows, the flag.
- `etl/test_extract.py`: the fixture and its cases.
- `package.json`: nothing, or pass-through if `npm run extract` needs it.
- `docs/START-HERE.md` (Step 14), `docs/HANDOFF.md` (the counts, once known), `CLAUDE.md` (the command list).

## Verification

- Automated: `npm run test:etl` covers the two components, the self-loop, the chain, exit 0 by default and non-zero with `--fail-on-cycle` naming the runs (AC-1, AC-2).
- Manual: `npm run extract` on the current workbooks → expected: a console count of cycles and the matching `prereq cycle` rows in `seed/unresolved.csv`, with the other CSVs unchanged (AC-4). After the owner's checklist, `npm run extract -- --fail-on-cycle` → expected: exit 0, then record the ready and blocked counts in HANDOFF.

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
