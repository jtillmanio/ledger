---
id: TASK-018
title: 2.11a Prerequisite cycle check
status: Done
depends_on: [TASK-017]
size: S
model: sonnet
autonomy: attended
ui: false
plan_status: approved
planned_at_commit: 6716e6b
---

# TASK-018 — 2.11a Prerequisite cycle check

## Goal

Extract names every loop in the prerequisite graph so the owner can untangle them in the workbook. The final cutover load refuses to run while any loop is left.

## Context

- Roadmap: `docs/05-roadmap.md` § 2.11a Prerequisite cycle check. It is numbered in Phase 2 but **built in Phase 1's last sitting, before cutover (D-20)**, because the owner needs its output for the audit in `Comics.xlsx` before the sheet is frozen at Step 14. The roadmap entry and its **Check:** are the contract.
- Split from the old 2.11 (R3-15). This task is the loader check. The judgement calls about the 230 hard edges are the owner's, in `docs/OWNER-CHECKLIST.md`, and no task waits on them.
- Architecture: `docs/03-data-model.md` § 2. Decisions (the prereq graph). `etl/views.sql` `run_ancestors()` (depth cap 48, D-6; a run is never its own ancestor, R2-04).
- Data model: `etl/extract.py` writes `prereqs.csv` and `unresolved.csv`. Rows go `prereqs,prereq cycle`, one per component.
- Behaviour: a Tarjan pass over all extracted edges, hard and soft. Every strongly connected component larger than one is reported with its runs named, hard edges first. By default extract reports and carries on (a console count, the rows in `unresolved.csv`), so `npm run rebuild` keeps working through the weeks-long audit. `--fail-on-cycle` exits non-zero instead. START-HERE Step 14's final extract uses it.
- Decisions: D-2, D-6, D-7, D-20, R0-01, R2-04, R3-15. Standing rule 4: `unresolved.csv` gains rows but the other CSVs' formats don't change. Re-run against both workbooks and diff.
- `depends_on` TASK-017 records the sitting's build order, not a data dependency.

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim; the unittest half in this PR, the real-workbook half on the owner's 2026-10-25 extract, see Review log): `py -m unittest` covers a fixture whose PREREQS contain a cycle and asserts that extract writes the `prereq cycle` rows and exits 0 by default, and exits non-zero naming the runs with `--fail-on-cycle`. Against the real workbook, once the owner has finished the checklist, `npm run extract -- --fail-on-cycle` passes: a Tarjan pass over `prereqs.csv` finds no component larger than one, and no run appears in its own `run_ancestors()` (the view already excludes it, R2-04, so a cycle can no longer hide behind that). Record the resulting ready / blocked counts in HANDOFF so the dashboards' prose matches the data.
- [x] AC-2: The fixture has two separate components (one of three runs mixing hard and soft edges, one of two runs with soft edges only) plus an acyclic chain. Extract writes exactly two `prereq cycle` rows, each naming every run in its component with the hard edges listed first, and nothing for the chain. A self-loop (a run listed as its own prereq) is reported as a component.
- [x] AC-3: `npm run extract` accepts `--fail-on-cycle` and passes it through. `docs/START-HERE.md` Step 14's final extract command includes it. The `CLAUDE.md` command list mentions the flag.
- [x] AC-4: Running extract on the current workbooks with and without the change produces identical CSVs apart from the new `unresolved.csv` rows, and the PR quotes the diff summary (standing rule 4).

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

## Follow-ups

- `docs/OWNER-CHECKLIST.md`'s two cycle items (*Break the soft and mixed cycles*, *Soft and mixed prerequisite cycles*) said 2.11a "will list them by name once it lands": now they point at the `prereq cycle` rows in `seed/unresolved.csv` and at recording the ready / blocked counts in HANDOFF once `npm run extract -- --fail-on-cycle` passes (AC-1's second half). They also note, with the owner's approval at close-out, that the tracked 2026-09-29 `Comics.xlsx` already reports 0 cycles (10 of the worksheet's 13 edges reversed or deleted), to be confirmed on a fresh download. Both boxes are left for the owner → docs/OWNER-CHECKLIST.md § Prerequisite audit (data work in `Comics.xlsx`, PREREQS tab) and § Workbook, before cutover
- `etl/rebuild.sh`'s extract line lacks the `--book-review etl/data/book_review.csv` that `package.json`'s `extract` has carried since 1.13, so the bash twin's rebuild skips the book merge review → not tracked: fixed separately in PR #125 (`fix/rebuild-sh-book-review`), at the owner's request

## Plan

Approved 2026-10-25 (attended, Opus 5.5 session; implementation on `model: sonnet`).

### Steps

1. **Tests first.** `etl/test_extract.py`: `build_workbook` takes an optional `prereqs` list (rows of `Run ID`, `Prereq Run ID`, `Type`). New `PrereqCycles(WorkbookCase)`:
   - two components (x, y, z mixing hard and soft edges; p, q soft only) plus an acyclic chain c1 → c2 → c3: exactly two `prereq cycle` rows, each naming every run in its component, hard edges before soft, and nothing naming the chain (AC-2);
   - a self-loop s → s is reported as a component of its own (AC-2);
   - `ex.main([...])` against that fixture and a minimal Books.xlsx (`build_books([])`): returns 0 by default with the rows in `unresolved.csv`; returns non-zero with `--fail-on-cycle`, its stderr naming x, y, z, p and q; returns 0 with `--fail-on-cycle` on an acyclic graph (AC-1).
   Run them and confirm they fail for the expected reason (no rows, unknown argument).
2. **`etl/extract.py`, the pass.** `prereq_cycles(prereqs) -> list[list[dict]]`: an iterative Tarjan over every extracted edge, hard and soft (no recursion limit), visiting nodes and neighbours in sorted order so the output is deterministic. Returns each strongly connected component larger than one, plus each self-loop, as its edges. Called in `extract_comics` after the prereq rows are built; one `flag("prereqs", "prereq cycle", detail)` per component, components ordered by their first run. Detail: `3 runs: x, y, z | hard: x -> y, z -> x | soft: y -> z` (runs sorted; hard edges first; sheet order within a type; a type with no edges is left out).
3. **`main()`, the flag.** `--fail-on-cycle` (help: exit non-zero when the prereq graph has a cycle; Step 14's final extract). After the unresolved line, a cycle count (`N prereq cycles — see …/unresolved.csv`), red (ANSI) only when stdout is a TTY. Every CSV is still written either way. Without the flag: return 0. With it and a cycle: print each component's runs to stderr and return 1.
4. **Docs (AC-3).** `CLAUDE.md` § Commands and `docs/COMMANDS.md` (kept in sync, CLAUDE.md § Commands) mention `--fail-on-cycle`. `docs/START-HERE.md` Step 14 already runs `npm run extract -- --out seed-final --fail-on-cycle` (line 1393): no edit. `package.json` unchanged: npm passes arguments after `--` through.
5. **AC-4 diff.** Run `main`'s `etl/extract.py` (`git show main:etl/extract.py` into the scratchpad) and the branch's against the real workbooks with `npm run extract`'s arguments, each to its own scratch `--out`, `--book-review` pointing at a scratch copy so the tracked `etl/data/book_review.csv` isn't rewritten. Diff every CSV; only `unresolved.csv` may differ, and only by `prereq cycle` rows. Quote the summary in the PR.

### Files

- `etl/extract.py`: `prereq_cycles()`, the rows, `--fail-on-cycle`.
- `etl/test_extract.py`: the `prereqs` fixture argument and `PrereqCycles`.
- `CLAUDE.md`: the command list mentions the flag (AC-3).
- `docs/COMMANDS.md`: the same, kept in sync (not in "Files likely touched").
- `docs/OWNER-CHECKLIST.md`: follow-up 1, at close-out (not in "Files likely touched").
- `docs/HANDOFF.md`: not touched; the counts wait on the owner's checklist (Out of scope).

### Test strategy

| AC | Proof |
| --- | --- |
| AC-1 | `etl/test_extract.py` `PrereqCycles`: the three `main()` cases (exit 0 default, non-zero naming runs with the flag, 0 with the flag when acyclic). Real-workbook half: owner, after the checklist, recorded in the Review log |
| AC-2 | `PrereqCycles`: the two-components-and-chain case and the self-loop case |
| AC-3 | The `--fail-on-cycle` cases (argparse accepts it); grep of `CLAUDE.md`, `docs/COMMANDS.md`, `docs/START-HERE.md` Step 14 |
| AC-4 | Manual: step 5's diff, quoted in the PR |

### Risks

- The ~74-run component is one long `detail` cell: correct, and the console count stays short.
- With `--fail-on-cycle`, `seed/` is still written; Step 14 loads only after a passing extract, so a failed run loads nothing.

### Size

S: four code/doc files plus the checklist placement; no schema, no UI.

## Review log

- Verify R1 PASS (tsc, lint, vitest 828, views, ETL 158, e2e 548, build) | Audit R1 PASS (5 of 6 discriminating; the acyclic guard passes on main by design) | Spec R1 APPROVE | Schema R1 APPROVE (Tarjan fuzzed against brute force, 3,000 graphs)
- AC-4, 2026-10-25: main's and the branch's extract on the tracked workbooks (Comics.xlsx 2026-09-29, every `npm run extract` sidecar) wrote 26 byte-identical CSVs and an identical `book_review.csv`. The graph has no cycle (249 runs, 436 edges: 219 hard, 217 soft; a Kahn sort agrees), so `unresolved.csv` gains no rows and `--fail-on-cycle` exits 0.
- AC-1 second half (owner, open): on a fresh download, `npm run extract -- --fail-on-cycle` passes, no run is its own `run_ancestors()`, and the ready / blocked counts go in HANDOFF. Roadmap 2.11a stays open until then (owner, 2026-10-25).
- AC-1 second half PASS, 2026-10-25: the owner's fresh-download `npm run extract -- --fail-on-cycle` exited 0 with `0 prereq cycles`. That `seed/` was loaded into the TEST database: 258 runs, 436 edges (219 hard), and no run in its own `run_ancestors()`, even on a walk without R2-04's filter. `run_readiness` gave 173 blocked, 45 ready_hard and 40 ready_all; `run_state` gave 173 / 42 / 40 / 2 reading / 1 read. Recorded in `docs/HANDOFF.md` § Migrated data. Accepted by the owner; roadmap 2.11a ticked at their request.

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 1
- Review rounds: 1
- First-pass AC FAILs: 0
- Plan revisions after approval: 0
