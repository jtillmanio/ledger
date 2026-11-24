---
id: TASK-144
title: 6.24 Built screens follow the mediums review (2 of 4) — grey Remove from Listen next, steppers on --sunk
status: Ready
depends_on: []
size: S
model: sonnet
autonomy: unattended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-144 — 6.24 Built screens follow the mediums review (2 of 4) — grey Remove from Listen next, steppers on --sunk

## Goal

*Remove from Listen next* reads grey like *Remove from shelf*, and the batch and finish sheets' steppers sit on `--sunk` like every other stepper.

## Context

- Roadmap: `docs/05-roadmap.md` § 6.24 Built screens follow the mediums review (M21). Feature F-44. Its **Check:** is AC-1, verbatim; proposed, and agreed when merged.
- **Split, 2 of 4.** TASK-143 does the finish toast, TASK-145 the Library, TASK-146 the remaining mockup frames and ticks 6.24.
- **Grey Remove** (MR-D16, frame E8 in `design/MR-E-Review-2.dc.html`): *Remove from Listen next* (`src/components/ListenNext.tsx`, task 5.14, its row menu's `label: \`Remove from ${LISTEN_NEXT}\``) is grey, as *Remove from shelf* is. Copy how *Remove from shelf* is styled (`src/components/ShelfBooks.tsx`).
- **Steppers on `--sunk`** (MR-D18, MR-Q18, frame E11; `design/STYLE_GUIDE.md` §9 and §17.9): the batch sheet (`src/components/BatchSheet.tsx`, its `.stepper` group *How many issues*) and the finish sheet's year stepper (`src/components/FinishDate.tsx`, `.stepper`) are drawn from `--raise` today; they move to `--sunk`, as `src/components/Stepper.tsx` (Settings) already is. The `.stepper` rules are in `src/app/globals.css`.
- Design: `design/mockups.html` §§ `status` (books *Listen next*) and `batch`, and the books finish sheet, redrawn from E8 and E11 (`ui.redrawFiles`; `design/mockups-index.md` lists them as 6.24's). `settings`' stepper is TASK-146's frame.
- Rules: hard rule 6 (tokens only; only *Remove* and *Drop* may be red, and the review chose grey here). UX floor: `docs/04-design.md` § 10. The UX floor. Decisions: D-177.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves *Remove from Listen next resolves to no --danger colour* and *the batch and finish sheets' stepper buttons resolve to --sunk*, and redraws `status` and `batch`. TASK-143, TASK-145 and TASK-146 prove the rest):
browser test at 360px, light and dark: *Remove from Listen next* resolves to
no `--danger` colour; finishing a book in a series shows one *Now reading*
chip and *+N · Follow…*, and *Keep going?* is in the *Follow…* sheet; the
batch and finish sheets' stepper buttons resolve to `--sunk`; the Library
shows *Owned* and *Sort* as dropdown chips in one row and the genre row, and
nothing scrolls sideways; `design/mockups.html`'s `blist`, `status`,
`finishoffer`, `batch` and `settings` frames are redrawn from the review and
it gains the six 834px frames.
- [ ] AC-2: Given the Listen next row menu open, *Remove from Listen next*'s text and icon resolve to the same computed colours as *Remove from shelf*'s in both themes, and its undo still puts the book back where it was.
- [ ] AC-3: The batch sheet's and the finish sheet's − and + buttons and number resolve to the same background as Settings' stepper (`--sunk`) in both themes, and their text keeps 4.5:1 on it.
- [ ] AC-4: These controls meet the UX floor (`docs/04-design.md` § 10. The UX floor): contrast in both themes, axe reports no new violations, and screenshots at each `ui.viewports` width, light and dark.
- [ ] AC-5: `design/mockups.html` §§ `status` (*Listen next*) and `batch` and the finish sheet are redrawn from E8 and E11, and their `design/mockups-index.md` rows say so.

## Out of scope

- Making the batch and finish sheets' steppers typed and held (`Stepper.tsx`'s behaviour, MR-D18's first half): only their surface changes here; adopting `Stepper` there is a follow-up if the plan finds it isn't already wanted elsewhere.
- Any other menu item's colour.
- The finish toast (TASK-143), the Library (TASK-145), `settings` and the 834px frames (TASK-146).

## Files likely touched

- `src/components/ListenNext.tsx` — the menu item's tone.
- `src/app/globals.css` — `.stepper` on `--sunk` in sheets.
- `src/components/BatchSheet.tsx`, `src/components/FinishDate.tsx` — only if a class must change.
- `design/mockups.html`, `design/mockups-index.md` — `status`, `batch`, the finish sheet.
- `test/e2e/listen-queue.spec.ts`, `test/control-states.test.ts` — AC-1's two clauses, AC-2, AC-3.

## Verification

- Automated: a browser test at 360px, light and dark, reading computed colours (AC-1's two clauses, AC-2, AC-3) with axe; the existing Listen next undo test still passes.
- Manual: the ui-verifier opens Listen next's menu and the batch and finish sheets at 360px → expected: *Remove* grey, steppers on the sunk surface, as E8 and E11.

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
