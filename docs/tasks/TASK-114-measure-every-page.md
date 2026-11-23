---
id: TASK-114
title: 0.14c Every page is measured
status: In progress
depends_on: [TASK-113]
size: M
model: opus
autonomy: attended
ui: false
plan_status: approved
planned_at_commit: fb78257
---

# TASK-114 — 0.14c Every page is measured

## Goal

When `LIGHTHOUSE_MODE` goes back on, every page in the app is measured against its own budget, including the three drawn while Lighthouse was off. A new page at any depth that nobody adds a route for fails a test instead of going unmeasured.

## Context

- Roadmap: `docs/05-roadmap.md` § 0.14c (its **Check** is AC-1, verbatim). Listed in `docs/06-tasklist.md` M9 beside 0.14b; not a cutover gate.
- Decisions: **D-158** (the switch; a hand run always measures; Claude never turns `LIGHTHOUSE_MODE` on or dispatches a run unasked), **D-160** (one Lighthouse load and one tap run per route; `_rsc=` blocked during the load).
- **This task finishes only with `LIGHTHOUSE_MODE` on** (owner, 2026-11-17). The budgets come from the branch's preview measured automatically with the switch on, not from a hand run and not copied from a sibling route. It depends on 0.14b (TASK-113) because that is what lets the switch go back on. The routes, the guard and the test can be built before then; the PR waits for the run.
- **Amended by the owner, 2026-11-23:** the budgets may come from one hand run of the branch's preview (D-158: a hand run measures whatever the switch says), so the task finishes with `LIGHTHOUSE_MODE` still off. AC-1 follows the roadmap Check as amended; AC-3 reads the hand run's comment.
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

- [ ] AC-1 (roadmap **Check:**, verbatim): `scripts/perf/routes.mjs` and `scripts/perf/budget.json` have a route for each of `/books/releases`, `/books/shelves`, a shelf's page, `/books/add`, `/books/top`, a book's page, a run's *Add* and `/settings/calibre`, each with a tap from a screen that links to it, and each budget comes from a measured run of the branch's preview (a hand run while `LIGHTHOUSE_MODE` is off; owner, 2026-11-23), not copied from another route. `test/perf.test.ts` fails when any `page.tsx` under `src/app/`, at any depth, is neither measured by a route nor listed as unmeasured with a reason. Nothing in this entry turns `LIGHTHOUSE_MODE` on.
- [x] AC-2: Given a fixture `app/` tree with `books/page.tsx` measured and `books/new-thing/page.tsx` not, the guard reports `/books/new-thing`. Given the same page in the exemption list with a reason, it reports nothing. An exemption with an empty reason, or one naming a page that no longer exists, also fails. The guard is a pure function run on fixtures, and the real `src/app` passes it.
- [ ] AC-3: Every new route id has a `budget.json` entry and a row in `docs/02-architecture.md` § Performance budget with the same four numbers. The PR's Lighthouse comment from the measured run (a hand run, owner 2026-11-23) lists every new id, and each budget is that run's measurement plus about 5% (§ Performance budget's rule), written in the PR body as measured → budget per id.
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

- `/books/series`, a series' page, an author's page and a universe's page (5.9, 5.11) have no route; 0.14c exempts them, and a new phase-0 roadmap item measures them as 0.14c does (approved at plan) → docs/05-roadmap.md § 0.14e (new; also its row in docs/06-tasklist.md beside 0.14c, and the F-04 coverage line)
- The hand run measured `/books` (already budgeted) at 175,572 JS bytes, over its 175,000; the owner left it for 0.13 (2026-11-23) → docs/05-roadmap.md § 0.13

## Plan

Approved by the owner up front (2026-11-23: "approve plan, go with recommendations").

**Steps.**

1. **The guard, test first.** `scripts/perf/lib/perf.mjs` gains pure functions: `listPages(dir)` (every `page.tsx` under a directory at any depth, as a relative path), `pagePattern(file)` (its URL pattern: route groups `(x)` dropped, `@slot` and `(.)` intercept segments kept, so `comics/(dash)/page.tsx` → `/comics` and `@modal/(.)book/[id]/page.tsx` → `/@modal/(.)book/[id]`) and `unmeasuredPages({ pages, routes, exempt })`. A route path measures the one pattern Next would serve it from: same segment count, `[x]` matches any segment, static beats dynamic segment by segment (`/comics/runs` measures `/comics/runs`, not `/comics/[runId]`). Problems: an unmeasured pattern, an exemption with an empty reason, an exemption naming no page, an exemption for a page a route measures. Fixture trees are built in a temp dir (AC-2); the real `src/app` with the real `ROUTES` and exemption list passes. It replaces "has a route for every top-level screen".
2. **Eight routes** in `routes.mjs`: `releases` /books/releases, `shelves` /books/shelves, `books-add` /books/add and `top` /books/top (each tapped from /books, its nav item); `shelf` /books/shelves/[id]; `book` /book/[id]; `run-add` /comics/bendis-disassembled/add (tapped from that run's *Add issues*; the slug is hand-authored, as for run-small); `calibre` /settings/calibre (tapped from /settings' *Calibre* row).
3. **Paths resolved at run time** for `shelf` and `book` (their ids are the owner's, not hand-authored). Such a route has `resolve: { from, selector }` and keeps its pattern as `path`, which the comment and the doc table show. Before measuring, `measure.mjs` loads `from` signed in, takes the first matching link's href (`resolvedPath`, pure, in perf.mjs) and logs `measure: shelf resolved /books/shelves/[id] to /books/shelves/<id>`; the Lighthouse load and the tap both use that path. Shelf: the first shelf on /books/shelves, and its tap clicks that same first link. Book: the first book row on /books/list. **When live has no shelf**, the route records "no link matching … on /books/shelves" and the gate fails it as not measured, as for any route that fails to measure: never skipped quietly. The fix is a shelf on live or an exemption, which is the owner's call.
4. **A book's page: one id, `book`, measuring both.** The Lighthouse load is the full page by direct load (a reload or a shared link: the heavier render). The tap is what a tap does: a Library row opens the sheet through the `@modal` intercept. The sheet keeps the Library's `h1`, so the tap gains `paints`, a selector it waits for instead of a changed `h1`: `[role="dialog"] [data-sheet-heading]`, which SheetHeading draws only once the book has loaded. Two ids would double the runs for a sheet whose server render is the same `BookDetail`.
5. **The exemption list** (in `test/perf.test.ts`, one line of reason each): `/@modal/(.)book/[id]` (the sheet, an intercept with no URL of its own; the `book` route's tap measures it); `/books/series`, `/books/series/[id]`, `/books/authors/[id]`, `/books/universes/[id]` (drawn by 5.9 and 5.11, outside 0.14c's eight; a new roadmap item measures them).
6. **Budgets.** The first push carries the eight ids in `budget.json` with `null` numbers (the doc table shows `–`): the report already lists such a route under "No budget recorded", measured but not gated. The test allows `null` only for ids in `AWAITING_MEASUREMENT` (in the test, naming 0.14c). Once the owner turns `LIGHTHOUSE_MODE` on and the automatic run comments, each budget becomes that run's measurement plus about 5% (JSON and doc together), `AWAITING_MEASUREMENT` goes, and the PR body gets measured → budget per id.
7. **Docs.** `docs/02-architecture.md` § Performance budget gains the eight rows and a paragraph (the any-depth guard, runtime paths, the book's load and tap); the `routes.mjs` header and the budget's `$comment` drop "top-level".

**Files.**

- `scripts/perf/lib/perf.mjs`, `perf.d.mts`: `listPages`, `pagePattern`, `unmeasuredPages`, `resolvedPath`
- `scripts/perf/routes.mjs`, `routes.d.mts`: the eight routes; the `resolve` and `tap.paints` types
- `scripts/perf/measure.mjs`: resolve at run time and log it; the tap's `paints`
- `scripts/perf/budget.json`: the eight ids (null, then measured + 5%)
- `test/perf.test.ts`: the guard on fixtures, the real tree, the exemptions, `resolvedPath`, the budget allowance
- `docs/02-architecture.md` § Performance budget: the rows and paragraph

**Test strategy.**

- AC-1, AC-2: `test/perf.test.ts` › "the page guard": a fixture's nested page reported as `/books/new-thing`; exempted with a reason, nothing; an empty reason fails; a stale exemption fails; static beats dynamic; groups and intercepts patterned; the real `src/app` passes. "the route list" › has each of the eight, each tapped from a different page than its own.
- AC-3: "matches budget.json one for one", "holds a number…" (null only while awaiting measurement), "is mirrored in the architecture's Performance budget"; measured → budget per id is checked by hand against the PR's Lighthouse comment.
- AC-4: `resolvedPath` unit tests (first match; none → an error naming the page); the tap times in the Lighthouse comment are the owner-run check.

**Risks**: the run can't happen in this session (`LIGHTHOUSE_MODE` is off, and D-158 says only the owner turns it on), so AC-1 and AC-3 stay open and the PR waits for it. A route that won't measure on live (no shelf) fails the gate visibly.

**Size**: 8 files, no schema, no UI. Not split.

**Follow-ups**: one, approved at plan (in § Follow-ups).

**Revision 1 (during Phase 2, owner's standing "go with recommendations").** `docs/GIT-PR.md` § the Lighthouse gate also said "a new top-level screen adds its route"; it now says any page at any depth, or listed as unmeasured with a reason, as `docs/02-architecture.md` does. One sentence, the same rule this task changes. `test/perf.test.ts`'s existing "takes the count from measureRuns" anchors on `for (let route of routes)`: the loop rebinds `route` to its resolved path.

**Revision 2 (spec review R1).** Step 4's `paints` was wrong: the sheet's skeleton (`loading.tsx`, `BookDetailSkeleton as="sheet"`) draws a `data-sheet-heading` too ("Loading book"), so the tap would have timed the skeleton. It is now `[role="dialog"] .detail:not([aria-busy]) [data-sheet-heading]`: the skeleton's `.detail` is `aria-busy="true"` and the loaded book's isn't, and `test/perf.test.ts` reads `BookDetail.tsx` to hold that. Step 3, corrected: `routes.mjs` and the doc table show a resolved route's pattern, but the PR comment shows the path measured (`measure.mjs` stores it, and the landed-on check compares against it).

**Revision 3 (spec review R2 note, test audit R1).** The book tap's `paints` is `[role="dialog"] .detail[data-detail]:not([aria-busy]) [data-sheet-heading]`: the sheet's error state draws a heading in a `.detail` with no `data-detail`, so a book that fails to load records no time. `test/perf.test.ts` gains a source-anchor test that `measure.mjs` resolves before measuring, logs `resolved … to …` (AC-4), rebinds the route before the Lighthouse load and the tap, and records the measured path.

**Revision 4 (owner, 2026-11-23, after the hand run).** The hand run (run 45127510072, `cd5f93c`) measured seven of the eight; each budget is that measurement plus about 5%, rounded up (bytes to 100, requests to the next whole one), in `budget.json` and the doc table, and `AWAITING_MEASUREMENT` holds only `shelf`: live has no shelf, so the owner adds one and a second hand run measures it. The run also failed `book` on `GET /api/progress/book/read` during the load: the page draws the status control open (task 3.5) and it loaded the reads on mount (1.17b). The owner chose to fix it here: `BookDetail` hands `BookStatus` the book's logged read count (`readCount`), *All reads (n)* shows from it, and the reads load only when it is pressed (`src/components/BookStatus.tsx`, `src/components/BookDetail.tsx`; tests in `test/reading-log.test.tsx` and `test/book-detail.test.tsx`). A Library row (no count) loads them when it opens, as before. `/books`' JS over its budget is left for 0.13 (owner).

## Review log

Verify R1 PASS | CI R1 PASS (95aba84, every project) | Spec R1 CHANGES (book tap timed the sheet's skeleton) → fixed | Verify R2 PASS | Spec R2 APPROVE | CI R2 PASS (6736e2c) | Audit R1 CHANGES (automated ACs PROVEN; budgets owner-gated; optional: assert the resolve log) → test added | Verify R3 PASS | Follow-ups check APPROVE | Drift R1 update first (behind 1: #318 changed globals.css, queries.ts and the sheet markup the book tap reads) → rebased | Verify R4 PASS | CI R3 PASS | Hand Lighthouse run 45127510072 FAIL(3: shelf not measured, live has no shelf; book asked GET /api/progress/book/read; /books JS 572 over) → 7 budgets written, book fixed here, shelf awaits a re-run, /books to 0.13

**Waiting on the owner (D-158):** `LIGHTHOUSE_MODE` is unset. AC-1's measured budgets, AC-3 and AC-4's tap times need the automatic Lighthouse run on PR #319's preview with the switch on; then each budget is that measurement plus about 5%, `AWAITING_MEASUREMENT` goes, and the PR body gets measured → budget per id. Status stays In progress until then.

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 3
- Review rounds: 2 (spec), 1 (audit)
- First-pass AC FAILs: 1 (AC-4: the book tap's `paints` matched the skeleton)
- Plan revisions after approval: 3
