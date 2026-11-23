---
id: TASK-134
title: 0.15 The browser suite runs by area (1 of 3) — every spec has an area, and a critical set
status: In progress
depends_on: []
size: M
model: opus
autonomy: attended
ui: false
plan_status: approved
planned_at_commit: 7530fd8
---

# TASK-134 — 0.15 The browser suite runs by area (1 of 3) — every spec has an area, and a critical set

## Goal

Every browser spec says which part of the app it checks, a small critical set is marked, and the suite can be told to run only some areas plus that critical set. No spec can be added without an area.

## Context

- Roadmap: `docs/05-roadmap.md` § 0.15 (owner, 2026-11-20, from the shard-time work after TASK-127, PR #304; **amends D-80, D-141 and D-161**). Its **Check:** is AC-1, verbatim. Listed in `docs/06-tasklist.md` M9 beside 0.13 (added 2026-11-23); pulled ahead of 1.26 (D-172). Feature F-03.
- **Split, 1 of 3** (`workflow.splitPolicy: split`; the entry is size L: the specs, the test plan, CI's scope job and workflow, the time budget and the git rules). This part is the specs and the local plan: areas, the critical set, and an area filter Playwright honours. TASK-135 maps a PR's changed paths to areas in CI and records the decision. TASK-136 makes the time budget follow the area.
- **The areas:** `books`, `comics`, `watch`, `music`, `games`, `shared` (the shell, the thumb bar, the status control, Add books, settings, the sheets, and every other control more than one medium uses). Watch, music and games have no specs yet: their areas exist so 8.8, 9.3 and 10.1 have somewhere to land.
- **How a spec says its area:** a folder or a tag, "whichever `playwright.config.ts` and `scripts/lib/e2e.mjs` can read" (the entry). There are 48 spec files in `test/e2e/` today (`ls test/e2e/*.spec.ts`), plus `auth.setup.ts`, `global-setup.ts`, `helpers.ts` and `fixtures/`. A folder move touches every path in `test/e2e/shard-times.json` and any `@at-` or `--grep` that names a file. A tag touches every `describe`. The plan picks one and says why.
- **The critical set,** tagged `@critical`, runs at the core projects (`E2E_CORE`, `scripts/lib/e2e.mjs`) whatever the areas: sign-in, each medium's dashboard loading, the add flow, a status write and its Undo, the navigation between media, and an error state. A few minutes of suite time in total; the plan lists the tests it tags and their recorded time from `shard-times.json`.
- **Today's tags** are `@floor`, `@feel`, `@motion`, `@touch` and `@at-<project>`, read by `e2eProjects(scope)` (`scripts/lib/e2e.mjs`, around line 100). `test/e2e-guard.test.ts` › "every tag in the specs is @floor, @feel, @motion, @touch or names a project" must learn `@critical` (and the area tags, if the plan chooses tags).
- **The filter.** `planE2e(env)` reads `E2E_SCOPE` (`core` | `full`) and `E2E_SHARD`. This part adds an areas setting (the plan names it, e.g. `E2E_AREAS=comics`) that selects the area's specs plus `@critical`; unset means every area. `scripts/lib/e2e-shards.mjs` balances only the selected files across shards.
- Decisions: D-80, D-141, D-143, D-145, D-161, D-167. The decision row amending them is TASK-135's, when CI starts choosing areas.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves its last clause, *a spec file with no area fails `test/e2e-guard.test.ts`*, and the critical set's existence; TASK-135 proves the map, the plan, CI and the git rules): tests pin the map and the plan: a change only under a medium's own
routes, components and specs selects that medium and the critical set, and
runs none of another medium's specs; a change under `src/db/`, `etl/views.sql`,
`src/lib/`, a shared component, `globals.css`, `package.json`, the Playwright
config or `.github/` selects every area; an unmapped path selects every area; a
docs-only change still skips the suite (D-145); a push to `main` and the
`e2e:full` label select every area; the critical set runs at the core projects
in every PR; a spec file with no area fails `test/e2e-guard.test.ts`. The
scope job's log and summary name the areas chosen and why. On a branch that
changes only a comics screen, CI runs the comics specs and the critical set and
no books spec, and its browser time is under half of a full run's.
`.claude/rules/git.md`'s *Test on the branch* section says which PRs run what.
Decision row recorded (next free D-n), amending D-80, D-141 and D-161.
- [ ] AC-2: `test/e2e-guard.test.ts` fails, naming the file, for a fixture spec with no area, one with two areas, and one with an area not in the six; every real spec in `test/e2e/` passes.
- [ ] AC-3: With the areas setting `comics`, the planned file list holds every comics spec and every file with a `@critical` test, and no books-only spec; with it unset, the list is every spec, as today. A `@critical` test is planned at each core project and nowhere else, whatever the scope.
- [ ] AC-4: The critical set covers sign-in, the books and comics dashboards loading, the add flow, a status write and its Undo, the navigation between media, and an error state, each named in the plan with a test it tags. Its total recorded time in `test/e2e/shard-times.json` at the core projects is at most 5 minutes.
- [ ] AC-5: `npm run test:e2e` with no areas setting runs the same tests at the same projects as before the change (the planned list compared before and after in a test).

## Out of scope

- Mapping changed paths to areas, and anything in `.github/workflows/ci.yml`: TASK-135.
- The time budget by area: TASK-136.
- Trimming or rewriting specs beyond adding an area and the `@critical` tag.
- Specs for watch, music or games.

## Files likely touched

- `scripts/lib/e2e.mjs`, `scripts/lib/e2e.d.mts` — the areas, the critical tag, the areas setting.
- `playwright.config.ts` — reads the selection.
- `scripts/lib/e2e-shards.mjs` — shards only the selected files, if the plan needs it.
- `test/e2e-guard.test.ts` — AC-2, AC-3, AC-5.
- `test/e2e/*.spec.ts` (and `test/e2e/shard-times.json` if the plan moves files into folders) — each spec's area; `@critical` on the set.
- `docs/COMMANDS.md` — the areas setting for a local run.

## Verification

- Automated: `test/e2e-guard.test.ts` (AC-1's guard clause, AC-2, AC-3, AC-5); `npm run test:no-e2e`; `node scripts/test-files.mjs` over the changed specs in one project.
- Manual: `E2E_AREAS=comics npm run test:e2e` (or the plan's name) → expected: Playwright lists only comics specs and the `@critical` tests.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- `node scripts/e2e-shards.mjs balance` prices every spec file in every project; once CI sets `E2E_AREAS` it should price the plan the area run made (`areaFilter`) (approved at plan)
- A file planned only for its `@critical` tests counts its whole recorded time in the shard plan, an overestimate the area budget should know about (approved at plan)

## Plan

Approved by the owner 2026-11-23 (with the AC-3 reading below).

**How a spec says its area:** one header line, `// @area: <area>`, read from the
file's text by `scripts/lib/e2e.mjs` (and so by `playwright.config.ts`, and
later by TASK-135's `ci-scope.mjs`). Not folders: a move rewrites every key in
`shard-times.json`, every `./helpers` import and every doc and task naming a
spec path. Not a Playwright tag per describe: many tests sit outside any
describe, and "exactly one area per file" can't be checked on per-test tags.

**AC-3's reading (owner's choice):** a `@critical` test runs at the core
projects only, *as its own tags place it* (D-161): it carries no `@floor` or
`@feel`, and an `@at-` tag on it names a core project (the guard checks both).
So it never runs outside the core projects at either scope, areas or not, and
AC-5 holds; it does not gain w390-dark or every core project.

**The areas (48 specs):**
- comics (4): queue, spine, issue-search, covers-reduced-data.
- shared (19): shell, thumb-bar, tab-row, routes, settings, status, markup,
  skeletons, harness, mockup-tablet, start-dates, progress, covers,
  dashboard-covers, and Add books (add-books-loading, add-books-owned,
  book-search, paste-books, new-shelf: the entry names Add books shared).
- books (25): audiobooks, author-universe, book-detail, book-list-search,
  books-dashboard, calibre-page, dnf-reason, follows, library-genres,
  library-owned, library-sort, listen-queue, parked-review, parked, place-them,
  plan-picker, plan-rail-drag, plan-rail, plan-sheet, rebalance, releases,
  series, shelves, top-books, unlisted.

**The critical set (`@critical`, 6 tests in 4 files):**
- Sign-in: routes › "a garbage session goes to /login for a page and gets 401
  from a route handler" (the gate; `auth.setup.ts` signs in through the form
  before every run, whatever the areas).
- Books and comics dashboards loading: routes › "each route answers with its own screen".
- The add flow: book-search › "adding one creates one books row with hardcover_id and its cover; …".
- A status write and its Undo: dnf-reason › "the toast's Undo after a reason leaves the book reading, …".
- An error state: dnf-reason › "a reason that didn't save says so with Retry and leaves the DNF; …".
- Navigation between media: shell › "the media bar's Watch link goes there".
- Recorded time at the core projects, by whole file (shard-times.json records
  files, not tests, so this is an upper bound): routes 11 s, book-search 59 s,
  dnf-reason 8 s and shell 29 s, about 107 s in all, against AC-4's 300 s.

**Steps**
1. `scripts/lib/e2e.mjs` (+ `.d.mts`): `AREAS`, `CRITICAL_TAG`; `specArea(text)`
   → the area or an error naming none / two / unknown; `areaProblems(specs)`
   (messages naming each file); `parseAreas` and `planE2e`'s `areas` from
   `E2E_AREAS` (comma-separated; unset or empty = every area, `null`; an
   unknown area refuses); `areaPlan(specs, areas)` → the selected files and the
   critical-only files, and `areaFilter(project, plan)` → per project the files
   it runs (every project: the selected areas' files; a core project also the
   files holding a `@critical` test) and a `grepInvert` that drops the other
   tests of a critical-only file. A spec with no or a bad area counts as
   selected (fails toward running). Unset areas → no filter at all.
2. `playwright.config.ts`: reads each spec's text once, applies `areaFilter`
   to each project's `testMatch` and `grepInvert`, and builds the shard units
   per project from that project's own files (`shardUnits` unchanged, so
   `scripts/lib/e2e-shards.mjs` doesn't change).
3. Specs: the `// @area:` line at the top of all 48; `@critical` inline
   (`{ tag: ["@at-w390-light", "@critical"] }`) on the 6 tests.
4. `test/e2e-guard.test.ts`: the tag test learns `@critical`; AC-2 on inline
   fixture specs and on every real spec; AC-3, AC-4 and AC-5 on Playwright's
   own `--list --reporter=json` (no server, no database, about 4 s a run),
   core and full, areas unset and `comics`.
5. `docs/COMMANDS.md`: `E2E_AREAS` for a local run.
6. One-off, in the PR: main's `--list` (saved before any change, core and
   full) diffed against the branch's, line numbers and the new tag stripped.

**Files**
- `scripts/lib/e2e.mjs`, `scripts/lib/e2e.d.mts` — areas, the critical tag, `E2E_AREAS`, the plan.
- `playwright.config.ts` — applies the plan per project and per shard.
- `test/e2e/*.spec.ts` (48) — the area line; `@critical` on 6 tests in routes, book-search, dnf-reason, shell.
- `test/e2e-guard.test.ts` — AC-1's guard clause, AC-2 to AC-5.
- `docs/COMMANDS.md` — the setting.
- Not touched: `scripts/lib/e2e-shards.mjs`, `test/e2e/shard-times.json`.

**Test strategy**
- AC-1 (this part's clause) and AC-2: e2e-guard › "a spec file with no area,
  two areas or an unknown one fails, naming the file; every real spec has one".
- AC-3: e2e-guard › "with E2E_AREAS=comics Playwright plans every comics spec
  and every file with a @critical test, and no other books spec", and "a
  @critical test is planned at core projects only, at both scopes, areas or not".
- AC-4: e2e-guard › "the critical set covers sign-in, both dashboards, the add
  flow, a status write and its Undo, navigation between media and an error
  state, within 5 minutes of recorded core time".
- AC-5: e2e-guard › "with no areas, Playwright plans exactly what the project
  rules alone plan, core and full" (the same `(project, test)` pairs), plus the
  one-off diff against main's saved lists.
- Unit: `specArea`, `parseAreas`/`planE2e` refusal, `areaFilter` (unset → none).

**Risks:** the `grepInvert` relies on Playwright's grep title holding the file
name (`<project> <file> … <title> <tags>`, Playwright 1.65 `_grepTitleWithTags`);
the `--list` tests break loudly if that changes. Spec line numbers shift by one.

**Size:** 53 files, 48 of them one mechanical line; already part 1 of a split.

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
