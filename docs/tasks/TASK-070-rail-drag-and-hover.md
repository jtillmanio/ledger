---
id: TASK-070
title: 2.10 Plan page as the full-size rail (2 of 2) — drag and hover on the desktop
status: In progress
depends_on: [TASK-069, TASK-065]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: 1460e95
---

# TASK-070 — 2.10 Plan page as the full-size rail (2 of 2) — drag and hover on the desktop

## Goal

With a mouse or trackpad, a book can be dragged to another quarter or the fifth lane, showing where it would land and what that quarter would then hold before you let go; hovering a block names it.

## Context

- Roadmap: `docs/05-roadmap.md` § 2.10 Plan page as the full-size rail (M11). The entry and its **Check:** are the contract. Feature F-23.
- **Split, 2 of 2.** TASK-069 built the page and proved the Check; this part adds the desktop's pointer routes. **Its merge ticks the roadmap entry**, and the tasklist row's Done cell once both are Done.
- **After TASK-065 (owner, 2026-11-12).** Until TASK-065 lands, a rail block is a submit button in a GET form to its Library row, so AC-4's *a tap opens the Move sheet* can't hold and a drag would start on a form button. TASK-065 swaps the blocks for the picker on every rail, this page's included; drag and hover build on those blocks.
- **Drag-to-move** (the entry; `design/Plan Rail Spec.dc.html` A4.4): a ghost block and a live readout (*Q3 +118k → 533k / 760k*, sample figures, D-7) before release. The ghost is rotated −1.5° on `--sh-2` with a 2px dashed `--brand` outline, the source slot keeps a dashed placeholder, and the readout is an `output.dropdelta` with `aria-live`. A block dropped on another quarter joins the end of its order; one dropped on the fifth lane takes none, like Move. Reordering inside a quarter stays on the Up next tab (1.9).
- **Hover** on a block shows a popover with its name, words and the estimated flag.
- **Pointer, not width (D-33).** Drag and hover need `(hover:hover) and (pointer:fine)`; phone and tablet keep the tap to the Move sheet (2.3, TASK-064), which is also the keyboard route.
- Every drop writes through 2.3's moves (TASK-063: `movePlan`, the end of the quarter) and pushes an undo onto the 1.2 stack. The readout's figures come from the same totals as the summary rows.
- Motion confirms, never celebrates: under `prefers-reduced-motion` the ghost doesn't animate (`docs/04-design.md` § 10).
- Design: `docs/04-design.md` § 6. The plan rail; § 14 → Plan (*Desktop drag*); mockup `planmonth` (*drag*).
- Decisions: D-33, D-37, D-7.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; proven by TASK-069 and re-run here with drag in place): test that the sum of the rendered block heights in a quarter equals
that quarter's word total to the pixel rounding; that a book crossing the
capacity line renders hatched and the one below it does not; that expanding Q2
collapses Q1; and that the rail and the dashboard render identical totals from
the same query. Screenshot at 360px and 1280px.
- [ ] AC-2: At 1280px with a fine pointer, dragging a block from Q1 over Q3 shows the ghost and an `output.dropdelta` reading *Q3 +<book's words> → <Q3's total after> / <capacity>* before release, from the same totals Q3's summary row shows; releasing puts the book last in Q3 and closes up Q1, and the toast's Undo restores both.
- [ ] AC-3: Dropping a block on the fifth lane writes a bare-year row with no ordinal; dropping it back on its own quarter writes nothing.
- [ ] AC-4: Hovering a block at 1280px shows a popover with its title, words and, for an estimated count, *estimated*; with touch emulated at 390px and 834px no drag starts and a tap opens the Move sheet.
- [ ] AC-5: Drag and hover meet the UX floor (`docs/04-design.md` § 10. The UX floor): both sit behind `(hover:hover) and (pointer:fine)` with the Move sheet as the touch and keyboard route; the readout is announced (`aria-live`); the ghost's rotation and motion drop under reduced motion; axe with no new violations; screenshots of the drag at 1280px, light and dark.

## Out of scope

- The page, its rows and the empty state (TASK-069).
- Reordering inside a quarter by drag (1.9's Up next tab).
- Keyboard drag: the Move sheet is the keyboard route.
- Drag on the dashboard's strip.

## Files likely touched

- `src/components/PlanRail.tsx` — drag sources and drop targets.
- `src/components/RailDrag.tsx` (new; or a hook, the plan's) — the ghost and the readout.
- `src/components/BlockPopover.tsx` (new; the plan's name) — the hover popover.
- `src/lib/plan-rail.ts` — the readout's arithmetic.
- `src/app/globals.css` — ghost, placeholder and popover, from tokens only.
- `test/e2e/plan-rail-drag.spec.ts` (new), `test/plan-rail.test.ts`.

## Verification

- Automated: `test/e2e/plan-rail-drag.spec.ts` (AC-2 to AC-5, with a fine pointer at 1280px and touch emulated at 390px and 834px); `test/e2e/plan-rail.spec.ts` (AC-1 re-run); `test/plan-rail.test.ts` (the readout's figure).
- Manual: `npm run dev` at desktop width. Drag a book from one quarter to another → the readout shows the total after; release → it is last there; Undo → back. Hover a block → its name and words. On a tablet, tap a block → the Move sheet. Put everything back, as found.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

## Plan

Approved by the owner up front (2026-11-12: "accept the plan right away"; questions listed in the final report).

**Steps**

1. `src/lib/plan-rail.ts`: `dropReadout(book, target)`, pure. A quarter reads `Q3 +118k → 533k / 760k` from that quarter's `plannedWords` (the same `plan_capacity` figure its footer and summary row print) plus the book's words, against its capacity. The fifth lane reads `2028 +118k → 1.2M` (no capacity). The book's own period reads `Q1 · already here`. Copy follows the style guide's A4.4 (target only), not the mockup's two-sided line (D-31 beats the mockup on component states).
2. `src/components/RailDrag.tsx` (new): `useRailDrag({ year, quarters, lane })`, the pointer engine for the column rail only (not the strip, which is out of scope). A press on a block starts a drag only when `pointerType === "mouse"` (or a pen) **and** `matchMedia("(hover:hover) and (pointer:fine)")` matches, and only after the pointer has moved 4px. It follows the window, not pointer capture (as ReorderList does). The target is the `.qcol[data-period]` under the pointer. Esc cancels. While dragging it sets `data-dragging` on the rail (no text selection), `data-lifted` on the source block (dashed placeholder) and `data-drop` on the target column. On release over another column it POSTs `/api/plan { bookId, from, to }` (2.3's `planMove` → `movePlan`: last in a quarter, no ordinal in the year), pushes the undo (`DELETE /api/plan`), and calls `router.refresh()`. Over its own column, or over no column, nothing is written. The click that follows a drag is swallowed, so the picker doesn't open. It also renders the ghost (fixed, `aria-hidden`, the block's painted height, title and words) and the always-present `output.dropdelta` (`aria-live="polite"`). A failed write says *Couldn't move it. Nothing was written.* in the output.
3. `src/components/BlockPopover.tsx` (new): a hover popover for a block, gated the same way in JS (only on a mouse `pointerenter` with FINE matching) and in CSS. It shows the title, `~65k words` and, for an estimated count, *estimated*. It is `aria-hidden`, since the block's accessible name already says all three. It is hidden while dragging. It sits at the block's right, or flips left near the viewport edge.
4. `src/components/PlanRail.tsx`: the column rail wires both in. Blocks get `onPointerDown`, `onPointerEnter` and `onPointerLeave`. Stacks are neither dragged nor hovered.
5. `src/app/globals.css`: `.ghost` (−1.5°, `--sh-2`, 2px dashed `--brand` outline), `.qb[data-lifted]` (dashed placeholder), `.qcol[data-drop]` (dashed `--brand` outline on the stack), `.dropdelta`, `.bpop` (`--sh-2`, `--overlay`), all from tokens. `prefers-reduced-motion` gives the ghost no rotation and no transition. `.bpop` and `.ghost` show only under `(hover:hover) and (pointer:fine)`.

**Files**: the five above, plus `test/e2e/plan-rail-drag.spec.ts` (new) and `test/plan-rail.test.ts`. All are in Files likely touched. No redraw: `planmonth` already draws the drag.

**Test strategy**

- AC-1: `test/e2e/plan-rail.spec.ts`, unchanged, re-run (CI, every project).
- AC-2: drag-spec *dragging a Q1 block over Q3 shows the ghost and Q3's readout; release puts it last in Q3, Q1 closes up, Undo restores both*. It asserts the readout against the `plan_capacity` row for Q3 and against Q3's footer text, and the ordinals from `reading_plan`.
- AC-3: drag-spec *dropped on the fifth lane it is a bare-year row with no ordinal* and *dropped back on its own quarter nothing is written and no sheet opens*.
- AC-4: drag-spec *hovering names the block* (an estimated book and a stated one), plus a touch describe at 390px and at 834px (`hasTouch`, `isMobile`): a pointer drag starts no ghost, and a tap opens the Move sheet.
- AC-5: drag-spec *the readout is aria-live*, *reduced motion drops the ghost's rotation*, *axe during a drag* and the screenshots at 1280px, light and dark.
- `test/plan-rail.test.ts`: `dropReadout` for a quarter, over capacity, the lane, and its own period.

**Revision 1 (after spec review R1)**: two files outside the list. The readout's empty line (about 24px under a fine pointer) moved the rail down on load: `src/components/Skeleton.tsx` reserves it in `PlanRailSkeleton`, and `test/e2e/plan-rail.spec.ts` gains a 1280px check of the rail's top under the year chips (`swapInSkeleton`, shared with the 360px skeleton test). Its error-state test now waits for hydration before swapping `main`. That race was flaky, 1 in 4 locally, with the rail's new client code. Also: an Esc-cancelled drag swallows the click its release leaves, and a failed drop is tested.

**Risks**: `router.refresh()` races the undo (the same as MoveBody's). Touch emulation must make FINE false (w390-touch already relies on that).

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
