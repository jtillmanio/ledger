---
id: TASK-135
title: 0.15 The browser suite runs by area (2 of 3) — CI runs what a PR's paths can break
status: Review
depends_on: [TASK-134]
size: M
model: opus
autonomy: attended
ui: false
plan_status: approved
planned_at_commit: 7e981ea
---

# TASK-135 — 0.15 The browser suite runs by area (2 of 3) — CI runs what a PR's paths can break

## Goal

A ready PR's browser suite runs only the areas its changed files can break, plus the critical set. A push to `main`, the `e2e:full` label, a PR that touches shared code, and a nightly run on `main` still run everything.

## Context

- Roadmap: `docs/05-roadmap.md` § 0.15 (owner, 2026-11-20; **amends D-80, D-141 and D-161**). Its **Check:** is AC-1, verbatim. Listed in `docs/06-tasklist.md` M9 beside 0.13; pulled ahead of 1.26 (D-172).
- **Split, 2 of 3.** TASK-134 gave every spec an area, tagged the critical set and added the areas setting. This part is the map from paths to areas, the scope job and the e2e job, the nightly run, the git rules and the decision row. TASK-136 is the time budget by area.
- **The map** (the entry): `scripts/lib/ci-scope.mjs` maps a changed path to areas. A medium's routes, components and specs select that medium. **Anything shared or unmapped selects every area:** `src/db/**`, `src/lib/**`, `etl/views.sql`, the shared components, `src/app/globals.css`, `src/proxy.ts`, `package.json` and the lockfile, Next and Playwright config, `test/e2e/helpers.ts`, `.github/**`. The map fails toward *all*, never toward *none*. The plan lists which `src/components/*` are a medium's and which are shared, and how a new component defaults (shared).
- **What runs where:** a ready PR runs its areas at full scope (every project the tags say, D-161) plus the critical set at the core projects. A push to `main`, a PR labelled `e2e:full`, a PR that selects every area, and a scheduled nightly run on `main` run everything. A docs-only change still skips the suite (`isDocsOnly`, D-145).
- **Today.** `scripts/ci-scope.mjs` (run by the `scope` job in `.github/workflows/ci.yml`, around line 38) outputs `full` and `e2e_scope` (`core` | `full`, from `e2eScope`: a draft runs core). The e2e matrix job (`E2E_SCOPE`, `E2E_SHARD`, ten shards, D-167) and `check` read them. **Interplay to settle at the plan gate:** `ranEveryProject` and `greenFullRunToReuse` (D-145) let a later docs-only push reuse an earlier run that passed every project, recognised by its `e2e full n/m` shard names. Say how a run that covered only some areas counts, and what the shard job's name becomes.
- **The scope job says why.** Its log and `$GITHUB_STEP_SUMMARY` name the areas chosen and the path (or rule) that chose each.
- **The nightly run** is a `schedule` trigger on `ci.yml` (or a new workflow) for `main`. The repo is public, so runner minutes are free (D-143's note), but the plan says what a failure notifies.
- **The decision row** (next free D-n in `docs/review/decisions.md`) amends D-80 (what a PR runs), D-141 (the browser suite runs whole only in CI) and D-161 (the time budget, which TASK-136 changes). `.claude/rules/git.md` § *Test on the branch, before merge* and `docs/GIT-PR.md` say which PRs run what. A PR the owner or Claude judges risky (a refactor with no clear area) gets `e2e:full` before merge.
- **Not chosen** (the entry): running only the core projects on PRs. It saves about 22% and grows with every medium.
- Tests: `test/ci-scope.test.ts`, `test/ci-yml.ts` (reads `ci.yml`).
- *From TASK-134 (0.15, PR #323):* `node scripts/e2e-shards.mjs balance` prices every spec file in every project. Once CI sets `E2E_AREAS`, it should price the plan the area run actually made (`areaFilter` in `scripts/lib/e2e.mjs`), or an area run will always look out of balance.
- *From TASK-134 (0.15, PR #323), open question for the plan:* `dnf-reason.spec.ts` is a `books` spec but holds 2 of the 6 `@critical` tests, so a comics-only PR runs those two (only them, at the core projects). The Check says such a PR runs "no books spec": say explicitly that a books file's `@critical` tests don't count as a books spec, or move those tests.

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim; this part proves every clause but the guard's, which TASK-134 proves): tests pin the map and the plan: a change only under a medium's own
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
- [x] AC-2: Given changed files under both `src/app/comics/` and `src/app/books/`, the scope selects `books` and `comics` and not `watch`, `music` or `games`; given one file under `src/components/` that the map does not name, it selects every area.
- [x] AC-3: `ci.yml` has a `schedule` trigger that runs on `main` with every area, and `test/ci-yml.ts` asserts it; a scheduled run's scope output is every area.
- [x] AC-4: A docs-only push after a run that covered only some areas does not reuse that run as a full pass under D-145: the plan's rule is pinned by a test in `test/ci-scope.test.ts`.
- [x] AC-5: The PR body records the comics-only branch's run (its URL, the areas the summary names, its browser time) beside a full run's from `main`, and the ratio is under one half.

## Out of scope

- The time budget per area (TASK-136); D-161's ceiling keeps working on the run a PR made until then.
- Giving specs an area or tagging the critical set (TASK-134).
- Changing the core or full project lists, or the shard count.

## Files likely touched

- `scripts/lib/ci-scope.mjs`, `scripts/lib/ci-scope.d.mts`, `scripts/ci-scope.mjs` — the map, the areas output, the reason.
- `.github/workflows/ci.yml` — areas into the e2e job, the nightly `schedule`, the job names.
- `test/ci-scope.test.ts`, `test/ci-yml.ts` — AC-1's map clauses, AC-2 to AC-4.
- `.claude/rules/git.md` § *Test on the branch, before merge*, `docs/GIT-PR.md` — which PRs run what.
- `docs/review/decisions.md` — the decision row.

## Verification

- Automated: `test/ci-scope.test.ts` and `test/ci-yml.ts` (AC-1's map and plan clauses, AC-2 to AC-4); `npm run test:no-e2e`.
- Manual: a throwaway branch changing only a comics screen, pushed and marked ready → expected: the scope summary names `comics` and the critical set with the reason, no books spec runs, and the browser time is under half of `main`'s last full run (AC-1, AC-5). The owner closes the throwaway PR.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- TASK-136 (the budget by area): an area run's `e2e-times` covers only its areas, so today's `compareTimes` counts main's other tests as removed and the per-area comparison should read `E2E_AREAS`; and a one-area run still builds on all ten shards for about two minutes of tests (PR #328: 15.1 job-minutes against main's 57.3): whether an area run takes fewer shards (approved at plan) → docs/tasks/TASK-136-e2e-budget-by-area.md § Context
- The first nightly run on `main` after merge can only be checked then: Actions → CI, event `schedule`, its scope summary reads "every area" → not tracked: a one-time post-merge check, listed in PR #327's How it was verified

## Plan

Approved by the owner 2026-11-23 (attended, at the plan gate).

**Steps**

1. **The map** (`scripts/lib/ci-scope.mjs`, `prAreas(files, specAreaOf)`): each changed path selects areas, in order:
   - docs-only paths (`isDocsOnly`) and unit tests (`test/` outside `test/e2e/`, `etl/test_*.py`) select none;
   - `test/e2e/<x>.spec.ts` selects its own `// @area` (a shared spec selects `shared` alone); a spec it can't read (deleted) selects every area;
   - routes: comics `src/app/comics/`, `src/app/api/{runs,queue,metron}/`; books `src/app/{books,book,parked,settings/calibre}/`, `src/app/@modal/(.)book/`, `src/app/api/{calibre,follows,listen-queue,parked,plan}/` (*plan revision 2, owner-approved after spec review R1*: `api/books/` and `api/shelves/` serve Add books, Paste and New shelf, which shared specs check, so they stay unmapped and select every area); watch `src/app/watch/`;
   - components: a medium's when only its routes import it. Comics (10): AddIssues, InsertPreview, IssueRow, IssueSearch, NextStrip, QueueBadge, QueueButton, QueueList, QueueShelf, RunChip. Books (40): BetweenBooks, BlockPopover, BookDetail, BookListSearch, BookNote, BookSheetActions, BookShelves, BookSort, CalibreSyncLine, ComingOutLine, FinishBook, GotIt, GroupingBooks, InlineText, ListenNext, OnDeckRow, ParkedDone, ParkedReviewLine, ParkedRow, PlaceThem, PlanQuarter, PlanQuarterRows, PlanRail, PlanSheet, PlanShelf, QuarterStrip, QueueListen, RailDrag, RailStackSheet, ReadAgain, RebalanceSheet, ReleaseDate, RouteSheet, SeriesBooks, SeriesList, SheetLinks, ShelfBooks, ShelfList, TopBooks, YearDecision. Left shared because shared specs test them: AddBooks, AddBooksButton, ByHand, PasteBooks, BookSearch, NewShelf, StartBook. Every other component is shared; a new one defaults to shared;
   - *(Plan revision 1, owner-approved in Phase 2)* a medium's file that a spec of another area imports directly also selects that spec's area (status.spec.ts, shared, imports the books and comics status loading screens; skeletons.spec.ts imports PlanRail). Unit tests are `test/*.test.ts(x)` only: `test/db.ts` and other helpers are imported by the specs, so they are unmapped;
   - anything else selects every area: the roadmap's shared list by name (`src/db/`, `src/lib/`, `etl/views.sql`, `globals.css`, `src/proxy.ts`, `package.json`, the lockfile, Next and Playwright config, `test/e2e/helpers.ts`, `.github/`), the rest as unmapped.
   - Every area also when: not a PR (push to main, the nightly), the `e2e:full` label, no base or a failed diff, or no file selects an area (fails toward all).
2. **The scope script** (`scripts/ci-scope.mjs`) writes `areas` (empty = every area) and `e2e_label`; its log and `$GITHUB_STEP_SUMMARY` name each area with up to five paths and the rule.
3. **D-145 reuse (AC-4)**: shards are named `e2e full n/m` (every area, unchanged) or `e2e full <areas> n/m`. `ranEveryProject` becomes `coveredAreas(jobs)`; a docs-only push reuses an earlier run only when it covered every area the head now needs. An area run never counts as a full pass.
4. **`ci.yml`**: `schedule` nightly at 08:00 UTC (main, every area) in its own concurrency group; `E2E_AREAS` and the label into the e2e job; the scope's base is `origin/${{ github.base_ref }}` (so AC-5's throwaway PR into this branch diffs only its comics file).
5. **Shard balance** (TASK-134's follow-up): the per-project shard units move from `playwright.config.ts` to a lib function that `e2e-shards.mjs balance` shares, reading `E2E_SCOPE`/`E2E_AREAS`, so balance prices the plan the area run made.
6. **Docs**: `.claude/rules/git.md` § *Test on the branch*, `docs/GIT-PR.md` (which PRs run what; a risky PR gets `e2e:full`), `.claude/kit.json` ready-gate text (not in "Files likely touched"), D-173 amending D-80, D-141, D-161: `@critical` tests belong to no area (dnf-reason's stay put); shared specs visiting medium screens don't run on a medium-only PR, with main's push, the nightly and `e2e:full` as the net; a failed nightly emails the owner, and Release refuses that head until it is rerun green.
7. **AC-5**: a throwaway branch off this one changing one comics-screen comment, PR ready with base = this branch; record its run URL, areas and suite time vs main's last full run in this PR's body; the owner closes it.

**Files**: `scripts/lib/ci-scope.mjs`, `scripts/lib/ci-scope.d.mts`, `scripts/ci-scope.mjs`, `.github/workflows/ci.yml`, `scripts/lib/e2e-shards.mjs` (or `e2e.mjs`) + `playwright.config.ts` + `scripts/e2e-shards.mjs` (shared unit plan; not in "Files likely touched"), `test/ci-scope.test.ts`, `test/e2e-shards.test.ts`, `.claude/rules/git.md`, `docs/GIT-PR.md`, `docs/review/decisions.md`, `.claude/kit.json` (gate text).

**Test strategy**: `test/ci-scope.test.ts`: AC-1's map clauses (one per shared root, unmapped, docs-only, vitest-only), AC-2, the event overrides (push, schedule, label), the comics-only plan through `areaPlan`/`areaFilter` on the real specs (no books spec; critical at every core project), AC-4's reuse rule, a guard that each named medium component is imported only by that medium's routes, the script's `areas` output and reasons; ci.yml shape (AC-3 schedule, nightly concurrency, `E2E_AREAS`, the job name, the base). `test/e2e-shards.test.ts`: balance and the config plan the same units for an area run. AC-5 and AC-1's last clause: the throwaway PR (manual).

**Size**: 12 files counting docs; no schema or UI, and 0.15 is already split three ways, so kept whole.

**Risks**: a shared spec on a medium screen is skipped on a medium-only PR (accepted, D-173); the base_ref change also affects stacked PRs (they now diff against their own base, which is the point).

## Review log

_Filled by /implement-task. One line per round._

- Verify R1 PASS | CI R1 PASS (every area, 1f86fd5) | Throwaway PR #328 CI PASS (`e2e full comics`, 2.09 of 43.78 min suite time) | Spec R1 APPROVE (note: api/books and api/shelves mapped to books only) → plan revision 2 | Verify R2 PASS | Audit R1 PASS | Spec R2 APPROVE (the fix's diff) | CI R2 PASS (41302e6) | Follow-ups check APPROVE | Drift R1 update first (behind 1; main changed globals.css, src/db/queries.ts, src/db/writes.ts) → rebased | Verify R3 PASS | CI R3 on the rebased head: see PR

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 2
- Review rounds: 2 (spec)
- First-pass AC FAILs: 0
- Plan revisions after approval: 2 (the spec-import rule; api/books and api/shelves to every area)
