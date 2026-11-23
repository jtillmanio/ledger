---
id: TASK-136
title: 0.15 The browser suite runs by area (3 of 3) — the time budget follows the area
status: Draft
depends_on: [TASK-135]
size: S
model: opus
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
---

# TASK-136 — 0.15 The browser suite runs by area (3 of 3) — the time budget follows the area

## Goal

The browser suite's time budget compares each area a PR ran with `main`'s time for that same area, so growth in one medium is named and a one-area PR can't fail because of another area's size.

## Context

- Roadmap: `docs/05-roadmap.md` § 0.15, the bullet *The time budget follows the area* (D-161). Its **Check:** is AC-1, verbatim. Listed in `docs/06-tasklist.md` M9 beside 0.13; not a cutover gate.
- **Split, 3 of 3.** TASK-134 gave specs areas; TASK-135 made CI run the affected ones and recorded the decision that amends D-161. This part changes the `e2e-budget` job to match.
- **Today** (D-161, D-167): `scripts/lib/e2e-budget.mjs` compares the run's per-test times with `main`'s latest recording (`compareTimes(current, baseline, shards)`), fails on more than `GROWTH_LIMIT_MS` (3 minutes) of suite time or a shard over `SHARD_CEILING_MS` (6 minutes), and the `e2e-growth` label accepts growth (`GROWTH_LABEL`). The `e2e-budget` job in `.github/workflows/ci.yml` (around line 222) records `e2e-times.json` and checks it against the baseline's. It only runs at full scope (`FULL_SCOPE`).
- **What changes:** growth is computed per area, each against `main`'s recording of that area's tests (the area of a test comes from TASK-134's area of its spec), and the summary names the area that grew. The per-shard ceiling applies to the shards the PR actually ran. A run over every area behaves as today.
- Tests: `test/e2e-budget.test.ts` (it also keeps the matrix size equal to `ci.yml`'s).
- Decisions: D-161, D-167, and TASK-135's row.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; proven by TASK-134 and TASK-135, and re-run here once the budget reads areas): tests pin the map and the plan: a change only under a medium's own
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
- [ ] AC-2: Given fixture times where a comics-only run's comics tests grew 3.5 minutes over `main`'s comics tests, the check fails naming `comics` and the growth; the `e2e-growth` label turns it into accepted growth.
- [ ] AC-3: Given a comics-only run and a baseline whose books tests grew 4 minutes since an older `main` recording, the check passes: books' tests are not compared, because the run didn't include them.
- [ ] AC-4: Given a run over every area, the check gives the same result as today's `compareTimes` on the same fixture (pinned against a fixture recorded before the change).
- [ ] AC-5: The per-shard ceiling is applied to the shards the run had: a fixture comics-only run with one shard at 6.2 minutes fails naming that shard.

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
