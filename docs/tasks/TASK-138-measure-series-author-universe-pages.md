---
id: TASK-138
title: 0.14e Series, author and universe pages are measured
status: Draft
depends_on: []
size: S
model: sonnet
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
---

# TASK-138 — 0.14e Series, author and universe pages are measured

## Goal

The four books pages 0.14c's guard found unmeasured (the series list, a series' page, an author's page and a universe's page) each have a Lighthouse route and a budget measured from a real run, so a change that makes one heavier is caught on its PR.

## Context

- Roadmap: `docs/05-roadmap.md` § 0.14e Series, author and universe pages are measured (M9 in `docs/06-tasklist.md`, listed beside 0.14c; not a cutover gate). Feature F-04 Fast on a phone. Its **Check:** is AC-1, verbatim.
- *From TASK-114 (0.14c, PR #319):* 0.14c's page guard (`unmeasuredPages` in `test/perf.test.ts`) lists the four as `UNMEASURED`, each with this item as its reason: `/books/series` and `/books/series/[id]` (5.9), `/books/authors/[id]` and `/books/universes/[id]` (5.11).
- **How 0.14c did it** (copy it): `scripts/perf/routes.mjs` names each route with a tap from a screen that links to it, and a path resolved at run time (`resolve`) where the id is the owner's data; `scripts/perf/budget.json` holds the ceilings. The taps here: *Series* in the books medium's nav (`src/components/nav/items.ts`), a series row on `/books/series` (`src/components/SeriesList.tsx`), and an author's or a universe's name, which 5.9 links through `src/components/BookPlace.tsx`.
- **Budgets are measured, not guessed**: from a measured run of the branch's preview, plus about 5% (the roadmap entry). D-175 sets how a ceiling is written: the measurement plus 25%, never less than the measurement plus one PR's growth limit, written by `node scripts/perf/report.mjs ceilings <metrics.json> --write` (`ceilingsFrom`). The plan says which of the two this task follows; where the entry's "about 5%" and D-175 disagree, that is a question for the owner at the plan gate, not a guess.
- **The measured run.** Nothing here turns `LIGHTHOUSE_MODE` on (D-158). If the switch is off when the PR is open, the run is a hand run, which the ready gate *Lighthouse green* (`.claude/kit.json`) says only the owner asks for: the task stops and asks the owner for it, then writes the budgets from its metrics.
- Decisions: D-142, D-158, D-175. Docs: `docs/02-architecture.md` § 7 (performance budget).

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): `scripts/perf/routes.mjs` and `scripts/perf/budget.json` have a route
for each of `/books/series`, a series' page, an author's page and a universe's
page, each with a tap from a screen that links to it and a budget from a
measured run of the branch's preview (automatic or by hand); the four are
gone from `UNMEASURED` in `test/perf.test.ts`, which still passes on the real
`src/app`, and the PR's Lighthouse comment shows a tap time for each.
- [ ] AC-2: Given the four routes, each route's path for a series, author and universe page resolves at run time from the preview's data (no id written into `routes.mjs`), and `test/perf.test.ts`'s route checks pass for each (a tap target named, a budget present for each metric the other routes carry).
- [ ] AC-3: `UNMEASURED` in `test/perf.test.ts` holds exactly the two intercept sheets (`/@modal/(.)book/[id]`, `/@modal/(.)comics/[runId]/issue/[issueId]`) after the change, and the page guard still fails on a fixture page that is in neither list.
- [ ] AC-4: The PR's *How it was verified* names the run the budgets came from (its id or link) and shows each new ceiling beside its measurement.

## Out of scope

- Turning `LIGHTHOUSE_MODE` on, or dispatching a Lighthouse run without the owner asking.
- Changing any existing route's budget, or the ceiling rule itself (D-175).
- Making any of the four pages lighter: if one measures heavy, that is a follow-up.
- The intercept sheets in `UNMEASURED`: they stay as they are.

## Files likely touched

- `scripts/perf/routes.mjs` — four routes, with their taps and `resolve` paths.
- `scripts/perf/budget.json` — four budgets from the measured run.
- `test/perf.test.ts` — the four `UNMEASURED` entries removed.

## Verification

- Automated: `test/perf.test.ts` passes on the real `src/app` (the page guard and the route checks).
- Manual: the PR's Lighthouse comment → expected: a tap time and every metric for `/books/series`, a series' page, an author's page and a universe's page, each under its ceiling.

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
