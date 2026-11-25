---
id: TASK-160
title: 5.7b Coming out lets a book go (2 of 2) — Calibre having it makes it Unlisted
status: Ready
depends_on: []
size: S
model: opus
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
---

# TASK-160 — 5.7b Coming out lets a book go (2 of 2) — Calibre having it makes it Unlisted

## Goal

When the Calibre sync finds a book the owner was waiting for, the book becomes Unlisted and leaves Coming out.

## Context

- Roadmap: `docs/05-roadmap.md` § 5.7b (M17). Feature F-37. Its **Check:** is AC-1, verbatim; proposed in PR #342 and agreed when it merged (2026-11-25).
- **Split, 2 of 2.** TASK-159 is *Remove*.
- **D-185.** When `syncCalibre` (`src/db/calibre-sync.ts`) matches a Calibre book to a Ledger book with no `book_status` row, it writes `unlisted`, as it does for a book it creates (D-83), and lists the status change in the run's *in* (`{ field: "status", from: null, to: "unlisted" }`, the created books' shape). A matched book with any status keeps it. Calibre marking it read still follows today's rule for reads.
- **The rules file changes in this PR:** `.claude/rules/schema.md`'s list of what writes `unlisted` ("Only an undo writes `unlisted` (and the Calibre import, 1.18, and a paste …)") gains the sync's match.
- Decisions: D-83, D-133, D-185.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves the sync's clauses, TASK-159 *Remove*):
with the test database: *Remove* on a Coming out row sets the book's
`deleted_at`, the row leaves the list and the dashboard line's counts drop
by one, and Undo brings both back. A sync whose payload matches a wanted
book writes its `book_status` as `unlisted`, lists it under *in*, and the
book is gone from Coming out and listed under the Library's *Unlisted*; a
matched book already To read keeps its status. At 360px *Remove* resolves
to no `--danger` colour, and axe passes.
- [ ] AC-2: Given a matched book with no status row that Calibre marks read, the result is what today's sync does with a read on a matched book (no `unlisted` row is written over it).
- [ ] AC-3: Given the same sync run twice, the second writes nothing for that book and lists nothing under *in*.
- [ ] AC-4: `.claude/rules/schema.md` names the sync's match among what writes `unlisted`.

## Out of scope

- Moving the book to Someday (D-185 chose Unlisted).
- Any other status written by the sync.

## Files likely touched

- `src/db/calibre-sync.ts` — the `unlisted` write for a matched book with no status.
- `test/calibre-sync.test.ts` — AC-1's sync clauses, AC-2, AC-3.
- `.claude/rules/schema.md` — the Unlisted writers.

## Verification

- Automated: `test/calibre-sync.test.ts` on the test database.
- Manual: none; the owner's next sync lists any such book under *in*.

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
