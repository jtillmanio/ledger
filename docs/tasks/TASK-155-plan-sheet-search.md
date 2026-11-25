---
id: TASK-155
title: 2.10c Suggestions keep series order, and the sheet can search (2 of 2) — search on the plan sheet
status: Ready
depends_on: [TASK-154]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-155 — 2.10c Suggestions keep series order, and the sheet can search (2 of 2) — search on the plan sheet

## Goal

The plan sheet has a search field, so any book on the owner's list can be found and placed in the year or quarter being planned.

## Context

- Roadmap: `docs/05-roadmap.md` § 2.10c (M11). Feature F-65. Its **Check:** is AC-1, verbatim; proposed in PR #342 and agreed when it merged (2026-11-25).
- **Split, 2 of 2.** TASK-154 fixes the suggestions' order.
- **What exists.** The sheet is `src/components/PlanSheet.tsx` (task 2.10b), reading `GET /api/plan/suggestions`; placing a suggestion is `POST /api/plan` or `POST /api/books`, with its undo. The Library's search as you type is 1.22's (`src/lib/use-search.ts`, `src/components/BookSearch.tsx`, the list's `?q=`), which matches title or author across your books. `POST /api/books/search` is Add books' Hardcover search and isn't the source here. Each row draws its place line through `BookPlace` (2.2l, 5.9b).
- **What it lists.** What the Library's search finds, less read and DNF books and those already planned in the target; an Unlisted or Parked book's placement moves it to To read (1.21, 5.15), as a suggestion's does. The plan says whether that is a new read in `src/db/queries.ts` behind a route or a parameter on an existing one.
- **Budget.** `/books/plan` is in `scripts/perf/budget.json`; the sheet's JS stays within it.
- Design: `design/mockups.html` § `plan` (the planning sheet); the frame gains the field (`ui.redrawFiles`). Rules: `.claude/rules/ui.md`. UX floor: `docs/04-design.md` § 10. The UX floor. Decisions: D-104, D-108, D-134.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves the search, the screenshots and axe, TASK-154 the suggestion clauses):
with
the test database: a series with books 1–4, none followed, all To read, each
50k words, and 200k of room left: the sheet for 2027 Q2 suggests book 1 under
*Fits the room left* and never books 2–4 in any group; with book 1 read it
suggests book 2 and not 3–4; with book 1 Reading, book 2; book 3 put On deck is
listed under *On deck*. An author followed Reading lists only the first unread
book of each of the author's series under *More from*. Typing two letters of a
title in the sheet's search lists that book with its place line and no read
book; *Put in Q2* on it writes one `reading_plan` row and Undo removes it.
Screenshots at 360px and 1280px; axe passes.
- [ ] AC-2: Given the sheet opens, the search field is its first control and has focus only when the owner moves to it (the sheet's focus rule is unchanged); typing filters as you type, Esc clears it, and an empty field shows the groups again.
- [ ] AC-3: Given a search matching an Unlisted book, placing it writes `to_read` and its plan row in one transaction, and Undo restores `unlisted` and removes the row.
- [ ] AC-4: Given a search with no match, the sheet says so in one line and keeps the groups below.
- [ ] AC-5: The sheet meets the UX floor (`docs/04-design.md` § 10. The UX floor): the field is labelled, results are real controls with names, 44 px targets at phone widths, contrast in both themes, and screenshots at each `ui.viewports` width, light and dark; `/books/plan` stays within its budget.

## Out of scope

- Searching Hardcover from the plan sheet (Add books does that).
- Changing the suggestion groups (TASK-154).

## Files likely touched

- `src/components/PlanSheet.tsx` — the field and its results.
- `src/db/queries.ts` — a plan-search read, if the plan needs one.
- `src/app/api/plan/suggestions/route.ts` or a new `src/app/api/plan/search/route.ts` — the search's answer.
- `src/app/globals.css` — tokens only.
- `design/mockups.html`, `design/mockups-index.md` — `plan` gains the field.
- `test/e2e/plan-sheet.spec.ts` — AC-1's search clauses, AC-2 to AC-5.

## Verification

- Automated: `test/e2e/plan-sheet.spec.ts` with axe at 360px and 1280px, light and dark; a route test if a route is added.
- Manual: `npm run dev`, Plan → *Plan this quarter* → type part of a title → *Put in* → expected: the book is in the quarter, Undo takes it out.

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
