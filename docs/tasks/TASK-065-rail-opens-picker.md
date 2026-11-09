---
id: TASK-065
title: 2.3 Plan editor (3 of 3) — the rail's blocks open the picker, a stack its list
status: Ready
depends_on: [TASK-064, TASK-051]
size: M
model: sonnet
autonomy: unattended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-065 — 2.3 Plan editor (3 of 3) — the rail's blocks open the picker, a stack its list

## Goal

Tapping a book on the plan rail, including the dashboard's *This quarter* strip, opens the picker for that book, and tapping a `+N` stack lists its books.

## Context

- Roadmap: `docs/05-roadmap.md` § 2.3 Plan editor (M11). The entry and its **Check:** are the contract. Feature F-23. **Pulled ahead of 1.26 by 1.25.**
- **Split, 3 of 3.** TASK-063 built the writes, TASK-064 the picker sheet. This part swaps the rail's stopgaps for them. **Its merge ticks the roadmap entry**, and the tasklist row's Done cell once all three are Done.
- *From 2.2b (TASK-051, PR #214):* until this lands, a rail block (the dashboard's *This quarter* strip, and the rail on 2.10's page) is a `button` in a GET form to `/books/list?q=<title>`, its book's Library row, and a `+N` stack is an `aria-disabled` button with its reason shown (`PlanRail.tsx`, D-137). This task swaps both for the picker sheet and the list sheet, the strip included, and drops the stack's reason line.
- **Where in the code.** `src/components/PlanRail.tsx`: the stack's reason constant (around line 14), the `aria-disabled` stack button (around line 166), the GET form (around lines 179–188). The strip is `src/components/QuarterStrip.tsx`, the rail on its side (`axis="row"`).
- **The list sheet.** A stack (D-135: two or more adjacent blocks under 24px; D-138: the `+N more · Nk` fold past a column's top) lists its books, each with its words; choosing one opens TASK-064's picker for it. Design: `docs/04-design.md` § 14 → Plan (*runs of sub-24px blocks merge into a `+3 · 180k` stack button that opens a list sheet*).
- **One rail markup** (M-07): `button.qb`, `.over`, `.un`, `--hue`. The block keeps its name (*Piranesi, 65k words, estimated, Q1 2027*) and its 24px box (D-135).
- **Autonomy:** one layer (UI), it follows TASK-064's sheet and TASK-051's component, and every criterion is a browser check the ui-verifier can run.
- The dashboard is a feel-pass surface (`docs/04-design.md` § 10): the strip's changed states are screenshotted at every feel-pass width.
- Design: mockups `bdash` (the strip), `plan` and `planmonth` (stacks) in `design/mockups.html`.
- Decisions: D-137, D-135, D-138, M-07.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; proven by TASK-063 and TASK-064, and re-run here once the rail opens the same sheet): test that moving a 150k-word book from 2027 Q1 to 2028 Q2 changes
both periods' totals correctly and that the preview reflects the destination
period before the move is confirmed. The moved book takes 2028 Q2's last
ordinal, 2027 Q1 stays contiguous, and undo puts it back at its old position.
Test that On deck and Someday need no year or quarter; that Someday clears the
book's `reading_plan` row without touching `book_status`; that *No quarter yet*
writes a bare year; and that the sheet writes one `period` value, never a year
independent of a quarter and never a month. **Flip (R3-08):** 1.4c's add sheet
now offers *Year or quarter…* through this picker, and adding a book to a year
or quarter writes its `book_status` and `reading_plan` rows in one transaction;
1.9's empty Books *Up next* action becomes *Plan a book*.
- [ ] AC-2: On `/books`, activating a book block in the *This quarter* strip opens the picker sheet for that book (its title in the heading) and the URL does not change; no `form` element is left in the rail's markup.
- [ ] AC-3: A `+N` stack is a button without `aria-disabled`, and the stack's reason line is gone; activating it opens a list sheet naming each of its books with its words, and choosing one opens the picker for that book.
- [ ] AC-4: Moving a book from the strip to another quarter redraws the strip with the new total, and the toast's Undo puts the book back and the strip as it was.
- [ ] AC-5: The strip and the list sheet meet the UX floor (`docs/04-design.md` § 10. The UX floor), on a feel-pass surface: every block and stack a named button with at least a 24px target, focus back on the block or stack when a sheet closes, nothing resolves to `--danger`, axe with no new violations, no horizontal scroll at 360px, and screenshots at 360, 390, 412, 768, 1024 and 1280px, light and dark, with reduced motion and reduced transparency.

## Out of scope

- The full-size rail on `/books/plan` (2.10, TASK-069), which reuses these handlers.
- Desktop drag and the hover popover (TASK-070).
- Any change to block geometry, folding or hue (D-135, D-136, D-138).

## Files likely touched

- `src/components/PlanRail.tsx` — blocks open the picker; stacks open the list.
- `src/components/QuarterStrip.tsx` — the strip, if its props change.
- `src/components/RailStackSheet.tsx` (new; the plan's name) — the list sheet.
- `src/app/globals.css` — the list sheet, from tokens only.
- `test/e2e/plan-rail.spec.ts`, `test/e2e/books-dashboard.spec.ts`, `test/plan-rail.test.ts`.

## Verification

- Automated: `test/e2e/plan-rail.spec.ts` (AC-2, AC-3, AC-5); `test/e2e/books-dashboard.spec.ts` (AC-4 on the strip, the feel-pass screenshots); `test/plan-rail.test.ts` (no form or `aria-disabled` stack in the markup).
- Manual: `npm run dev`. On `/books`, tap a block in *This quarter* → the picker for that book; move it → the strip redraws; Undo → as before. With a quarter of short books, tap the `+N` stack → its books listed; pick one → the picker. Put everything back, as found.

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
