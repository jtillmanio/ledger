---
id: TASK-036
title: 1.25 Sheets parity audit
status: Ready
depends_on: []
size: M
model: opus
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
---

# TASK-036 — 1.25 Sheets parity audit

## Goal

The owner knows exactly what still has to be built before the Sheets can be frozen. Every tab of both workbooks is accounted for, each use the owner relies on maps to something in the app or a deliberate *won't carry*, and cutover (1.26) waits only for that list.

## Context

- Roadmap: `docs/05-roadmap.md` § 1.25 Sheets parity audit (M9, first in sitting 9's order; it can run any time). The roadmap entry and its **Check:** are the contract. 1.26 (§ 1.26 Cut over from the Sheets) depends on it and on every open entry it names.
- Decisions: D-95 (cutover is an entry, gated on parity); D-18 (load first, then a month running both); D-20 (the prerequisite audit, a separate Step 14 gate); D-41 (no workbook read state for books); D-70 (`To-Read` tabs from 2028 load nothing); D-39 (the wishlist promotion).
- The workbooks are committed: `etl/data/Comics.xlsx` and `etl/data/Books.xlsx`, read by `etl/extract.py` through pandas. Their tabs on 2026-10-28 (re-list from a fresh export, never trust this): Comics `NOW`, `RUNS`, `Reading Orders`, `PREREQS`, `TRACKS`, `EVENTS`, `DASHBOARD`, `Sheet26`, `Run Order`, `To Read`, `DC`, `Ultimate Order`, `Master`, `Ultimate Collection`, `Reading Orders (old)`, `Sheet8`; Books `Coming Out`, `HP Fanfiction`, `Stephen King`, `Riordanverse`, `Dresden`, `Cosmere`, `To-Read Master List`, `Read 2021`–`Read 2025`, `To-Read 2026`–`To-Read 2030`, `To-Read`, `Top Books`, `Series`, `Booktube Top 10`, `Download`.
- Where the mapping starts (candidates, not answers; the audit decides):
  - `docs/HANDOFF.md` § *What each spreadsheet artifact became* maps the computed columns and tabs to views.
  - `docs/01-product.md` § *The owner's list* (B1–B19, C1–C4…) gives the status of each book and comic feature.
  - The gaps D-95 already names: catalog and prerequisite edits (3.1–3.3), the year and quarter word-count budget the `To-Read 20XX` tabs hold (2.0, 2.1, 2.2, 2.2b, 2.3), top books per year (3.4, B4).
- **The owner's part is the substance.** What the owner *does* in a tab (reads it daily, edits it, glances at it yearly, never opens it) can't be read from the file. The plan proposes how to ask: for example, a draft per tab from its headers, formulas and the artifacts table, which the owner corrects in one pass. Formulas export as `__xludf.DUMMYFUNCTION` (product brief), so a tab's purpose may need the owner's word or the live sheet.
- A use no roadmap entry covers gets a new entry, written and agreed with the owner first like any entry with no Check (`docs/05-roadmap.md` intro), with its row in `docs/06-tasklist.md`. An open entry that gates cutover stays in its own phase and milestone. Only 1.26's **Depends on** names it, and M9's *Order* says it is pulled ahead (D-95).
- Why `size: M` though the roadmap says S: the audit file, its automated check, and the roadmap and task-list edits are four files.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): every tab name a fresh export of `etl/data/Comics.xlsx` and
`etl/data/Books.xlsx` holds (`py -c "import pandas as pd; [print(n) for f in
('etl/data/Comics.xlsx', 'etl/data/Books.xlsx') for n in
pd.ExcelFile(f).sheet_names]"`) appears in `docs/cutover-parity.md`; every use
listed there ends in a roadmap ID or *won't carry* with a reason; the file
says the owner signed it off, and when; and 1.26's **Depends on** names every
open ID it lists.
- [ ] AC-2: `npm run test:etl` includes `etl/test_cutover_parity.py`, which reads both committed workbooks and `docs/cutover-parity.md` and fails, naming the item, when: a tab has no section; a use line ends in neither a roadmap ID nor *won't carry* plus a reason; a cited roadmap ID is not a heading in `docs/05-roadmap.md`; a cited ID that is open (☐) is missing from 1.26's **Depends on** line; or the sign-off line (owner, date) is absent. It fails on `main` today, where the file does not exist.
- [ ] AC-3: Given a copy of the parity file with one tab's section removed, or a use line with no ID, the test fails naming that tab or line (a fixture case in the test, not the real file).
- [ ] AC-4: Every roadmap ID the parity file cites as covering a use names an entry whose text or **Check:** does that use. For each open one, M9's *Order* in `docs/06-tasklist.md` says it is built before 1.26. No entry is renumbered, and no other entry's text or **Check:** changes (new entries excepted).
- [ ] AC-5: Each new roadmap entry the audit adds has a **Check:** the owner agreed, a size, and exactly one row in `docs/06-tasklist.md`. Every roadmap ID still sits in exactly one task-list row.

## Out of scope

- Building any entry the audit names: each gets its own task, in its own PR.
- Cutover itself (1.26): the final export, the load, `LEDGER_LIVE`, archiving the Sheets.
- The prerequisite audit (D-20, `docs/OWNER-CHECKLIST.md`): a separate Step 14 gate about cycles and hard edges, not about tab parity.
- Changing what `etl/extract.py` reads from a tab. A tab that should load and doesn't becomes an entry, not a fix here.
- Recounting the task list's stale *Coverage* and *Scope* counts, beyond the rows this task adds.
- Editing the workbooks.

## Files likely touched

- `docs/cutover-parity.md`: new; the audit: one section per tab (or one per family of same-shaped tabs, naming each), uses, mappings, the sign-off.
- `etl/test_cutover_parity.py`: new; the automated form of the Check, run by `npm run test:etl` (pattern: the other `etl/test_*.py`, `unittest`, pandas already a dependency).
- `docs/05-roadmap.md`: 1.26's **Depends on**; any new entries the owner agrees to.
- `docs/06-tasklist.md`: M9's *Order* (entries pulled ahead of 1.26); rows for new entries; this task's ID in 1.25's row.

## Verification

- Automated: `npm run test:etl` runs `etl/test_cutover_parity.py`; it passes on the branch and fails on `main` (no parity file), and its fixture cases fail as AC-3 says.
- Manual: run the Check's `py -c` one-liner → every name it prints is a section in `docs/cutover-parity.md`.
- Manual: the owner reads `docs/cutover-parity.md` end to end → each tab says what they actually do there, and they add the sign-off line.

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
