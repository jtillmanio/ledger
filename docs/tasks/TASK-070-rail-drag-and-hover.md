---
id: TASK-070
title: 2.10 Plan page as the full-size rail (2 of 2) — drag and hover on the desktop
status: Draft
depends_on: [TASK-069]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-070 — 2.10 Plan page as the full-size rail (2 of 2) — drag and hover on the desktop

## Goal

With a mouse or trackpad, a book can be dragged to another quarter or the fifth lane, showing where it would land and what that quarter would then hold before you let go; hovering a block names it.

## Context

- Roadmap: `docs/05-roadmap.md` § 2.10 Plan page as the full-size rail (M11). The entry and its **Check:** are the contract. Feature F-23.
- **Split, 2 of 2.** TASK-069 built the page and proved the Check; this part adds the desktop's pointer routes. **Its merge ticks the roadmap entry**, and the tasklist row's Done cell once both are Done.
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
