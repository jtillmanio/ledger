---
id: TASK-161
title: 5.9c The Series list opens on what you've started
status: Ready
depends_on: []
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-161 — 5.9c The Series list opens on what you've started

## Goal

The Series page opens on the series the owner has started or follows, with *All* a tap away, and the Library no longer repeats a link to it.

## Context

- Roadmap: `docs/05-roadmap.md` § 5.9c The Series list opens on what you've started (M17 in `docs/06-tasklist.md`). Feature F-38. Its **Check:** is AC-1, verbatim; proposed in PR #342 and agreed when it merged (2026-11-25).
- Owner intake, 2026-11-24 (*do we need to load the whole series list, or just ones started and finished?*) and 2026-11-25 (*the Library's series line goes*).
- **What exists.** `src/app/books/series/page.tsx` reads `seriesList` (`src/db/queries.ts`, `series_progress` where `books_listed > 0`) and draws `src/components/SeriesList.tsx`. The Library's foot is `<p className="list-series-line">` with *All series →* in `src/app/books/list/page.tsx` (task 5.9, TASK-125). The status and Progress pages draw chips as real links (`src/app/progress/page.tsx`'s `prog-chips`).
- **Started** means a book read, in hand (Reading, Listening) or DNF, or a series follow of Tracking or Reading; the cut is in SQL, so the default reads fewer rows. *Started* · *All* are real links (`?show=all`), each with its count.
- **Budget.** `/books/series` and `/books/list` are in `scripts/perf/budget.json` (0.14e gives the series page its route).
- Design: `design/mockups.html` § `series` and `blist`; both redrawn (`ui.redrawFiles`). Rules: `.claude/rules/ui.md`. UX floor: `docs/04-design.md` § 10. The UX floor. Decisions: D-26, D-90.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim):
with the test database, three series: one with a read book, one followed
Tracking with none read, and one with only To-read books. `/books/series`
lists the first two and not the third, *All* lists all three, and each
chip shows its count. The Library has no *All series* link, and the nav's
*Series* opens the page. Screenshots at 360px and 1280px; axe passes.
- [ ] AC-2: Given `?show=` with any other value, the page shows *Started*; a reload and Back keep the chip.
- [ ] AC-3: Given no started series, *Started* draws an empty state naming *All* (with its count), never a blank page.
- [ ] AC-4: The page meets the UX floor (`docs/04-design.md` § 10. The UX floor): chips are links with `aria-current` on the open one, 44 px targets at phone widths, contrast in both themes, and screenshots at each `ui.viewports` width, light and dark; both routes stay within their budgets.

## Out of scope

- The Universes list (TASK-162).
- Changing a series' own page or its row.

## Files likely touched

- `src/db/queries.ts` — `seriesList` takes the cut.
- `src/app/books/series/page.tsx` — reads `?show=`.
- `src/components/SeriesList.tsx` — the chip row and the empty state.
- `src/app/books/list/page.tsx`, `src/app/globals.css` — the foot line and its style go.
- `design/mockups.html`, `design/mockups-index.md` — `series` and `blist`.
- `test/series-list.test.tsx`, `test/e2e/series.spec.ts` — AC-1 to AC-4.

## Verification

- Automated: `test/series-list.test.tsx` (the cut, the chips, the empty state) on the test database; `test/e2e/series.spec.ts` with axe at 360px and 1280px.
- Manual: `npm run dev`, Series → *All* → Back → expected: *Started* again, and the Library's foot has no *All series* link.

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
