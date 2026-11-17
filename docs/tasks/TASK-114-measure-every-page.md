---
id: TASK-114
title: 0.14c Every page is measured
status: Draft
depends_on: [TASK-113]
size: M
model: opus
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
---

# TASK-114 — 0.14c Every page is measured

## Goal

When `LIGHTHOUSE_MODE` goes back on, every page in the app is measured against its own budget, including the three drawn while Lighthouse was off. A new page at any depth that nobody adds a route for fails a test instead of going unmeasured.

## Context

- Roadmap: `docs/05-roadmap.md` § 0.14c (its **Check** is AC-1, verbatim). Listed in `docs/06-tasklist.md` M9 beside 0.14b; not a cutover gate.
- Decisions: **D-158** (the switch; a hand run always measures; Claude never turns `LIGHTHOUSE_MODE` on or dispatches a run unasked), **D-160** (one Lighthouse load and one tap run per route; `_rsc=` blocked during the load).
- **This task finishes only with `LIGHTHOUSE_MODE` on** (owner, 2026-11-17). The budgets come from the branch's preview measured automatically with the switch on, not from a hand run and not copied from a sibling route. It depends on 0.14b (TASK-113) because that is what lets the switch go back on. The routes, the guard and the test can be built before then; the PR waits for the run.
- What gets measured: `scripts/perf/routes.mjs` (`ROUTES`: `id`, `path`, `signedIn`, `tap: { from, selector }`), read by `.github/workflows/lighthouse.yml` and `scripts/perf/measure.mjs`; `scripts/perf/budget.json` holds one budget per id (`docRscBytes`, `jsBytes`, `requests`, `a11y`), mirrored in `docs/02-architecture.md` § Performance budget.
- Why eight pages were missed: `test/perf.test.ts` § "the route list" › "has a route for every top-level screen" only looks at `src/app/<segment>/`. `/books` is measured, so everything under it passes. `src/app/book/` holds only `[id]/`, so it isn't seen at all.
- The pages with no route, and the tap that reaches each today:
  - since the pause: `/books/shelves` and a shelf's page `/books/shelves/[id]` (task 5.1; `ShelfList.tsx` links each shelf), `/books/releases` (task 5.7, Coming out; the books medium's nav item)
  - before it: `/books/add` (nav *Add*; the releases empty slate), `/books/top` (task 3.4; nav), a book's page `/book/[id]` (rows open it through the `@modal/(.)book/[id]` intercept, so a tap measures the sheet while a direct load measures the full page), a run's *Add* `/comics/[runId]/add` (`IssueRow.tsx`, `ThumbBar.tsx`), `/settings/calibre` (`settings/page.tsx`'s *Calibre* row, `CalibreSyncLine.tsx`)
- **For the plan gate: paths that need a stable target.** `routes.mjs` loads a hand-authored slug that a preview's Neon branch (copied from live) always has. Runs have one; shelves and books have serial ids that live may or may not hold. Say which shelf and which book each route loads, and whether `measure.mjs` resolves the path at run time from the tap (the first shelf on `/books/shelves`, say), with what happens when live has no shelf.
- **For the plan gate: a book's page.** Measure the full page by direct load, the modal sheet by tap, or both as two ids. Say which and why.
- **For the plan gate: the exemption list.** The new guard covers every `page.tsx` at any depth. `@modal` intercepts and anything else not measured go in an explicit list in the test, each with a one-line reason. Say what is on it.
- `docs/COMMANDS.md` lines 27–31: how the switch and a hand run are set (the owner runs these).

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): `scripts/perf/routes.mjs` and `scripts/perf/budget.json` have a route for each of `/books/releases`, `/books/shelves`, a shelf's page, `/books/add`, `/books/top`, a book's page, a run's *Add* and `/settings/calibre`, each with a tap from a screen that links to it, and each budget comes from a measured run of the branch's preview with `LIGHTHOUSE_MODE` on, not copied from another route. `test/perf.test.ts` fails when any `page.tsx` under `src/app/`, at any depth, is neither measured by a route nor listed as unmeasured with a reason. Nothing in this entry turns `LIGHTHOUSE_MODE` on.
- [ ] AC-2: Given a fixture `app/` tree with `books/page.tsx` measured and `books/new-thing/page.tsx` not, the guard reports `/books/new-thing`. Given the same page in the exemption list with a reason, it reports nothing. An exemption with an empty reason, or one naming a page that no longer exists, also fails. The guard is a pure function run on fixtures, and the real `src/app` passes it.
- [ ] AC-3: Every new route id has a `budget.json` entry and a row in `docs/02-architecture.md` § Performance budget with the same four numbers. The PR's Lighthouse comment from the automatic run with `LIGHTHOUSE_MODE` on lists every new id, and each budget is that run's measurement plus about 5% (§ Performance budget's rule), written in the PR body as measured → budget per id.
- [ ] AC-4: Each new route's tap, run from its `from` screen, reaches the route's page (the tap run in the PR's Lighthouse comment shows a time for every new id, none `did not finish`). A route whose path is resolved at run time logs the path it chose.

## Out of scope

- Turning `LIGHTHOUSE_MODE` on, or dispatching a hand run. The owner does both (D-158).
- Re-measuring or raising the budgets of routes already in `budget.json`: 0.13.
- Debouncing and capping automatic runs: 0.14b (TASK-113).
- Making any of the eight pages smaller or faster. A page over a reasonable budget is a follow-up to the task that drew it, not a fix here.
- The query budget (`test/query-budget.test.ts`). It already covers these pages.

## Files likely touched

- `scripts/perf/routes.mjs`: the eight routes and their taps
- `scripts/perf/budget.json`: their budgets, from the measured run
- `test/perf.test.ts`: the any-depth guard, its fixtures, the exemption list
- `scripts/perf/lib/perf.mjs` (+ `perf.d.mts`): the guard as a pure function, if it lives there
- `scripts/perf/measure.mjs`: only if a path is resolved at run time
- `docs/02-architecture.md` § Performance budget: the new budget rows

## Verification

- Automated: `test/perf.test.ts`: the guard on fixtures (unmeasured nested page reported; exempted page with a reason passes; empty reason or stale exemption fails), the real tree passes, `budget.json` matches `routes.mjs` one for one. `npm run test:no-e2e` green.
- Manual (owner, after 0.14b and with `LIGHTHOUSE_MODE` on): push the branch, let the preview deploy → expected: the automatic Lighthouse run comments on the PR with every new id measured and its tap timed; the budgets in the PR body match that comment plus headroom.

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
