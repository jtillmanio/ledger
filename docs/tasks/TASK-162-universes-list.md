---
id: TASK-162
title: 5.11b Universes: every universe in one list
status: Ready
depends_on: [TASK-161]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-162 — 5.11b Universes: every universe in one list

## Goal

Every universe the owner has books in is listed on one page, reached from a *Universes* tab on the Series page, each row showing how far through it they are.

## Context

- Roadmap: `docs/05-roadmap.md` § 5.11b Universes: every universe in one list (M17 in `docs/06-tasklist.md`). Feature F-20. Its **Check:** is AC-1, verbatim; proposed in PR #342 and agreed when it merged (2026-11-25).
- Owner intake, 2026-11-24 (*where are universes?*) and 2026-11-25 (*yes, let's build the universe list*). Depends on 5.9c (TASK-161), whose *Started* · *All* chips it copies.
- **What exists.** A universe's page is `src/app/books/universes/[id]/page.tsx` (task 5.11; `universePage`, `GroupingBooks`); there is no `src/app/books/universes/page.tsx`. `universe_progress` (`etl/views.sql`) has `read`, `total`, `follow_state`. The Series list's rows (`src/components/SeriesList.tsx`) are the pattern; `src/components/Tablist.tsx` is the tab strip the status screens and Progress share (each tab a link, its count in mono).
- **No nav item.** The tab row *Series* · *Universes* on both pages reaches it; the books nav stays as it is (6.25 is fitting the rails to five media).
- **Perf.** The new route gets a tap and a budget in `scripts/perf/routes.mjs` and `budget.json`, from a measured run, as 0.14e's pages do (`test/perf.test.ts`'s guard otherwise lists it as unmeasured).
- Design: `design/mockups.html` gains a `universes` frame (and `series` the tab row) before it is built (`ui.redrawFiles`). Rules: `.claude/rules/ui.md` (meters fill with `--ready`). UX floor: `docs/04-design.md` § 10. The UX floor. Decisions: D-42, D-43, D-90, D-118.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim):
with the test database, three universes: one with a read book, one followed
with none read, and one with only To-read books. `/books/universes` lists
the first two, *All* adds the third, and each row links to
`/books/universes/<id>` with `read / total` equal to `universe_progress`'s.
The Series page's *Universes* tab opens it and carries `aria-current`
there. `scripts/perf/routes.mjs` and `budget.json` have a route for it.
Screenshots at 360px and 1280px; axe passes.
- [ ] AC-2: Given a universe followed Tracking and part-read, its row says *On hold* (D-118), as its page does.
- [ ] AC-3: Given no universes, the page draws an empty state saying where universes come from (Calibre's `#superseries`).
- [ ] AC-4: The page meets the UX floor (`docs/04-design.md` § 10. The UX floor): states drawn (empty, loading, error), meters fill with `--ready`, the tabs are links with names and counts, 44 px targets at phone widths, contrast in both themes, and screenshots at each `ui.viewports` width, light and dark.

## Out of scope

- A books nav item for Universes.
- Changing a universe's own page (5.11).

## Files likely touched

- `src/db/queries.ts` — `universesList`.
- `src/app/books/universes/page.tsx`, `loading.tsx`, `error.tsx` — new.
- `src/components/UniversesList.tsx` — new, after `SeriesList`.
- `src/app/books/series/page.tsx`, `src/components/SeriesList.tsx` — the tab row.
- `scripts/perf/routes.mjs`, `scripts/perf/budget.json` — the route and its budget.
- `design/mockups.html`, `design/mockups-index.md` — `universes` and the tab row.
- `test/universes-list.test.tsx`, `test/e2e/universes.spec.ts` — new: AC-1 to AC-4.

## Verification

- Automated: `test/universes-list.test.tsx` on the test database; `test/e2e/universes.spec.ts` with axe at 360px and 1280px; `test/perf.test.ts` still passes.
- Manual: `npm run dev`, Series → *Universes* → a row → expected: the universe's page; Back keeps the tab.

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
