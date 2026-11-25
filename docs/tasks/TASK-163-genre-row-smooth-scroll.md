---
id: TASK-163
title: 6.26 The Library's genre row scrolls smoothly, with arrows you can hold
status: Ready
depends_on: [TASK-145]
size: S
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-163 — 6.26 The Library's genre row scrolls smoothly, with arrows you can hold

## Goal

On a tablet or desktop, the Library's genre chips scroll smoothly with arrow buttons that keep scrolling while held, with no browser scrollbar.

## Context

- Roadmap: `docs/05-roadmap.md` § 6.26 The Library's genre row scrolls smoothly, with arrows you can hold (M21 in `docs/06-tasklist.md`). Feature F-44. Its **Check:** is AC-1, verbatim; proposed in PR #342 and agreed when it merged (2026-11-25).
- Owner intake, 2026-11-24 and 2026-11-25 (*it's choppy; if I hold down on the arrow it should scroll smoothly*).
- **What exists.** The genre row is a `<div className="filters genre-row">` of links in `src/app/books/list/page.tsx` (task 4.5, D-98); `.genre-row` in `src/app/globals.css` scrolls with `overflow-x:auto` and draws the browser's scrollbar, whose Windows arrows step. `.tabrow` and `.shelf` hide theirs (`scrollbar-width:none`). The press-and-hold pattern is `src/components/Stepper.tsx` (2.0b, D-123: a hold repeats, faster after its first second, stops on release).
- **After TASK-145** (6.24, 3 of 4), which redraws the Library's phone filters (dropdown chips, the genre row below). This task keeps the phone's swipe and adds arrows only at 768px and up.
- **Budget.** The arrows are client JS on `/books/list` (`scripts/perf/budget.json`); the plan states the bytes.
- Design: `design/mockups.html` § `blist` (desktop frame gains the arrows; `ui.redrawFiles`). Rules: `.claude/rules/ui.md` (genre chips grey with text). UX floor: `docs/04-design.md` § 10. The UX floor. Decisions: D-98, D-123.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim):
in
the browser (0.11) at 1280px, with more genres than fit: no native
scrollbar is drawn and there is no left arrow at the start; a tap on the
right arrow moves `scrollLeft` by about the row's width over several
frames; holding it for a second moves it further than a tap and it stops on
release; at the end the right arrow goes. At 360px there are no arrows and
the row still scrolls by touch. Under reduced motion a tap moves in one
frame. Axe passes, and `/books/list` stays within its budget.
- [ ] AC-2: Given the row fits without scrolling, no arrow is drawn.
- [ ] AC-3: Given keyboard focus on an arrow, Enter or Space scrolls one step; tabbing through the chips scrolls each into view.
- [ ] AC-4: The row meets the UX floor (`docs/04-design.md` § 10. The UX floor): arrows named, contrast 3:1 for the icon in both themes, reduced motion honoured, and screenshots at each `ui.viewports` width, light and dark.

## Out of scope

- The phone's filter layout (TASK-145).
- Arrows on any other chip row.

## Files likely touched

- `src/components/GenreRow.tsx` — new: the row, its arrows and the hold.
- `src/app/books/list/page.tsx` — draws `GenreRow`.
- `src/app/globals.css` — no native scrollbar; the arrows, tokens only.
- `design/mockups.html`, `design/mockups-index.md` — `blist` at desktop.
- `test/e2e/library-genres.spec.ts` — AC-1 to AC-4.

## Verification

- Automated: `test/e2e/library-genres.spec.ts` at 360px and 1280px, light and dark, with reduced motion emulated for its clause; axe.
- Manual: `npm run dev` at 1280px with many genres → hold the right arrow → expected: a steady smooth scroll that stops on release.

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
