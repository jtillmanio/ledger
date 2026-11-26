---
id: TASK-138
title: 0.14e Series, author and universe pages are measured
status: Done
depends_on: []
size: S
model: sonnet
autonomy: attended
ui: false
plan_status: approved
planned_at_commit: da316c2
---

# TASK-138 — 0.14e Series, author and universe pages are measured

## Goal

The four books pages 0.14c's guard found unmeasured (the series list, a series' page, an author's page and a universe's page) each have a Lighthouse route and a budget measured from a real run, so a change that makes one heavier is caught on its PR.

## Context

- Roadmap: `docs/05-roadmap.md` § 0.14e Series, author and universe pages are measured (M9 in `docs/06-tasklist.md`, listed beside 0.14c; not a cutover gate). Feature F-04 Fast on a phone. Its **Check:** is AC-1, verbatim.
- *From TASK-114 (0.14c, PR #319):* 0.14c's page guard (`unmeasuredPages` in `test/perf.test.ts`) lists the four as `UNMEASURED`, each with this item as its reason: `/books/series` and `/books/series/[id]` (5.9), `/books/authors/[id]` and `/books/universes/[id]` (5.11).
- *From TASK-161 (5.9c, PR #349):* `/books/series` now opens on *Started* (`?show=all` is All), so the page the tap reaches and the run measures is the Started view (the books nav's *Series* is the tap; the Library no longer links to it), and it runs 2 queries in one wave. Measure the bare `/books/series`, and say in the PR that the budget is that view.
- **How 0.14c did it** (copy it): `scripts/perf/routes.mjs` names each route with a tap from a screen that links to it, and a path resolved at run time (`resolve`) where the id is the owner's data; `scripts/perf/budget.json` holds the ceilings. The taps here: *Series* in the books medium's nav (`src/components/nav/items.ts`), a series row on `/books/series` (`src/components/SeriesList.tsx`), and an author's or a universe's name, which 5.9 links through `src/components/BookPlace.tsx`.
- **Budgets are measured, not guessed**: from a measured run of the branch's preview, plus about 5% (the roadmap entry). D-175 sets how a ceiling is written: the measurement plus 25%, never less than the measurement plus one PR's growth limit, written by `node scripts/perf/report.mjs ceilings <metrics.json> --write` (`ceilingsFrom`). The plan says which of the two this task follows; where the entry's "about 5%" and D-175 disagree, that is a question for the owner at the plan gate, not a guess.
- **The measured run.** Nothing here turns `LIGHTHOUSE_MODE` on (D-158). If the switch is off when the PR is open, the run is a hand run, which the ready gate *Lighthouse green* (`.claude/kit.json`) says only the owner asks for: the task stops and asks the owner for it, then writes the budgets from its metrics.
- Decisions: D-142, D-158, D-175. Docs: `docs/02-architecture.md` § 7 (performance budget).

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim): `scripts/perf/routes.mjs` and `scripts/perf/budget.json` have a route
for each of `/books/series`, a series' page, an author's page and a universe's
page, each with a tap from a screen that links to it and a budget from a
measured run of the branch's preview (automatic or by hand); the four are
gone from `UNMEASURED` in `test/perf.test.ts`, which still passes on the real
`src/app`, and the PR's Lighthouse comment shows a tap time for each.
- [x] AC-2: Given the four routes, each route's path for a series, author and universe page resolves at run time from the preview's data (no id written into `routes.mjs`), and `test/perf.test.ts`'s route checks pass for each (a tap target named, a budget present for each metric the other routes carry).
- [x] AC-3: `UNMEASURED` in `test/perf.test.ts` holds exactly the two intercept sheets (`/@modal/(.)book/[id]`, `/@modal/(.)comics/[runId]/issue/[issueId]`) after the change, and the page guard still fails on a fixture page that is in neither list.
- [x] AC-4: The PR's *How it was verified* names the run the budgets came from (its id or link) and shows each new ceiling beside its measurement.

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

- `shelf` fails as not measured on every preview (live has no shelf, so the preview's Neon branch has none), which turns hand run 45773843077 red → not tracked: already tracked in docs/OWNER-CHECKLIST.md § Actions from follow-ups (make a books shelf on live, from TASK-114 and TASK-133)
- The architecture's Performance budget still called `/books/universes` and the issue page unmeasured; run 45773843077 measured both under their copied ceilings → docs/02-architecture.md § Performance budget (fixed in this PR, approved at close-out)
- The copied ceilings of `universes` and `issue` sit well above their measurements (the issue page's own JS 5,517 against 28,900) → not tracked: rewriting a ceiling is out of scope here (D-175); the growth check (D-142) gates them once main has a run that measured them
- An author's page made 66 requests to other origins (book covers) → not tracked: requests to other origins aren't budgeted (D-142), and the page is under every ceiling

## Plan

Approved by the owner, 2026-11-25 ("approve and recommended rule"): the ceilings follow D-175, not the roadmap entry's "about 5%".

**Steps.**

1. **Tests first** (`test/perf.test.ts`). A new test in "the route list": the four routes, each with its path, a tap that starts on another page and clicks a link (`a[href`), and, for the three whose ids are the owner's data, a `resolve` whose `from` and selector the tap shares (no id written into `routes.mjs`; AC-2). A new assertion that `UNMEASURED`'s keys are exactly `/@modal/(.)book/[id]` and `/@modal/(.)comics/[runId]/issue/[issueId]` (AC-3); the existing fixture tests keep proving the guard fails on a page in neither list. Then the four `UNMEASURED` entries go.
2. **Four routes** in `scripts/perf/routes.mjs`:
   - `series`: `/books/series`, the bare path (the Started view, 5.9c), tapped from `/books` on the books nav's `a[href="/books/series"]`, as `releases` and `shelves` are.
   - `series-page`: `/books/series/[id]`, resolved and tapped from `/books/series` on `.series-row a[href^="/books/series/"]` (a `SeriesList` row, a `<Link>`).
   - `author`: `/books/authors/[id]`, resolved and tapped from `/books/top` on `.qplace a[href^="/books/authors/"]` (Top's place line, `subParts`, `BookPlace` as `<Link>`). Not from the Library: its place links are bare `<a>`s and `SheetLinks` softens only `.row-title` anchors, so the click is a full load, which `clientTap`'s in-page timing can't survive.
   - `universe`: `/books/universes/[id]`, resolved and tapped from `/books/universes` on `.series-row a[href^="/books/universes/"]` (a `UniversesList` row, a `<Link>`).
3. **First push: budgets await the run, as 0.14c's did.** The four ids go into `budget.json` with `null` numbers; the test allows `null` only for ids in a temporary `AWAITING_MEASUREMENT` (naming 0.14e). The report already lists such a route as measured but not gated. `docs/02-architecture.md` § Performance budget gains four rows (`–` until measured), and its "Unmeasured … which roadmap 0.14e measures" sentence becomes how the four are reached.
4. **The measured run.** `LIGHTHOUSE_MODE` is off (D-158): once CI is green, the task stops and asks the owner for a hand run; Claude dispatches one only if the owner says to.
5. **Budgets from the run, by D-175.** `node scripts/perf/report.mjs ceilings <metrics.json>` printed, not `--write` (that rewrites every route's ceiling and the shared JS, which is out of scope); the four new ids' ceilings are copied into `budget.json` and the doc table, `AWAITING_MEASUREMENT` goes, and the PR body names the run and shows each measurement → ceiling (AC-4).

**Files.**

- `scripts/perf/routes.mjs`: the four routes.
- `scripts/perf/budget.json`: the four ids (null, then measured).
- `test/perf.test.ts`: the route test, the `UNMEASURED` assertion, the temporary allowance.
- `docs/02-architecture.md` § Performance budget: four rows and the sentence (not in Files likely touched: its table is held to `budget.json` row for row by a test).

**Test strategy.** AC-1, AC-2: `test/perf.test.ts` › "the route list" › the new 0.14e test, "measures every page in src/app …", "matches budget.json one for one", "holds a number for everything it gates" and the architecture mirror. AC-3: the `UNMEASURED` assertion and "the page guard" fixtures. AC-1's tap times and AC-4: by hand, against the hand run's Lighthouse comment and the PR body.

**Risks.** A preview with no started series or universe fails that route as not measured (as the shelf did on 0.14c): the owner's call. The hand run also measures `universes` and `issue`, whose ceilings were copied, not measured; rewriting them is out of scope, so one that measures over is a follow-up.

**Size.** 4 files, no schema, no UI. Not split.

## Review log

Verify R1 PASS (tsc, lint; 3 vitest timeouts under load, all pass alone) | CI R1 PASS | Spec R1 APPROVE (before measurement) | Audit R1 PASS | Lighthouse hand run 45773772516: no preview for docs-only head 0bdd370, measured nothing → 45773843077 on c1b66ab's preview: the four measured, `shelf` not measured (owner checklist) | Verify R2 PASS | Spec R2 APPROVE | Audit R2 PASS | Lighthouse hand run 45775859334 on 52c93df, for the PR comment (owner, at close-out)

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 2
- Review rounds: 2
- First-pass AC FAILs: 0
- Plan revisions after approval: 0
