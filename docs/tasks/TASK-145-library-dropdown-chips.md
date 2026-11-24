---
id: TASK-145
title: 6.24 Built screens follow the mediums review (3 of 4) — the Library's dropdown chips
status: Draft
depends_on: []
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-145 — 6.24 Built screens follow the mediums review (3 of 4) — the Library's dropdown chips

## Goal

On the phone, the Library's *Owned* and *Sort* controls fit on one row as dropdown chips, with the genre row below, so the filters take less height and nothing scrolls sideways.

## Context

- Roadmap: `docs/05-roadmap.md` § 6.24 Built screens follow the mediums review (M21). Feature F-44. Its **Check:** is AC-1, verbatim; proposed, and agreed when merged.
- **Split, 3 of 4.** TASK-143 does the finish toast, TASK-144 grey *Remove* and the steppers, TASK-146 the remaining mockup frames and ticks 6.24.
- **The departure** (MR-D20, frame E7 in `design/MR-E-Review-2.dc.html`; `design/STYLE_GUIDE.md` §17.8–§17.9): Library at the phone puts *Owned* and *Sort* in dropdown chips on one row, and draws the genre row.
- **What exists.** `src/app/books/list/page.tsx` draws the Library: the status chips (*Everything* …), `BookSort` (`src/components/BookSort.tsx`, `src/lib/library-sort.ts`'s `parseSort`, `libraryHref`), the *Owned* chips (links, each carrying `aria-current`, task 4.9), and the genre chip row (task 4.5, D-98, `genreChipHref`). Every filter is a link in the URL, so a reload keeps it; keep that. A menu exists to copy: `src/components/Menu.tsx` (the row `⋯` menus).
- **Width.** Which widths get the dropdowns is the frame's: E7 is the phone; the plan says what 768px and up draw (the frames held `blist`'s wider layout, §17.8).
- **Budget.** `/books/list` is in `scripts/perf/budget.json` (0.14c). A dropdown that needs client code adds JS to the route; the plan says how it stays within its ceiling (a `<details>` disclosure of links needs none).
- Design: `design/mockups.html` § `blist` (phone), redrawn from E7 (`ui.redrawFiles`; `design/mockups-index.md` lists it as 6.24's).
- Rules: `.claude/rules/ui.md` (hue never names navigation; genre chips grey with text). UX floor: `docs/04-design.md` § 10. The UX floor. Decisions: D-98, D-177.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves *the Library shows Owned and Sort as dropdown chips in one row and the genre row, and nothing scrolls sideways*, and redraws `blist`. TASK-143, TASK-144 and TASK-146 prove the rest):
browser test at 360px, light and dark: *Remove from Listen next* resolves to
no `--danger` colour; finishing a book in a series shows one *Now reading*
chip and *+N · Follow…*, and *Keep going?* is in the *Follow…* sheet; the
batch and finish sheets' stepper buttons resolve to `--sunk`; the Library
shows *Owned* and *Sort* as dropdown chips in one row and the genre row, and
nothing scrolls sideways; `design/mockups.html`'s `blist`, `status`,
`finishoffer`, `batch` and `settings` frames are redrawn from the review and
it gains the six 834px frames.
- [ ] AC-2: At 360px, the *Owned* and *Sort* chips' boxes share one top edge, each chip names its current choice (*Owned: Any*, *Sort: Title* or the frame's words), and `document.documentElement.scrollWidth` equals the viewport width.
- [ ] AC-3: Given the *Owned* chip, when it is opened and *Owned* is chosen, then the URL carries the owned filter and the list shows exactly the owned books, as the chips did; the same for each sort and direction, and a reload keeps both.
- [ ] AC-4: Each dropdown opens and closes by keyboard (Enter or Space opens, Esc closes and returns focus to its chip), its choices are reachable by Tab or arrows, and the current choice is marked for assistive tech (`aria-current` or `aria-checked`).
- [ ] AC-5: The Library's filters meet the UX floor (`docs/04-design.md` § 10. The UX floor): every chip at least 44px tall, text 4.5:1 in both themes, no hue on a chip, axe reports no new violations, and screenshots at each `ui.viewports` width, light and dark; `/books/list` stays within its byte budget.

## Out of scope

- What the filters do: the owned, sort and genre rules are 4.9's, 1.15's and 4.5's, unchanged.
- The status chips row (*Everything* …) and search.
- The finish toast (TASK-143), grey *Remove* and the steppers (TASK-144), the other frames (TASK-146).

## Files likely touched

- `src/app/books/list/page.tsx` — the one row.
- `src/components/BookSort.tsx` — *Sort* as a dropdown chip.
- a new `src/components/ChipMenu.tsx` (or the page inline) — *Owned* as a dropdown chip; the *Owned* chips are inline links in `page.tsx` today.
- `src/app/globals.css` — tokens only.
- `design/mockups.html`, `design/mockups-index.md` — `blist`.
- `test/library-page.test.tsx`, `test/e2e/library-owned.spec.ts`, `test/e2e/library-sort.spec.ts`, `test/e2e/library-genres.spec.ts` — AC-1's clause, AC-2 to AC-5.

## Verification

- Automated: `test/e2e/library-owned.spec.ts` and `test/e2e/library-sort.spec.ts` rewritten to the dropdowns (AC-3, AC-4); a 360px layout test for AC-2 and the genre row; axe at each width.
- Manual: the ui-verifier opens `/books/list` at 360px, 768px and 1280px, light and dark → expected: E7's one row at the phone, the plan's layout wider, every filter still works.

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
