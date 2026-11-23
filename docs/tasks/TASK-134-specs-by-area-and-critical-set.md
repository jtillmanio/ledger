---
id: TASK-134
title: 0.15 The browser suite runs by area (1 of 3) — every spec has an area, and a critical set
status: Ready
depends_on: []
size: M
model: opus
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
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
