---
id: TASK-162
title: 5.11b Universes: every universe in one list
status: Done
depends_on: [TASK-161]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: f33055b
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

- [x] AC-1 (roadmap **Check:**, verbatim):
with the test database, three universes: one with a read book, one followed
with none read, and one with only To-read books. `/books/universes` lists
the first two, *All* adds the third, and each row links to
`/books/universes/<id>` with `read / total` equal to `universe_progress`'s.
The Series page's *Universes* tab opens it and carries `aria-current`
there. `scripts/perf/routes.mjs` and `budget.json` have a route for it.
Screenshots at 360px and 1280px; axe passes.
- [x] AC-2: Given a universe followed Tracking and part-read, its row says *On hold* (D-118), as its page does.
- [x] AC-3: Given no universes, the page draws an empty state saying where universes come from (Calibre's `#superseries`).
- [x] AC-4: The page meets the UX floor (`docs/04-design.md` § 10. The UX floor): states drawn (empty, loading, error), meters fill with `--ready`, the tabs are links with names and counts, 44 px targets at phone widths, contrast in both themes, and screenshots at each `ui.viewports` width, light and dark.

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

- Candidate decision: sibling list pages (*Series · Universes*) are joined by a row of real links carrying `aria-current="page"`, styled as the `.tabs` strip, not by `Tablist` (`role="tab"`, `aria-selected`), which is for one page's panels; the Check asks for `aria-current` → `docs/review/decisions.md` § D-187 (approved at plan)
- The `universes` route's perf ceilings start at `/books/shelves`'s, unmeasured (`LIGHTHOUSE_MODE` is off; owner, plan gate 2026-11-25), as #334 did for `issue`; a first measurement above them is a raise and needs a decision → `docs/02-architecture.md` § Performance budget, stated beside the route (approved at plan)
- `test/e2e/series.spec.ts` needed two edits the plan did not list: its `SeriesList` counts gain `universes`, and the nav-current check excludes the in-page tab row (`:not(.list-tabs > a)`) → not tracked: done in this PR (plan revision)
- The empty *No universes yet* and *No series yet* states, the skeleton and the error state can't be reached in a browser on the shared database; they are drawn from static markup in the e2e spec and tested as markup → not tracked: accepted as is, the pattern 5.9 and 5.9c use

## Plan

Approved 2026-11-25 (owner, plan gate): keep the task whole (about 20 files, most a new route's companions), the
budget at Shelves' ceilings unmeasured, implement on Sonnet. Two departures from the task's Context, decided at
the gate: the tab row is **not** `Tablist` (it uses `role="tab"`/`aria-selected`; the Check asks for
`aria-current`), and the budget is **not** from a measured run (the switch is off).

**Steps**

1. **Mockup first** (`ui.redrawFiles`): `design/mockups.html` gains a `universes` section (360px populated,
   360px empty *No universes yet*, 360px none started, 834px with *Series* current on the rail, desktop with it
   current in the sidebar), and every `series` list frame gains the *Series · Universes* row (Series current)
   above the chips. `design/mockups-index.md` gets a `universes` row and the `series` row names the tab row.
2. **Queries** (`src/db/queries.ts`, beside `seriesList`):
   - `UniverseSummary = { id, name, read, total, followState: FollowState | null, unread, series }`.
   - `universesList(userId, show: SeriesShow)`: from `universe_progress` (`books_read`, `books_listed` as
     total, `follow_state`), `books_listed > 0`; `unread` = live books neither read nor DNF (as `universePage`);
     `series` = `COUNT(DISTINCT series_id)` of its live books. The *Started* cut in SQL, written out as in
     `seriesList`: `follow_state IN ('tracking','reading')` or a live book `read`/`reading`/`listening`/`dnf`.
     Order as `seriesList`: in progress (0), not started (1), complete (2), then `lower(name)`, then id.
   - `universeCounts(userId)` → `{ started, all, series }`: the chips' counts over the same rows, plus the
     Series tab's count (`series_progress`, `books_listed > 0`) as a scalar sub-select (one query).
   - `seriesCounts` gains `universes` (the Universes tab's count) the same way, so `/books/series` stays at 2
     queries. Update `test/series-page.test.ts`'s `toEqual`s for the new key.
3. **Server-safe *On hold*** (D-118): move `middle` from `src/components/FollowOptions.tsx` (a `"use client"`
   module, whose exports a server component can't call) to `src/lib/follow-offer.ts`; FollowOptions imports it.
4. **`src/components/BookListTabs.tsx`** (server): `<nav className="tabs list-tabs" aria-label="Series and
   universes">` with two `Link`s (`prefetch={false}`), *Series* `/books/series` and *Universes*
   `/books/universes`, each its name and count (`<span className="n mono">`), `aria-current="page"` on the open
   one, and the sliding `tab-ink` (`--i`, `--n: 2`). Pushes, not replaces, so Back returns to the tab.
   `src/app/globals.css`: the `.tabs [role="tab"]` rules extended to `.list-tabs > a` (44px, `--muted` → `--ink`
   600 on `[aria-current="page"]`, the count in its tab's colour, focus ring, hover under `(pointer:fine)`).
5. **`src/components/UniversesList.tsx`** (after `SeriesList`): head *Universes* + lede, `BookListTabs`, chips
   *Started · All* (`UNIVERSES_HREF`, `?show=all`, counts, `aria-current`), rows: `row-link rt` name →
   `universeHref(id)`, `read / total` mono, a line *N series · Reading|Tracking|On hold* (no follow: *N series*
   alone; 0 series: the follow word alone, or nothing), a `--ready` meter (`fillShare`), a chevron. No universes
   at all: `BookListTabs` + `EmptySlate` *No universes yet*, saying a universe comes from a book's superseries
   in Calibre (`#superseries`), action *Calibre sync* → `/settings/calibre`. None started: chips + slate naming
   *All N universes*. Route `src/app/books/universes/page.tsx` (`force-dynamic`, metadata *Universes · Ledger*,
   `parseSeriesShow`, the two queries in one `Promise.all`), `loading.tsx` (the series skeleton's shape plus the
   tab row, `sk-tabs`), `error.tsx` (neutral, *Couldn't load your universes. Nothing was changed.*, *Try again*).
6. **Series page**: `SeriesList` draws `BookListTabs` (Series current) under the head in both the populated and
   the *No series yet* states; `src/app/books/series/loading.tsx` gains the tab row's bar.
7. **Nav**: `books-series` in `src/components/nav/items.ts` gains `currentOn: /^\/books\/universes$/`, so Series
   stays current on the list (a universe's own page is unchanged).
8. **Perf and harness**: `scripts/perf/routes.mjs` `{ id: "universes", path: "/books/universes", signedIn: true,
   tap: { from: "/books/series", selector: 'a[href="/books/universes"]' } }`; `scripts/perf/budget.json`
   `universes` = `shelves`' ceilings; mirrored in `docs/02-architecture.md` § Performance budget, saying it is
   unmeasured; `test/query-budget.test.ts` `/books/universes: { queries: 2, waves: 1 }` and its render entry;
   `scripts/lib/ci-scope.mjs` names `UniversesList` and `BookListTabs` books' components; `test/e2e/shard-times.json`
   an estimate for the new spec. Grep `test/` for every name the diff adds (`.claude/project/implement-task.md`).

**Files**: the 18 in *Files likely touched*, plus (not listed there) `src/components/BookListTabs.tsx`,
`src/components/FollowOptions.tsx`, `src/lib/follow-offer.ts`, `src/app/globals.css`, `src/app/books/series/loading.tsx`,
`src/components/nav/items.ts`, `docs/02-architecture.md`, `scripts/lib/ci-scope.mjs`, `test/e2e/shard-times.json`,
`test/query-budget.test.ts`, `test/series-page.test.ts`, `test/series-list.test.tsx`, `test/nav-items.test.tsx`.

**Test strategy**

- AC-1: `test/universes-list.test.tsx` (TEST database, as `test/series-page.test.ts` sets up): three universes,
  read book / followed none read / only To-read → *Started* lists the first two, *All* three, counts `{2,3}`,
  `read`/`total` equal `universe_progress`'s, order, a soft-deleted book on no count, another user's follow
  ignored. `test/e2e/universes.spec.ts` (own E2E ids, found by name): the same three on `/books/universes`, *All*
  adds the third, each row's href `/books/universes/<id>` and `read / total` equal to a `universe_progress`
  select; from `/books/series` the *Universes* tab opens it and carries `aria-current="page"` (and *Series* does
  on `/books/series`); axe; screenshots at 360 and 1280. `test/perf.test.ts` still passes (route present, not in
  `UNMEASURED`).
- AC-2: markup test (*On hold* for tracking + read > 0 + unread > 0; *Tracking* when none read; *Reading*) and an
  e2e row followed Tracking and part-read reading *On hold*, as its page's follow control does.
- AC-3: markup test (the shared TEST database always has universes): *No universes yet*, names Calibre's
  `#superseries`, one action to `/settings/calibre`, the tab row still there.
- AC-4: e2e floor as `series.spec.ts` does (axe list, contrast in both themes, 44px chips and tabs at phone
  widths, no sideways scroll, nothing red, meter fill = `--ready`, loading skeleton at the loaded size, error
  state), screenshots at every `ui.viewports` width, light and dark; markup tests for loading and error.
- Also: `test/nav-items.test.tsx` (Series current on `/books/universes`, not on `/books/universes/x`),
  `test/series-list.test.tsx` (the tab row in both states, Series current).

**Risks**: `seriesCounts`' new key touches every `toEqual` on it; the tab row moves the Series list's chips down
(its screenshot tests and the mockup change together); the shared `.tabs` CSS must leave `Tablist` as it is.

## Review log

Verify R1 PASS (tsc, lint, `test:no-e2e`; the touched specs in `w390-light`: one test of mine fixed first, `a[href="/books/universes"]` also matched the Started chip) | CI R1 PASS (`check`, e2e full 10/10, Vercel; Lighthouse off) | Audit R1 PASS | Spec R1 APPROVE | Schema R1 APPROVE | UI R1 PASS (360 to 1280px, light and dark; the empty states are not reachable on the dev database) | Round 2: no reviewer's files changed after approval, so none re-run.

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 1
- Review rounds: 1
- First-pass AC FAILs: 0
- Plan revisions after approval: 1 (`test/e2e/series.spec.ts`, above)
