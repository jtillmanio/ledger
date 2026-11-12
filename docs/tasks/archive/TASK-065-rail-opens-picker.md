---
id: TASK-065
title: 2.3 Plan editor (3 of 3) — the rail's blocks open the picker, a stack its list
status: Done
depends_on: [TASK-064, TASK-051]
size: M
model: sonnet
autonomy: unattended
ui: true
plan_status: approved
planned_at_commit: 5e77a3d
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

- [x] AC-1 (roadmap **Check:**, verbatim; proven by TASK-063 and TASK-064, and re-run here once the rail opens the same sheet): test that moving a 150k-word book from 2027 Q1 to 2028 Q2 changes
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
- [x] AC-2: On `/books`, activating a book block in the *This quarter* strip opens the picker sheet for that book (its title in the heading) and the URL does not change; no `form` element is left in the rail's markup.
- [x] AC-3: A `+N` stack is a button without `aria-disabled`, and the stack's reason line is gone; activating it opens a list sheet naming each of its books with its words, and choosing one opens the picker for that book.
- [x] AC-4: Moving a book from the strip to another quarter redraws the strip with the new total, and the toast's Undo puts the book back and the strip as it was.
- [x] AC-5: The strip and the list sheet meet the UX floor (`docs/04-design.md` § 10. The UX floor), on a feel-pass surface: every block and stack a named button with at least a 24px target, focus back on the block or stack when a sheet closes, nothing resolves to `--danger`, axe with no new violations, no horizontal scroll at 360px, and screenshots at 360, 390, 412, 768, 1024 and 1280px, light and dark, with reduced motion and reduced transparency.

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

- (approved at plan) `docs/04-design.md` § 6: drop "until 2.3 it is `aria-disabled` with its reason shown, D-137" from the stack sentence → docs/04-design.md § 6. The plan rail (approved at plan)
- (approved at plan) Decision: a rail block opens the picker and a stack opens its list sheet, in one `Sheet`; supersedes D-137's interim clause → docs/review/decisions.md § D-146 (approved at plan)
- A full-ruleset axe run (ui-verifier) found two things on the dashboard that are not the rail's and are outside the specs' rule list: `scrollable-region-focusable` on the *Up next* shelf, and `label-content-name-mismatch` on the *Finished it* header button at 1024 and 1280 → docs/05-roadmap.md § Later — noted, not scheduled (L-12, new)
- Lighthouse failed on the first push: `PlanRail` became a client component and `Skeleton` imported `RailLegend` from it, so every skeleton route carried the rail (+5.7 KB, +1 request) → not tracked: done in this PR (plan revision 1: `RailLegend.tsx`, with a guard test)
- The list rows' `aria-label` did not contain their visible text (WCAG 2.5.3, ui-verifier) → not tracked: done in this PR (the name is now the visible text; `label-content-name-mismatch` joins the sheet axe checks)
- The picker reached from a stack list draws the *‹ stack* back button as a full-width bar at 1280 → not tracked: it is the `pp-back` pattern Add books already draws; no design source draws either
- A strip stack under 24px measures 23.98px at 360px (the browser snaps border widths) → not tracked: existing strip geometry (D-135, out of scope), and axe's target-size passes

## Plan

Approved by the owner at the plan gate, with every follow-up below.

**Steps**
1. Tests first, confirmed failing: no `form`, no `aria-disabled` stack and no `.qnote` in the rail markup; a strip block opens the picker with the URL unchanged; a stack opens the list sheet and choosing a book opens the picker; Move then Undo on the strip; focus back on the opener.
2. `PlanRail.tsx` becomes a client component that owns the open-sheet state. Blocks are plain `button.qb` (no GET form). Stacks are real buttons (no `aria-disabled`, no `aria-describedby`); `STACK_REASON`, the `.qnote` line and the legend's reason sentence go. Both sheets load lazily with `dynamic`, as `PlanQuarterRows` does.
3. New `RailStackSheet.tsx`: one `Sheet` (no history-entry race between two sheets). Its body is first the stack's books (title and words, one button each); choosing one swaps the body to that book's picker (`MoveBody`) with a back button and the heading changed to the title; focus goes to the heading on the swap and back to the chosen row on back, as `AddBooks` does.
4. Focus on close: `Sheet` returns focus to the opener. After a move the block may be gone once the page refreshes: the rail remembers the opener and, when the refreshed props arrive with focus lost to `body`, refocuses the same block or falls back to the rail group (`tabIndex=-1`, which announces the new summary).
5. `globals.css` (tokens only): list-sheet rows with 44px targets, a focus style for the group; drop `.qf`, `.qnote`, `.qb.stack[aria-disabled]`.

**Files**: `src/components/PlanRail.tsx`, `src/components/RailStackSheet.tsx` (new), `src/components/PlanPicker.tsx` (export `MoveBody`; not in "Files likely touched"), `src/app/globals.css`, `test/plan-rail.test.ts`, `test/e2e/plan-rail.spec.ts`, `test/e2e/books-dashboard.spec.ts`. `QuarterStrip.tsx` only if its props must change. `design/mockups.html` and `design/mockups-index.md` (`ui.redrawFiles`) only if `bdash`, `plan` or `planmonth` still draw the old stopgap.

**Test strategy**
- AC-1: TASK-063's and TASK-064's suites re-run unchanged.
- AC-2, AC-4: `test/e2e/books-dashboard.spec.ts`.
- AC-3, AC-5: `test/e2e/plan-rail.spec.ts`, including axe, 24px targets, no horizontal scroll at 360px, nothing on `--danger`, and screenshots at 360, 390, 412, 768, 1024 and 1280px, light and dark, with reduced motion and reduced transparency.
- Markup (no form, no `aria-disabled` stack): `test/plan-rail.test.ts`.

**Revision 1 (owner OK, after Lighthouse failed on the first push):** add `src/components/RailLegend.tsx`, a module with no `"use client"` that `Skeleton.tsx` and `PlanRail.tsx` both import, so the skeleton routes no longer carry the rail's client bundle; `test/loading-states.test.tsx` imports it from there, and `test/plan-rail.test.ts` guards the split.

**Risks**: the strip also draws read and reading books; tapping one opens the picker, which already says only a to-read book can be planned (TASK-064). Left as it is. `/books/plan` gets the same behaviour from the shared component (TASK-069, TASK-070 expect it).

## Review log

Verify R1 PASS | CI R1 FAIL (books-dashboard.spec.ts:539, w360-light and w360-dark: a 60k strip stack measures 23.98px, the shared floor check wants 24) -> fixed, a 90k stack | CI R2 PASS, Lighthouse FAIL (library 65 requests; +5.7 KB on every skeleton route, the rail pulled in by Skeleton) -> fixed, RailLegend.tsx (plan revision 1) | Verify R2 PASS | Audit R1 PASS | Spec R1 CHANGES (Follow-ups wording only) -> fixed at close-out | UI R1 PASS (AC-2 to AC-5 at six widths; list-row label-content-name-mismatch -> fixed, name is the visible text)

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 2
- Review rounds: 1 (spec-reviewer, test-auditor, ui-verifier; one round each)
- First-pass AC FAILs: 0 (CI and Lighthouse each found one thing the local run did not)
- Plan revisions after approval: 1 (RailLegend.tsx)
