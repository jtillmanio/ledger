---
id: TASK-135
title: 0.15 The browser suite runs by area (2 of 3) — CI runs what a PR's paths can break
status: Ready
depends_on: [TASK-134]
size: M
model: opus
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
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

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves every clause but the guard's, which TASK-134 proves): tests pin the map and the plan: a change only under a medium's own
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
- [ ] AC-2: Given changed files under both `src/app/comics/` and `src/app/books/`, the scope selects `books` and `comics` and not `watch`, `music` or `games`; given one file under `src/components/` that the map does not name, it selects every area.
- [ ] AC-3: `ci.yml` has a `schedule` trigger that runs on `main` with every area, and `test/ci-yml.ts` asserts it; a scheduled run's scope output is every area.
- [ ] AC-4: A docs-only push after a run that covered only some areas does not reuse that run as a full pass under D-145: the plan's rule is pinned by a test in `test/ci-scope.test.ts`.
- [ ] AC-5: The PR body records the comics-only branch's run (its URL, the areas the summary names, its browser time) beside a full run's from `main`, and the ratio is under one half.

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
