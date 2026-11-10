---
id: TASK-061
title: 1.26 Cut the books over from the Sheets
status: Ready
depends_on: [TASK-018, TASK-020, TASK-036, TASK-051, TASK-057, TASK-058, TASK-059, TASK-060, TASK-062, TASK-063, TASK-064, TASK-065, TASK-066, TASK-067, TASK-068, TASK-069, TASK-070, TASK-071, TASK-072]
size: S
model: sonnet
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
---

# TASK-061 — 1.26 Cut the books over from the Sheets

## Goal

The app becomes the record for books: production has had its last full load, it refuses every full reload, and `Books.xlsx` is archived read-only. `Comics.xlsx` stays the comics record.

## Context

- Roadmap: `docs/05-roadmap.md` § 1.26 Cut the books over from the Sheets (M9, last; D-95; amended 2026-11-08 by D-128: the books cutover; 2026-11-10 by D-139: the books work pulled ahead). The entry and its **Check:** are the contract. It is START-HERE Step 14 as an entry, so the switch has a box and a Check like any other work. Feature F-02.
- **The owner runs every command; Claude never runs one against `.env.live`** (CLAUDE.md). START-HERE Step 14 is the runbook: *Before the switch — every box ticked*, *The switch*, *The month after*, *Until Step 14b: comics from the sheet*. Every box in *Before the switch* is ticked first, including that adding a run and marking reads feel faster than the sheet.
- **Depends on** (the entry's paragraph, which `etl/test_cutover_parity.py` reads): 1.25 (TASK-036); 1.14c (TASK-057) and 1.17b (TASK-058, TASK-059); 1.29 (TASK-060); 2.11a (TASK-018) and 1.11 (TASK-020), done; and every open entry `docs/cutover-parity.md` names for `Books.xlsx`: 2.2b (TASK-051, done) and 2.3 (TASK-063, TASK-064, TASK-065), 3.4 (top books), 4.4 (the two-way Calibre sync, D-133), 5.1 (shelves, the Dark Tower reading order) and 5.7 (books coming out); 5.17 (what you own, D-132); and the entries the owner pulled ahead on 2026-11-10 (D-139): 2.2j (TASK-062), 2.2k, 2.7 (TASK-066, TASK-067), 2.8 (TASK-068), 2.10 (TASK-069, TASK-070), 2.10b (TASK-071, TASK-072), 3.4b, 4.2, 4.5, 4.5b, 5.5, 5.14 and 5.15. **2.2k, 3.4, 3.4b, 4.2, 4.4, 4.5, 4.5b, 5.1, 5.5, 5.7, 5.14, 5.15 and 5.17 have no task file yet**, so they are not in `depends_on`; add them when they are converted.
- **What the switch is (D-128).** The export and the extract still read both workbooks; the last full load of production happens here; `LEDGER_LIVE=true` goes on straight after, in `.env.live` and the repo variable, so `rebuild` and the full `load` refuse from then on. Only `Books.xlsx` is archived read-only, with the app's URL at the top. `Comics.xlsx` stays the record for comics: 1.29's comics-only load refreshes production's comics from it until 1.28. From here extract no longer loads books, so Calibre's changes arrive through 4.4's sync. The wishlist is settled before the final load, by extract (1.27, D-111).
- **Claude's part.** Before the owner starts: confirm every **Depends on** entry is ticked and the parity check passes on `main`. After the owner reports the switch: tick 1.26 in the roadmap on the day of the switch and record it in `docs/STATUS.md`. No code changes, so CLAUDE.md's *no task merges without a test that would have failed before it* is met by `etl/test_cutover_parity.py`, which fails while a gating entry is open, and by the Check, which the owner runs. The plan says whether anything more is needed.
- The month of running both (D-18) follows the tick, with its *Done when* in Step 14; it is not this entry's box.
- Decisions: D-95, D-128, D-129, D-18, D-111, D-133, D-132, D-139.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): the owner, after the switch: `npm run rebuild -- -EnvFile .env.live`
and `.\etl\load.ps1 seed-final -EnvFile .env.live` both refuse, naming
`LEDGER_LIVE`; `gh variable get LEDGER_LIVE` prints `true`; 1.29's comics-only
load still runs against production and leaves every books table's row count
as it was; `Books.xlsx` carries its archive name and opens read-only, with the
app's URL at the top; and the books read this year, on `/books/status` in
production, match the frozen sheet.
- [ ] AC-2: Before the owner starts, every entry named in 1.26's **Depends on** paragraph is ticked (☑) in `docs/05-roadmap.md`, and `py -m unittest etl.test_cutover_parity` passes on `main` (its real-file test included).
- [ ] AC-3: Every box under START-HERE Step 14 *Before the switch* is ticked, each confirmed by the owner, before the final load runs.
- [ ] AC-4: The commit that ticks 1.26 in `docs/05-roadmap.md` is dated the day of the switch, and `docs/STATUS.md` says the app is the record for books and `Comics.xlsx` is still the record for comics until 1.28.

## Out of scope

- 1.28, the comics cutover, and `LEDGER_COMICS_LIVE`.
- The month of running both (D-18).
- Running any command against `.env.live`, or suggesting a load or rebuild of production once `LEDGER_LIVE` is set.
- Any change to `load`, `rebuild` or the comics-only load.

## Files likely touched

- `docs/05-roadmap.md` — the 1.26 tick, on the day of the switch.
- `docs/06-tasklist.md` — the row's Done cell.
- `docs/STATUS.md` — the books cutover recorded.

## Verification

- Automated: `py -m unittest etl.test_cutover_parity` (AC-2) on `main` before the switch.
- Manual (owner, START-HERE Step 14): every *Before the switch* box ticked → the final extract and load → `LEDGER_LIVE=true` in `.env.live` and the repo variable → `Books.xlsx` archived. Then AC-1's checks → expected: both refuse naming `LEDGER_LIVE`, the variable prints `true`, the comics-only load leaves the books' row counts unchanged, and this year's books match the frozen sheet.

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
