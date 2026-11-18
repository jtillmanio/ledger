---
id: TASK-116
title: 2.2k The books page scrolls sideways with a full Up next shelf
status: Draft
depends_on: [TASK-049]
size: S
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-116 — 2.2k The books page scrolls sideways with a full Up next shelf

## Goal

With a full quarter planned, `/books` stays the width of the screen on a phone and a tablet: only the *Up next* shelf scrolls sideways, inside its own box.

## Context

- Roadmap: `docs/05-roadmap.md` § 2.2k (its **Check** is AC-1, verbatim; proposed by TASK-051, agreed by merging). `docs/06-tasklist.md` M10. Pulled ahead of 1.26 (D-139), so TASK-061 (1.26) waits on it.
- Found by TASK-051's UI check (2.2b, PR #214; its Follow-ups): at 360, 390 and 412px with four or more books planned in the quarter, `scrollWidth` was 392 to 640, and at 768px with seven. Hiding the *Up next* `ul.shelf` cleared it; the visually hidden span was the suspect.
- The shelf: `src/components/PlanShelf.tsx` (`ul.shelf` › `li.card`, the `.sr-only` ordinal inside `.card-title`, the `.pos` chip) and `src/app/globals.css` § the comics Up next queue (`.shelf`, `.shelf .card`, `.sr-only`; the shelf takes `margin:0 -2rem` from 768px). `QueueShelf.tsx` (comics) uses the same CSS: a fix in the shared rules must leave the comics shelf as it is.
- **For the plan gate: reproduce first.** 2.2g's test, `test/e2e/books-dashboard.spec.ts` › "a full Up next shelf and the rows together: no sideways scroll at 360px", already seeds six shelf cards at 360px and passes in CI (it merged in PR #213, the PR before the one whose check found the bug). So the trigger is something it lacks: long titles and authors (2.2j's sub-line, PR #241, came later), real covers (4.3, PR #271), a fine pointer's pager, or the dev data. The plan says what reproduces it on the test database, at which widths, and which element overflows. If nothing reproduces it now, the plan names the change that fixed it, and the task still adds AC-1's tests so it can't come back.
- Helpers: `expectNoHorizontalScroll` (`test/e2e/helpers.ts`) compares `documentElement.scrollWidth` and `body.scrollWidth` with `clientWidth`.
- UX floor: `docs/04-design.md` § 10. Design: `design/mockups.html` `bdash`; the feel pass, `design/STYLE_GUIDE.md` § 14.1 (slot 2, FP-D2).
- Decisions: D-139 (pulled ahead), D-40 (the feel pass), D-80 (the browser suite with axe).

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): with six books planned in the current quarter, `/books` at 360px, 390px and 412px has `documentElement.scrollWidth` equal to the viewport width (`expectNoHorizontalScroll`); the *Up next* shelf scrolls inside its own box and no card is clipped by the page. The same at 768px with seven. axe passes and nothing resolves to `--danger`.
- [ ] AC-2: The e2e test seeds the trigger the plan found (each book with a two-line title and a long author, universe and series line, as 2.2j draws it), and fails on `main` before the fix at at least one of the four widths. Each card's `.card-title` and `.sr-only` stay inside the shelf's `ul` box (`boundingBox` x and right edge within it, scrolled into view).
- [ ] AC-3: The shelf still scrolls: at 360px with six books, `ul.shelf`'s `scrollWidth` is greater than its `clientWidth`, and scrolling it to the end shows the last card whole. At 1280px the ‹ › pager still appears and pages the shelf.
- [ ] AC-4: The comics *Up next* shelf (`QueueShelf`) with six runs has no sideways scroll at 360px either, and its cards measure as before the change (same card width and gap).
- [ ] AC-5: The books dashboard with a full shelf meets the UX floor (`docs/04-design.md` § 10): no horizontal scroll, axe, text contrast, a screenshot at each `ui.viewports` width.

## Out of scope

- The shelf's design (card size, gap, what a card says) and the pager's behaviour: only the overflow is fixed.
- Making a shelf card open the book sheet: 3.5b (TASK-120).
- The *This quarter* strip, which was ruled out as the cause.

## Files likely touched

- `src/app/globals.css`: the `.shelf` / `.card` / `.sr-only` rule that lets content escape
- `src/components/PlanShelf.tsx`: only if the fix is in the markup (where the ordinal's hidden text sits)
- `test/e2e/books-dashboard.spec.ts`: AC-1's widths and AC-2's seed; AC-3's scroll

## Verification

- Automated: `test/e2e/books-dashboard.spec.ts` (and `queue.spec.ts` for AC-4) at 360, 390, 412 and 768px; run the changed spec in one project locally (`node scripts/test-files.mjs`), every project in CI.
- Manual: with seven books planned this quarter, open `/books` at 390px and swipe the page sideways → expected: the page doesn't move; the shelf scrolls and snaps.

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
