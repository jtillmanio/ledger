---
id: TASK-115
title: 1.31 Settle the Owner checklist before the books cutover
status: Draft
depends_on: []
size: S
model: opus
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
---

# TASK-115 — 1.31 Settle the Owner checklist before the books cutover

## Goal

Before the last full load of the books, every open owner decision, action and approval queued by follow-ups is either done and recorded or deferred past the switch with a reason, so nothing the cutover's data depends on is left undecided.

## Context

- Roadmap: `docs/05-roadmap.md` § 1.31 (its **Check** is AC-1, verbatim; the Check is still *proposed*: the owner agrees it by merging or edits it first). Listed in `docs/06-tasklist.md` M9, just before 1.26.
- Owner, 2026-11-14, at 4.2's close-out (TASK-084, PR #255). **The owner decides and runs every command.** Claude's part is to walk the items with the owner, record each outcome in `docs/OWNER-CHECKLIST.md`, and turn every answer that needs code into its own roadmap entry or a note on the task that will do it (`workflow.followUps`, `.claude/skills/track-follow-ups/classify.md`).
- The three sections and their open boxes on `main` at 2026-11-18 (count again when the task starts; these are not a contract): *Decisions waiting on you* (3), *Actions from follow-ups* (15), *Approvals from follow-ups* (8). The other sections of the file (*Before Step 14*, the 2026-09 passes) are not this entry's.
- 4.2's question is the item *Hardcover's matching misses real books (from TASK-084, 4.2, PR #255)* under *Decisions waiting on you*; the matching rule is `src/lib/book-match.ts` (the port of `enrich_books.decide`), shared by `etl/enrich_books.py` and `backfillBooks` (`.claude/rules/schema.md`, the backfill bullet).
- `etl/data/book_details.csv` on `main` holds 2,000 rows with `source` `openlibrary` (2026-11-18). Only the owner's full `npm run enrich:books` run (1.14b, 1.14c, D-94, D-130) replaces them, then `npm run extract`. Hardcover's key is `HARDCOVER_API_TOKEN` (`docs/SERVICES.md`).
- Decisions: D-94 (Open Library gone; Hardcover is the source), D-95 (cutover gated on parity), D-128 (books cut over first), D-130 (page counts from Hardcover), D-139 (the books work pulled ahead of 1.26).
- **1.26 waits on this task** (owner, 2026-11-18): 1.26's roadmap **Depends on** ends with 1.31, its tasklist row names it, and TASK-061 lists TASK-115 in `depends_on`.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): (proposed; the owner agrees it by merging or edits it first) before 1.26's final load, every unticked box under *Decisions waiting on you*, *Actions from follow-ups* and *Approvals from follow-ups* in `docs/OWNER-CHECKLIST.md` is either ticked with where it went, or ends *after the switch:* with a reason; 4.2's Hardcover matching question is answered there; and `etl/data/book_details.csv` on `main` holds no `openlibrary` row (the full `enrich:books` run has replaced them).
- [ ] AC-2: A check that runs in `npm run test:no-e2e` (a vitest file or an `etl/test_*.py`, chosen at the plan gate) reads `docs/OWNER-CHECKLIST.md` and fails, naming the item, when any `- [ ]` line in those three sections neither is ticked nor contains *after the switch:* followed by text; and fails, printing the count, when `etl/data/book_details.csv` has any row whose `source` is `openlibrary`. Run against `main` as it is on 2026-11-18 it fails on both; on this branch at merge it passes.
- [ ] AC-3: Every ticked item says where it went: a roadmap ID, a `TASK-###`, a decision `D-n`, a PR number, or *done* with the date the owner ran it. Every answer that needs code is a new `docs/05-roadmap.md` entry with its own **Check:** (agreed by the owner) or a note in the Context of the task that will do it, and the checklist line names it.
- [ ] AC-4: After the owner's `npm run enrich:books` and `npm run extract`, the PR body records the run's counts (matched, proposals, no match) and the extract's `unresolved.csv` count against the last extract's, and states whether any held book (`book_hold.csv`) changed.

## Out of scope

- Running `enrich:books`, `extract`, `load` or anything else on the owner's behalf: the owner runs every command (the entry says so).
- Building any code an answer asks for: each becomes its own entry or a note on its task (AC-3).
- The checklist's other sections (*Before Step 14*, *After Step 14's final load*, the 2026-09 passes) and 1.26's own steps (TASK-061).
- Changing the Hardcover matching rule here, even if 4.2's answer is "change it": that is a new entry.

## Files likely touched

- `docs/OWNER-CHECKLIST.md`: each item ticked with where it went, or *after the switch:* with a reason
- `etl/data/book_details.csv`: rewritten by the owner's `npm run enrich:books` run
- `etl/data/book_review.csv`, `etl/data/hardcover_review.csv`, `etl/data/book_hold.csv`: as the run and the owner's decisions leave them
- `test/owner-checklist.test.ts` or `etl/test_owner_checklist.py`: AC-2's check
- `docs/05-roadmap.md`, other `docs/tasks/TASK-*.md`: new entries and notes for answers that need code (AC-3)

## Verification

- Automated: AC-2's check, run on `main`'s files (fails on both counts) and on the branch (passes); `npm run test:no-e2e` green.
- Manual (owner): walk each open item; run `npm run enrich:books -- --dry-run`, then the full run, then `npm run extract` → expected: `book_details.csv` has no `openlibrary` row, and `git diff --stat etl/data/` shows only the sidecars the run writes.

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
