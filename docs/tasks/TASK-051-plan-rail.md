---
id: TASK-051
title: 2.2b The plan rail
status: Draft
depends_on: [TASK-049, TASK-011]
size: L
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-051 — 2.2b The plan rail

## Goal

The plan draws as a rail. Each quarter is a column, each book a block sized by its word count and stacked in your order, and a dashed rule marks quarterly capacity. The part over the rule is hatched, so the books past capacity are always the ones you ranked last. Bare-year entries sit in a fifth lane. The dashboard's *This quarter* strip is this rail drawn for one quarter.

## Context

- Roadmap: `docs/05-roadmap.md` § 2.2b The plan rail (M10, last; pulled ahead of cutover by 1.25: 2.0 → 2.1 → 2.2 → 2.2b, then 2.3, before 1.26). The roadmap entry and its **Check:** are the contract. Split out of 2.2 (R3-12). Features: F-22. Depends on 2.2 (TASK-049, the slot) and 1.7 (TASK-011, `plan_period`); the rule is 2.1's quarterly capacity (TASK-046).
- **Why this is one large task** (`workflow.splitPolicy: never-split`): the component and its layout rules (stacking, the hatch above the rule, the merged stacks, the fifth lane), its query, the dashboard strip's swap to it, the skeleton's re-measure and its tests at three widths come to more than 8 files.
- **The rail** (`docs/04-design.md` § 6. The plan rail; `design/STYLE_GUIDE.md` §3; `design/Plan Rail Spec.dc.html` A4.1, A4.2): a quarter is a column, a book is a block sized by its word count, a dashed rule across all four columns is the quarterly capacity. Blocks stack from the foot of the column in the quarter's `ordinal` order (D-37), so the cumulative total crosses the rule at the end of your order: only **the part of a block above the rule** takes `--hatch` over `--blocked-soft`, and that block's ring turns `--blocked`, its label on a `--surface` chip over the hatch. A fifth lane behind a dashed border holds bare-year rows; it has no order (D-37) and stacks largest at the foot. On deck and Someday are not on the rail (they count against no capacity). There is no month layout and no *Quarter | Month* control (D-38).
- **Every block is a `<button>`** with an accessible name (*Piranesi, 65k words, estimated, Q1 2027*) and at least a 24×24px hit area; two or more adjacent sub-24px blocks merge into one `+N · Nk` stack button (`--raise`, dashed `--faint-deco`, height the sum or 24px, whichever is larger); a lone sub-24px block keeps its drawn height and gets a 24px `::after` hit area. Estimated counts (`data-wc="estimated"`) have a dotted top edge and a `~` prefix, with a legend tag.
- **One rail markup** (M-07), the same on the dashboard and the plan page (2.10): `button.qb` with the book's genre hue in `--hue` (one book, one hue), `.over` for a block past the rule, `.un` for a fifth-lane entry (a button, not decoration), `data-wc` for estimated counts. No inline fills (Hard rule 6: custom properties only). Quarter footers carry an amber *over Nk* badge or a grey *Nk room* badge, never green (M-06); **on the phone the footer shows only the amber overage** (`+132k`); the grey room badge is desktop only (SG-D11).
- **Geometry:** 230px tall on the phone and 300px on desktop, scaled so 1000k fills a quarter column; columns 6px apart on the phone, 10px on desktop; the fifth lane 52px on the phone and 150px on desktop (*2027 · no quarter*), with a 1px dashed `--blocked` left border and `.un` blocks in `--blocked-soft` with a dashed `--blocked` ring; a block is radius 3 with a 3px `--hue` left edge on `--reading-soft`, gap 2; the capacity rule is 1.5px dashed `--ink-2`. Measurements in the design files are geometry, not data (D-7 applies to their figures, not their pixels).
- **The dashboard strip** (FP-D8): 2.2 (TASK-049) draws *This quarter* as a single-quarter strip; this task draws it with this component as a one-quarter rail (its desktop strip fills its card's inner width, each block k / 760 of it, the rule at the right edge: the plan says how the one component draws both a column and that horizontal strip). The four-column rail's own screen is `/books/plan` (2.10), not built here.
- **Open, ask at the plan gate: what a tap does before 2.3.** The entry says tapping a block opens 2.3's picker sheet; 2.3 (M11) is built after this task. Until it lands, a block is still a `<button>` with its name (the Check measures it), and the plan says what it does (nothing yet with a visible reason, or opens the book's Library row). Note it in 2.3's entry as a follow-up.
- *From 1.8d (TASK-027):* `PlanRailSkeleton` (`src/components/Skeleton.tsx`) was measured against a fixture of the mockup's markup (`test/e2e/fixtures/plan-rail.html`, `test/e2e/skeletons.spec.ts`); re-measure it against this component, within 2px at 360px.
- Moving a book in the Check uses the existing plan helpers (`moveToTop`, `reorderQuarter` in `src/db/writes.ts`); no new write is needed.
- Design: mockups `bdash` (the strip), `plan` and `planmonth` (*Plan rail — estimates, stacks, drag*; month retired, D-38) in `design/mockups.html`; captures `design/captures/1.8a/planmonth-*.png`. Desktop drag (ghost, live readout) is 2.3/2.10's, not this task's.
- Decisions: D-37, D-38, D-40, D-7, M-06, M-07, SG-D11, FP-D8, R3-12.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): a quarter whose books total 892k against a 760k capacity renders
exactly the blocks past 760k as hatched, and those are the quarter's highest
ordinals; moving the last hatched book to the top of the order renders it plain
and leaves the quarter's total unchanged. A book with `period = '2027'`
renders in the fifth lane and in no column. A block straddling the rule is
hatched above the rule and plain below it. Every interactive element inside
`.planrail` measures at least 24×24 CSS px, an estimated book renders the dotted
edge and `~` label, the rail renders without horizontal page overflow at 360px,
and no *Quarter | Month* control renders anywhere. At 360px no quarter footer renders a *room* badge; at 1280px an
under-capacity quarter does. Nothing resolves to `--danger`. Screenshot at 360px
and 412px.
- [ ] AC-2: The layout function, unit-tested with no browser: given a quarter's books in ordinal order with their word counts and a capacity, it returns for each block its drawn height at the rail's scale (1000k = the column height), whether it is over, and for a straddling block the split point at the rule; given three adjacent blocks each under 24px it returns one stack of `+3` with their summed words; given one lone sub-24px block it returns that block unmerged.
- [ ] AC-3: Each block's accessible name gives its title, its word count rounded to k, *estimated* when its count is, and its period (*Q1 2027*, or *2027* in the fifth lane); a stack button's name says how many books and how many words it holds.
- [ ] AC-4: On the dashboard, *This quarter* is drawn by this component: its planned total still equals TASK-046's figure for the current quarter, and the over part of its last block is hatched when the quarter is past capacity. `PlanRailSkeleton` measures within 2px of the loaded rail at 360px.
- [ ] AC-5: The rail meets the UX floor (`docs/04-design.md` § 10. The UX floor): every block and stack is a real `<button>` with a name and a hit area of at least 24×24px; the hatch, the rule and the badges hold 3:1 against their background in both themes; over-capacity is amber with text (*over Nk*, *+Nk*), never colour alone and never red; screenshots at every `ui.viewports` width, light and dark.

## Out of scope

- `/books/plan` and the full-size rail page (2.10), the plan editor and its picker and move sheets (2.3), rebalance and *Accept* (2.7, the grey `--hatch-settled`), *Place them* (2.8).
- Desktop drag between quarters (2.3/2.10).
- Any month layout or control (D-38).
- Changing how capacity is computed (2.1, TASK-046).

## Files likely touched

- `src/components/PlanRail.tsx` (new) — the rail, the fifth lane, footers, the one-quarter strip.
- `src/lib/plan-rail.ts` (new) — the layout: heights, the over split, merged stacks.
- `src/db/queries.ts` — a year's or a quarter's blocks: book, words and source, ordinal, period, genre hue.
- `src/app/globals.css` — `.planrail`, `.qb`, `.over`, `.un`, the hatch, footers, from tokens only.
- `src/components/QuarterStrip.tsx` (from TASK-049) — draws through `PlanRail`.
- `src/components/Skeleton.tsx` — `PlanRailSkeleton` re-measured.
- `test/plan-rail.test.ts` (new), `test/e2e/plan-rail.spec.ts` (new), `test/e2e/skeletons.spec.ts`.

## Verification

- Automated: `test/plan-rail.test.ts` (AC-2, AC-3's names); `test/e2e/plan-rail.spec.ts` on the TEST database (the 892k / 760k quarter, `moveToTop` and the re-render, the fifth lane, the straddle, 24×24 hit areas, estimated edge, no overflow at 360px, footers at 360 and 1280, no *Quarter | Month*, `--danger` absent, screenshots); `test/e2e/skeletons.spec.ts` (the re-measure).
- Manual: `npm run dev`, open `/books` with a quarter planned past capacity → the last books in your order are hatched above the dashed rule; reorder one of them to the top (Reorder), see it plain, then put the order back.

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
