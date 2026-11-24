---
id: TASK-143
title: 6.24 Built screens follow the mediums review (1 of 4) — the capped finish toast
status: Draft
depends_on: []
size: M
model: opus
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-143 — 6.24 Built screens follow the mediums review (1 of 4) — the capped finish toast

## Goal

Finishing a book in a series shows a short toast: one *Now reading* chip and *+N · Follow…*, with *Keep going?* moved into the *Follow…* sheet, so the toast stays readable however many things the finish touches.

## Context

- Roadmap: `docs/05-roadmap.md` § 6.24 Built screens follow the mediums review (M21 in `docs/06-tasklist.md`; follows 6.23's review, D-177). Feature F-44. Depends on 6.23 (TASK-126, done). Its **Check:** is AC-1, verbatim; proposed, and agreed when merged.
- **Split, 1 of 4** (`workflow.splitPolicy: split`: four screens across seven components, the mockup's frames and six new 834px frames are more than one sitting). This part: the finish toast. TASK-144 does *Remove from Listen next* and the sheets' steppers, TASK-145 the Library's dropdown chips, TASK-146 the remaining mockup frames, and TASK-146's merge ticks 6.24.
- **The departure** (MR-D17, MR-Q19, frame E10 in `design/MR-E-Review-2.dc.html`; PNGs in `design/screenshots/mediums-review/`; `design/STYLE_GUIDE.md` §17.8–§17.9): the finish toast keeps one *Now reading* chip and *+N · Follow…*; *Keep going?* moves into the *Follow…* sheet, where *Rank it* keeps its row. **It amends 2.2h** (D-117: one *Now reading* chip per thing the finish followed) and 2.2c's *Keep going?* row in the toast (D-108).
- **What exists.** `src/components/ToastOffer.tsx` draws the chip rows (*Rank it in 2026* above, task 3.4b; *Now reading*, one chip per follow, each ending in a grey × named *Stop following <name>*; then *Keep going?*), loaded lazily by `src/components/Undo.tsx` only when a toast carries an offer (PR #197's Lighthouse run). Taking a chip writes, then pushes its own entry carrying the chips left, which commits the finish. The offer is built in `src/lib/follow-offer.ts`; the follow sheet is `src/components/FollowSheet.tsx` with `src/components/FollowOptions.tsx`. Finishes come from `src/components/FinishBook.tsx` and `src/components/BookStatus.tsx` via `src/components/useBookWrite.ts`.
- **Unchanged behaviour the plan must keep:** a chip that fails says so with Retry and changes nothing; focus stays in the toast when it was there; one toast at a time; undo of the finish still undoes it.
- **Questions for the plan gate** (write them in the plan, never guess): which *Now reading* chip is the one kept when the finish followed several (outermost first, as *where the book sits* orders them, is the frame's); whether *+N* counts the remaining *Now reading* follows and *Keep going?* offers together; and that the frame's *Rank it* row is the toast's or the sheet's.
- Design: `design/mockups.html` § `finishoffer` (and `thisorthat`'s toast, which draws *Rank it* above *Now reading*), redrawn from E10 (`ui.redrawFiles`; `design/mockups-index.md` lists `finishoffer` as 6.24's).
- Rules: `.claude/rules/ui.md` (completion has no celebration, nothing red on a dashboard). UX floor: `docs/04-design.md` § 10. The UX floor. Decisions: D-40, D-108, D-117, D-177.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves *finishing a book in a series shows one Now reading chip and +N · Follow…, and Keep going? is in the Follow… sheet*. TASK-144 to TASK-146 prove the rest):
browser test at 360px, light and dark: *Remove from Listen next* resolves to
no `--danger` colour; finishing a book in a series shows one *Now reading*
chip and *+N · Follow…*, and *Keep going?* is in the *Follow…* sheet; the
batch and finish sheets' stepper buttons resolve to `--sunk`; the Library
shows *Owned* and *Sort* as dropdown chips in one row and the genre row, and
nothing scrolls sideways; `design/mockups.html`'s `blist`, `status`,
`finishoffer`, `batch` and `settings` frames are redrawn from the review and
it gains the six 834px frames.
- [ ] AC-2: Given a finish that follows three things and offers two to keep going, the toast shows exactly one *Now reading* chip and one *+N · Follow…* button whose N is the count the plan fixes; opening *Follow…* lists the other follows and the *Keep going?* offers, each taking writes what its chip wrote before.
- [ ] AC-3: Given a finish that follows exactly one thing and offers nothing, the toast shows its one *Now reading* chip and no *+N · Follow…*.
- [ ] AC-4: Taking a chip in the toast or in the sheet commits the finish as before (the finish's undo window closes), a failed chip shows Retry and changes nothing, and *Rank it in 2026* still opens *This or that*.
- [ ] AC-5: The toast and the *Follow…* sheet meet the UX floor (`docs/04-design.md` § 10. The UX floor): every chip and button a real control with a name and at least 44px tall in the toast, focus moves into the sheet and returns to *+N · Follow…* on close, reduced motion respected, axe reports no new violations, and screenshots at each `ui.viewports` width, light and dark.
- [ ] AC-6: `design/mockups.html` § `finishoffer` is redrawn from E10 and its `design/mockups-index.md` row says so.

## Out of scope

- *Remove from Listen next*, the steppers (TASK-144), the Library (TASK-145), the other mockup frames (TASK-146).
- What a finish follows (2.2h's rules) or what *Keep going?* offers (2.2c's): only where they are shown changes.
- *This or that* itself (3.4b).

## Files likely touched

- `src/components/ToastOffer.tsx`, `src/components/Undo.tsx` — the capped toast.
- `src/components/FollowSheet.tsx`, `src/components/FollowOptions.tsx` — *Keep going?* and the remaining follows in the sheet.
- `src/lib/follow-offer.ts` — the toast's share and the sheet's.
- `src/app/globals.css` — tokens only.
- `design/mockups.html`, `design/mockups-index.md` — `finishoffer`.
- `test/undo.test.tsx`, `test/e2e/follows.spec.ts` — AC-1's clause, AC-2 to AC-5.

## Verification

- Automated: `test/undo.test.tsx` (AC-2 to AC-4, the chips and the counts); `test/e2e/follows.spec.ts` at 360px, light and dark, with axe (AC-1's clause, AC-5).
- Manual: the ui-verifier finishes a book in a followed series on the dev database and walks the toast and *Follow…* → expected: one chip, *+N · Follow…*, *Keep going?* in the sheet; the data is left as found (undo the finish).

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
