---
id: TASK-116
title: 2.2k The books page scrolls sideways with a full Up next shelf
status: In progress
depends_on: [TASK-049]
size: S
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: 7e681c7
---

# TASK-116 — 2.2k The books page scrolls sideways with a full Up next shelf

## Goal

With a full quarter planned, `/books` stays the width of the screen on a phone and a tablet: only the *Up next* shelf scrolls sideways, inside its own box. The task first finds out whether the bug still happens, changes the shelf only if it does, and leaves tests that keep it fixed either way.

## Context

- Roadmap: `docs/05-roadmap.md` § 2.2k (its **Check** is AC-1, verbatim; proposed by TASK-051, agreed by merging). `docs/06-tasklist.md` M10. Pulled ahead of 1.26 (D-139), so TASK-061 (1.26) waits on it.
- Found by TASK-051's UI check (2.2b, PR #214; its Follow-ups): at 360, 390 and 412px with four or more books planned in the quarter, `scrollWidth` was 392 to 640, and at 768px with seven. Hiding the *Up next* `ul.shelf` cleared it; the visually hidden span was the suspect.
- The shelf: `src/components/PlanShelf.tsx` (`ul.shelf` › `li.card`, the `.sr-only` ordinal inside `.card-title`, the `.pos` chip) and `src/app/globals.css` § the comics Up next queue (`.shelf`, `.shelf .card`, `.sr-only`; the shelf takes `margin:0 -2rem` from 768px). `QueueShelf.tsx` (comics) uses the same CSS: a fix in the shared rules must leave the comics shelf as it is.
- **Explore before changing anything (owner, 2026-11-18).** The bug may already be fixed. 2.2g's test, `test/e2e/books-dashboard.spec.ts` › "a full Up next shelf and the rows together: no sideways scroll at 360px", already seeds six shelf cards at 360px and passes in CI (it merged in PR #213, the PR before the one whose check found the bug). So either the trigger is something that test lacks (long titles and authors; 2.2j's sub-line, PR #241, came later; real covers, 4.3, PR #271; a fine pointer's pager; the dev data), or a later change fixed it. Before the plan is written, try each on the test database at 360, 390, 412 and 768px, and on the development database through `npm run dev` (where TASK-051 saw it). The plan then says one of:
  - **It reproduces:** what triggers it, at which widths, which element overflows, and the smallest fix. AC-2's test fails on `main`.
  - **It doesn't:** what was tried, and which change most likely fixed it (named by its PR). No CSS or markup changes; the task adds AC-1's tests at every width so it can't come back, and AC-2 does not apply. The PR says so, and the owner's walk on the preview confirms it.
- Helpers: `expectNoHorizontalScroll` (`test/e2e/helpers.ts`) compares `documentElement.scrollWidth` and `body.scrollWidth` with `clientWidth`.
- UX floor: `docs/04-design.md` § 10. Design: `design/mockups.html` `bdash`; the feel pass, `design/STYLE_GUIDE.md` § 14.1 (slot 2, FP-D2).
- Decisions: D-139 (pulled ahead), D-40 (the feel pass), D-80 (the browser suite with axe).

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): with six books planned in the current quarter, `/books` at 360px, 390px and 412px has `documentElement.scrollWidth` equal to the viewport width (`expectNoHorizontalScroll`); the *Up next* shelf scrolls inside its own box and no card is clipped by the page. The same at 768px with seven. axe passes and nothing resolves to `--danger`.
- [ ] AC-2: The PR names the outcome of the exploration (*reproduced* with its trigger, or *not reproduced* with what was tried and the PR that likely fixed it). If reproduced: the e2e test seeds that trigger and fails on `main` at at least one of the four widths, and passes with the fix. Either way, AC-1's test seeds two-line titles and a long author, universe and series line on every card (as 2.2j draws it), and each card's `.card-title` and `.sr-only` stay inside the shelf's `ul` box (`boundingBox` x and right edge within it, scrolled into view).
- [ ] AC-3: The shelf still scrolls: at 360px with six books, `ul.shelf`'s `scrollWidth` is greater than its `clientWidth`, and scrolling it to the end shows the last card whole. At 1280px the ‹ › pager still appears and pages the shelf.
- [ ] AC-4: The comics *Up next* shelf (`QueueShelf`) with six runs has no sideways scroll at 360px either, and its cards measure as before the change (same card width and gap).
- [ ] AC-5: The books dashboard with a full shelf meets the UX floor (`docs/04-design.md` § 10): no horizontal scroll, axe, text contrast, a screenshot at each `ui.viewports` width.

## Out of scope

- The shelf's design (card size, gap, what a card says) and the pager's behaviour: only the overflow is fixed.
- Making a shelf card open the book sheet: 3.5b (TASK-120).
- The *This quarter* strip, which was ruled out as the cause.

## Files likely touched

- `src/app/globals.css`: only if it reproduces; the `.shelf` / `.card` / `.sr-only` rule that lets content escape
- `src/components/PlanShelf.tsx`: only if it reproduces and the fix is in the markup (where the ordinal's hidden text sits)
- `test/e2e/books-dashboard.spec.ts`: AC-1's widths and AC-2's seed; AC-3's scroll

## Verification

- Automated: `test/e2e/books-dashboard.spec.ts` (and `queue.spec.ts` for AC-4) at 360, 390, 412 and 768px; run the changed spec in one project locally (`node scripts/test-files.mjs`), every project in CI.
- Manual: with seven books planned this quarter, open `/books` at 390px and swipe the page sideways → expected: the page doesn't move; the shelf scrolls and snaps.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

## Plan

Approved by the owner, 2026-11-20. Worktree `.claude/worktrees/task-2.2k-up-next-shelf`, branch `task/2.2k-up-next-shelf-sideways-scroll`, test DB `ledger_test_4` (its `.env.worktree`), dev-server port 3116.

### Exploration: **not reproduced** on `main` (7e681c7)

A throwaway spec (not committed) measured `/books` on the test database at 360, 390, 412 and 768px:

- **Current `main`:** `documentElement.scrollWidth` = viewport in every case. Tried: six plain cards; six with two-line titles and a long author · universe · series line; seven with long text, real (fake-host) covers and a book in hand; the shelf scrolled to its end; a sideways wheel on the page (`scrollX` stayed 0). At 1024 and 1280 (fine pointer, nine cards) ‹ › rendered and › paged the shelf (scrollLeft 512 / 480) with no page overflow.
- **With #213's fix removed** (`.shelf .card{position:static}` injected): `scrollWidth` 640 at 360/390/412 with six cards, 872 at 768 with seven, which is TASK-051's report exactly (PR #214: "392 to 640", "768px with seven").
- **Development database (`npm run dev`):** nothing planned this quarter, so the shelf is empty; no overflow at any width.
- **What fixed it:** PR #213 (task 2.2g, d40a477) gave `.shelf .card` `position:relative` (`src/app/globals.css` § the comics Up next queue, the comment above `.shelf .card`), so the card's absolute `.sr-only` ordinal is clipped by the row instead of widening the page. TASK-051 planned and checked on b2889c3 (#211), before #213; #213 merged an hour before #214.

So: no CSS or markup changes; AC-2's "fails on `main`" clause does not apply; its seed and inside-the-box clauses do.

### Steps

1. `test/e2e/books-dashboard.spec.ts`, new `describe("a full Up next shelf (2.2k)")`:
   - Fixture on top of `seed({ reading: true })`: One and Three get a long author, universe and series (ids `e2e-dash-full-*`, so `clean` removes them); new books with two-line titles and the same long line fill the shelf to six cards below 768px and seven from 768px; every card has a cover on the fake host (`page.route`, as `dashboard-covers.spec.ts`).
   - **AC-1, AC-2, AC-5** (`FEEL`, every width project): card count 6 / 7; `expectNoHorizontalScroll`; each card scrolled into view lies inside the viewport and its `.card-title` and `.sr-only` boxes lie inside `ul.shelf`'s box (x and right edge); `floor()` (axe, contrast, no `--danger`, targets); `screenshot(page, info, "2.2k-books-full-shelf")`.
   - **AC-3** (`ONCE`, 360px set in the test): `ul.shelf` `scrollWidth > clientWidth`; scroll to the end, the last card is whole inside the shelf and the viewport.
   - **AC-3** (`DESK`, 1280): ‹ › render; › raises `scrollLeft`, ‹ brings it back to 0.
2. `test/e2e/queue.spec.ts`, **AC-4** (`ONCE`, 360px): six runs queued, no sideways scroll, each card 112px wide, 12px apart.
3. Discrimination: delete `position:relative` from `.shelf .card` locally, confirm the new tests fail (page width and `.sr-only` outside the shelf), restore. Record it in the PR; the test-auditor is told the same (the pre-task tree equals `main`, so a before/after run proves nothing here).

### Files

- `test/e2e/books-dashboard.spec.ts`: steps 1 (AC-1, 2, 3, 5)
- `test/e2e/queue.spec.ts`: step 2 (AC-4)
- Close-out: this task file, `docs/05-roadmap.md` § 2.2k tick, `docs/06-tasklist.md` M10 Done cell if its tasks are all Done

### Test strategy

| AC | Proof |
| --- | --- |
| AC-1 | books-dashboard.spec.ts › a full Up next shelf (2.2k) › FEEL test, every width project in CI; locally w360/w390/w412/w768-light |
| AC-2 | the same test's seed and inside-the-shelf checks; the PR names the outcome (not reproduced, #213) |
| AC-3 | the 360 scroll-to-end test and the 1280 pager test |
| AC-4 | queue.spec.ts › six runs at 360 |
| AC-5 | the FEEL test's `floor()` and screenshot at every `ui.viewports` width |
| Manual | owner: seven planned, `/books` at 390px, swipe sideways: the page stays, the shelf scrolls and snaps |

### Risks / open questions

- ui-verifier needs a full shelf on the dev DB: plan seven On deck books into the quarter through the app and move each back to On deck after (dev-DB exception, data left as found). If the dev DB has fewer than seven On deck, skip the walk and rely on the FEEL screenshots plus the owner's preview walk.
- Size: S, two spec files; no split.

### Follow-ups found at plan

None.

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
