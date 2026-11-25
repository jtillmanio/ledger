---
id: TASK-061
title: 1.26 Cut the books over from the Sheets
status: Ready
depends_on: [TASK-018, TASK-020, TASK-036, TASK-051, TASK-057, TASK-058, TASK-059, TASK-060, TASK-062, TASK-063, TASK-064, TASK-065, TASK-066, TASK-067, TASK-068, TASK-069, TASK-070, TASK-071, TASK-072, TASK-074, TASK-075, TASK-076, TASK-077, TASK-081, TASK-082, TASK-083, TASK-084, TASK-088, TASK-089, TASK-090, TASK-091, TASK-092, TASK-093, TASK-094, TASK-095, TASK-096, TASK-097, TASK-098, TASK-099, TASK-100, TASK-106, TASK-107, TASK-108, TASK-109, TASK-110, TASK-111, TASK-114, TASK-115, TASK-116, TASK-126, TASK-127, TASK-128, TASK-129, TASK-130, TASK-131, TASK-132, TASK-133, TASK-134, TASK-135, TASK-136, TASK-137]
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

- Roadmap: `docs/05-roadmap.md` § 1.26 Cut the books over from the Sheets (M9, last; D-95; amended 2026-11-08 by D-128: the books cutover; 2026-11-10 by D-139: the books work pulled ahead; 2026-11-23 by D-172: nine more entries). The entry and its **Check:** are the contract. It is START-HERE Step 14 as an entry, so the switch has a box and a Check like any other work. Feature F-02.
- **The owner runs every command; Claude never runs one against `.env.live`** (CLAUDE.md). START-HERE Step 14 is the runbook: *Before the switch — every box ticked*, *The switch*, *The month after*, *Until Step 14b: comics from the sheet*. Every box in *Before the switch* is ticked first, including that adding a run and marking reads feel faster than the sheet.
- **Depends on** (the entry's paragraph, which `etl/test_cutover_parity.py` reads): 1.25 (TASK-036); 1.14c (TASK-057) and 1.17b (TASK-058, TASK-059); 1.29 (TASK-060); 2.11a (TASK-018) and 1.11 (TASK-020), done; and every open entry `docs/cutover-parity.md` names for `Books.xlsx`: 2.2b (TASK-051, done) and 2.3 (TASK-063, TASK-064, TASK-065), 3.4 (top books, TASK-074, done), 4.4 (the two-way Calibre sync, D-133; TASK-081, TASK-082, TASK-083), 5.1 (shelves, the Dark Tower reading order; TASK-095, TASK-096, TASK-097, done) and 5.7 (books coming out; TASK-099, TASK-100, done); 5.17 (what you own, D-132; TASK-092, TASK-093, TASK-094); and the entries the owner pulled ahead on 2026-11-10 (D-139): 2.2j (TASK-062), 2.2k (TASK-116), 2.7 (TASK-066, TASK-067), 2.8 (TASK-068), 2.10 (TASK-069, TASK-070), 2.10b (TASK-071, TASK-072), 3.4b (TASK-075, TASK-076, TASK-077, done; TASK-091), 4.2 (TASK-084, done), 4.5 (TASK-088, TASK-089, done), 4.5b (TASK-090, done), 5.5 (TASK-098, done), 5.14 (TASK-106, done; TASK-107) and 5.15 (TASK-108, TASK-109, TASK-110, TASK-127, TASK-111); and 1.31 (TASK-115), the Owner checklist settled (owner, 2026-11-14; confirmed as a gate 2026-11-18). And the entries the owner pulled ahead on 2026-11-23 (D-172): 0.13 (TASK-133) with 0.14c (TASK-114), 0.15 (TASK-134, TASK-135, TASK-136), 4.4b (TASK-128), 4.6 (TASK-129), 5.18 (TASK-130), 6.19 (TASK-131, TASK-132), and 6.21 (TASK-137) with 6.23 (TASK-126). Every entry named here now has its task files, all in `depends_on`.
- **What the switch is (D-128).** The export and the extract still read both workbooks; the last full load of production happens here; `LEDGER_LIVE=true` goes on straight after, in `.env.live` and the repo variable, so `rebuild` and the full `load` refuse from then on. Only `Books.xlsx` is archived read-only, with the app's URL at the top. `Comics.xlsx` stays the record for comics: 1.29's comics-only load refreshes production's comics from it until 1.28. From here extract no longer loads books, so Calibre's changes arrive through 4.4's sync. The wishlist is settled before the final load, by extract (1.27, D-111).
- **Claude's part.** Before the owner starts: confirm every **Depends on** entry is ticked and the parity check passes on `main`. After the owner reports the switch: tick 1.26 in the roadmap on the day of the switch and record it in `docs/STATUS.md`. No code changes, so CLAUDE.md's *no task merges without a test that would have failed before it* is met by `etl/test_cutover_parity.py`, which fails while a gating entry is open, and by the Check, which the owner runs. The plan says whether anything more is needed.
- The month of running both (D-18) follows the tick, with its *Done when* in Step 14; it is not this entry's box.
- **Rehearsed on development first, then rebuilt in the app** (owner, 2026-11-25; D-186). The final load starts the plan, shelves, owned copies, the listen queue, Parked and DNF statuses, the inbox and the Calibre near-spelling decisions empty. START-HERE Step 14 now has *In the app, after the load*: the steps to put them back in the app, and the minimum test of the books screens. *Before the switch* gains a box: the owner runs *The switch* and that list against development first. AC-3 covers the box; this task's acceptance criteria are unchanged.
- Decisions: D-95, D-128, D-129, D-18, D-111, D-133, D-132, D-139, D-172, D-186.
- *From TASK-084 (4.2, PR #255):* the owner added 1.31 (*Settle the Owner checklist before the books cutover*, 2026-11-14) to 1.26's **Depends on** paragraph: every open Owner checklist item is settled, or marked for after the switch, before the final load. AC-2's check of the paragraph covers it.
- *From TASK-082 (4.4, PR #267):* `npm run calibre:sync` writes no `#read` or `#read_date` into Calibre until `CALIBRE_SYNC_READS=true` is set in the env file the sync uses. The owner sets it at the switch, once extract no longer loads Calibre's reads (D-87, D-133); `docs/OWNER-CHECKLIST.md` § Actions from follow-ups has the item.
- *From TASK-083 (4.4, PR #270):* before `CALIBRE_SYNC_READS` is turned on, the write-back loses a finish's precision. A date-read column that displays a year alone reads back as July 1st `approximate`, and the sync compares days (`src/db/calibre-sync.ts`, `out("#date_read", …)`), so an exact Ledger finish differs and is rewritten every run. Compare by the column's display precision there, or say so on the *Calibre* page.

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
