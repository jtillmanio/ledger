---
id: TASK-136
title: 0.15 The browser suite runs by area (3 of 3) — the time budget follows the area
status: Review
depends_on: [TASK-135]
size: S
model: opus
autonomy: attended
ui: false
plan_status: approved
planned_at_commit: 93eb453
---

# TASK-136 — 0.15 The browser suite runs by area (3 of 3) — the time budget follows the area

## Goal

The browser suite's time budget compares each area a PR ran with `main`'s time for that same area, so growth in one medium is named and a one-area PR can't fail because of another area's size.

## Context

- Roadmap: `docs/05-roadmap.md` § 0.15, the bullet *The time budget follows the area* (D-161). Its **Check:** is AC-1, verbatim. Listed in `docs/06-tasklist.md` M9 beside 0.13; pulled ahead of 1.26 (D-172).
- **Split, 3 of 3.** TASK-134 gave specs areas; TASK-135 made CI run the affected ones and recorded the decision that amends D-161. This part changes the `e2e-budget` job to match.
- **Today** (D-161, D-167): `scripts/lib/e2e-budget.mjs` compares the run's per-test times with `main`'s latest recording (`compareTimes(current, baseline, shards)`), fails on more than `GROWTH_LIMIT_MS` (3 minutes) of suite time or a shard over `SHARD_CEILING_MS` (6 minutes), and the `e2e-growth` label accepts growth (`GROWTH_LABEL`). The `e2e-budget` job in `.github/workflows/ci.yml` (around line 222) records `e2e-times.json` and checks it against the baseline's. It only runs at full scope (`FULL_SCOPE`).
- **What changes:** growth is computed per area, each against `main`'s recording of that area's tests (the area of a test comes from TASK-134's area of its spec), and the summary names the area that grew. The per-shard ceiling applies to the shards the PR actually ran. A run over every area behaves as today.
- Tests: `test/e2e-budget.test.ts` (it also keeps the matrix size equal to `ci.yml`'s).
- Decisions: D-161, D-167, and TASK-135's row.
- *From TASK-134 (0.15, PR #323):* a file planned only for its `@critical` tests (routes, book-search, dnf-reason, shell, at the core projects) counts its whole recorded time in the shard plan, because `shard-times.json` records files, not tests. The area budget overestimates those files: it should price them by their `@critical` tests' own times, or say it doesn't.
- *From TASK-135 (0.15, PR #327):* CI now gives the budget job `E2E_AREAS` and `E2E_SCOPE` (`needs.scope.outputs.areas`, empty for every area); read them there. An area run's `e2e-times.json` holds only its areas and the critical set, so today's `compareTimes` counts every test main ran outside those areas as removed (a large negative growth and a long "gone" count in the summary): compare per area as planned. Also open: a one-area run still builds on all ten shards for about two minutes of tests (comics-only, PR #328: 2.1 min of suite time, 15.1 job-minutes against main's 57.3), so decide whether an area run takes fewer shards, or record that it doesn't.

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim; proven by TASK-134 and TASK-135, and re-run here once the budget reads areas): tests pin the map and the plan: a change only under a medium's own
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
- [x] AC-2: Given fixture times where a comics-only run's comics tests grew 3.5 minutes over `main`'s comics tests, the check fails naming `comics` and the growth; the `e2e-growth` label turns it into accepted growth.
- [x] AC-3: Given a comics-only run and a baseline whose books tests grew 4 minutes since an older `main` recording, the check passes: books' tests are not compared, because the run didn't include them.
- [x] AC-4: Given a run over every area, the check gives the same result as today's `compareTimes` on the same fixture (pinned against a fixture recorded before the change).
- [x] AC-5: The per-shard ceiling is applied to the shards the run had: a fixture comics-only run with one shard at 6.2 minutes fails naming that shard.

## Out of scope

- The map, the scope job and which specs run (TASK-135).
- Changing `GROWTH_LIMIT_MS`, `SHARD_CEILING_MS` or the shard count.
- Recording per-area baselines anywhere but the existing `e2e-times.json` artifact.

## Files likely touched

- `scripts/lib/e2e-budget.mjs`, `scripts/lib/e2e-budget.d.mts` — per-area comparison and summary.
- `scripts/e2e-budget.mjs` — passes the run's areas, if the plan needs it.
- `.github/workflows/ci.yml` — the `e2e-budget` job reads the areas.
- `test/e2e-budget.test.ts` — AC-2 to AC-5.

## Verification

- Automated: `test/e2e-budget.test.ts` (AC-2 to AC-5); `npm run test:no-e2e`.
- Manual: the PR's own CI run → expected: the `e2e-budget` summary lists each area it ran with its time against `main`'s.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- Decision row, amending D-161 and finishing D-173 (5): the growth limit stays the PR's total and names each area that grew; an area run's ceiling applies to each of its shards, priced by the tests it ran; an area present only through `@critical` tests compares only those tests (approved at plan; its (4), the shard count left to roadmap 0.16, at close-out) → docs/review/decisions.md § D-174
- *From TASK-135:* a one-area run still builds on all ten shards for about two minutes of tests (PR #328: 2.1 min of suite time, 15.1 job-minutes); this task's Out of scope fixes the shard count, so the scope job sizing the matrix from the run's plan is new work (owner, at close-out) → docs/05-roadmap.md § 0.16 (new)
- Spec-reviewer: the area-run path (per-shard times, `(critical set)` rows) shows only on an area-only PR's CI; this PR changes `scripts/` and `.github/`, so its own run covers every area → not tracked: proven by the script test in `test/e2e-budget.test.ts`, and the next area-only PR's `e2e-budget` summary shows it

## Plan

Approved 2026-11-23 at 93eb453.

**Steps**

1. Record `test/fixtures/e2e-budget-every-area.json` with today's `compareTimes` + `budgetProblems` (books, comics and shared keys; added, removed and known tests; each key's area) before any change: AC-4's pin.
2. `scripts/lib/e2e-budget.mjs`: `compareAreas(current, baseline, shards, areaOf, areas)`. Main's tests count only for the areas the run selected; an area present only through `@critical` tests compares only the tests it ran (main's newer tests there are not "removed", AC-3). Returns today's comparison over that slice plus per-area rows (`area` or `critical set`); with `areas` null the slice is everything, so the total is today's `compareTimes` exactly (AC-4). `shardTimes(plan, current, baseline)`: each shard of the run's plan priced by its tests' projected times (main's time for a test main also ran), so a critical-only file counts only its `@critical` tests (TASK-134's note).
3. `budgetProblems`: the 3-minute growth limit stays on the PR's total; the message names each area that grew (`— comics +3.5 min`, AC-2; `e2e-growth` still accepts). The ceiling: a run over every area as today (the mean shard); an area run per shard of its plan (`shard 4 of 10 … 6.2 min`, AC-5).
4. `renderSummary`: an area table (this run vs main's, growth), and the shard times for an area run.
5. `scripts/e2e-budget.mjs check`: reads `E2E_AREAS` / `E2E_SCOPE`, each spec's area from `test/e2e/*.spec.ts`, and builds the run's plan (`plannedProjects` → `plannedUnits` → `planShards`, as `balance` does).
6. `.github/workflows/ci.yml`: *Within the budget* gets `E2E_AREAS` and `E2E_SCOPE` from the scope job.
7. `docs/GIT-PR.md`, `docs/COMMANDS.md`: the budget sentences.

**Files**: `scripts/lib/e2e-budget.mjs`, `scripts/lib/e2e-budget.d.mts`, `scripts/e2e-budget.mjs`, `.github/workflows/ci.yml`, `test/e2e-budget.test.ts` (listed); `test/fixtures/e2e-budget-every-area.json` (new, AC-4's recorded fixture), `docs/GIT-PR.md`, `docs/COMMANDS.md` (they describe the budget) (not listed).

**Test strategy** (`test/e2e-budget.test.ts`): AC-2 comics +3.5 min fails naming comics, the label accepts; AC-3 comics-only run vs a baseline whose books grew 4 min passes (a design pricing main's whole suite would fail the ceiling); AC-4 every area equals the recorded fixture's comparison, each problem starts with the recorded text; AC-5 a plan with one shard at 6.2 min fails naming it; a script test with `E2E_AREAS=comics`; ci.yml passes `E2E_AREAS`. AC-1: the existing ci-scope, e2e-guard and e2e-shards tests in `test:no-e2e`.

**Decided at the gate**: a run over every area keeps today's mean-shard ceiling (AC-4; D-167 made imbalance a note); an area run's is per shard.

## Review log

Verify R1 FAIL (vitest ran from c:, every file "failed to find the runner"; tsc and lint passed) → R2 PASS | CI R1 PASS (run 45254682118, every area, `e2e-budget` pass) | Spec R1 APPROVE | Audit R1 PASS (8 of 21 fail at base; the ci.yml test with ci.yml reverted too) | Follow-ups check R1 CHANGES (D-161 lacked "Amended by D-174") → R2 APPROVE | Roadmap 0.15 ticked; task list 0.15 Done

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 2 (R1 an environment failure, no code change)
- Review rounds: 1
- First-pass AC FAILs: 0
- Plan revisions after approval: 0
