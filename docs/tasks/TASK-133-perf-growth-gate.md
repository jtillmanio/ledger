---
id: TASK-133
title: 0.13 Gate a preview on what its PR adds, not on a ceiling it must raise
status: Ready
depends_on: [TASK-114]
size: M
model: opus
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
---

# TASK-133 — 0.13 Gate a preview on what its PR adds, not on a ceiling it must raise

## Goal

A preview's Lighthouse job fails when its PR grows a route's weight over main's, unless the owner accepts the growth with a label. The per-route ceilings become loose limits that only a decision raises, so a feature no longer starts at its ceiling.

## Context

- Roadmap: `docs/05-roadmap.md` § 0.13 (owner, 2026-11-10; D-142). Its **Check:** is AC-1, verbatim; proposed, and agreed when merged. Listed in `docs/06-tasklist.md` M9 beside 1.30 and 0.14c; pulled ahead of 1.26 (D-172). Feature F-04.
- **D-142 is the rule** (`docs/review/decisions.md`): growth over main's last green run fails at more than 3,000 bytes of JS, more than 10% and 1,500 bytes of document + RSC, or more than 3 requests; the `perf-growth` label accepts it; the owner adds the label, and Claude asks for it in the PR body under **Perf growth** and never adds it; ceilings at the measurement plus 25%, raised only by a decision; requests to another origin reported, not budgeted; the numbers artifact kept 90 days.
- **After 1.30** (done, TASK-073), as the entry says. **After 0.14c (TASK-114)** too, an ordering this task adds: 0.14c measures eight pages under the old rule (plus about 5%), and this task resets every ceiling from one preview. Building 0.13 second resets all of them at once. The owner can reverse that order at the plan gate.
- **This task finishes only with `LIGHTHOUSE_MODE` on** (D-158), like TASK-114: the plus-25% ceilings come from this entry's own preview, measured automatically. The code and the tests can be built before then; the PR waits for the run. Claude never turns `LIGHTHOUSE_MODE` on and never dispatches a run unasked (D-158, D-170). The Check's throwaway branch needs a hand run (`gh workflow run lighthouse.yml --ref <branch>`), which the owner starts or tells Claude to start.
- **The baseline.** `report.mjs baseline` and `baselineRun` (`scripts/perf/lib/perf.mjs`) find main's last green run, and `.github/workflows/lighthouse.yml` downloads its `lighthouse-metrics` artifact (`BASELINE_METRICS`, `BASELINE_PR`). 0.14d (no task file yet) fixes a baseline that picks a run that measured nothing. Until it lands, a growth check can report "no baseline" more often than it should. The plan says whether to convert 0.14d first.
- *From TASK-112 (0.14, PR #280):* since 0.14 a Lighthouse load blocks the RSC prefetches and counts neither them nor their bytes (D-160), so this entry's measurement is prefetch-free. A growth check against a baseline from before 0.14 shows a drop, not growth.
- **The files today.** `scripts/perf/budget.json` holds per route `docRscBytes`, `jsBytes` (each carrying ~140 KB of shared framework and layout JS), `requests`, `a11y`; `scripts/perf/routes.mjs` the routes; `scripts/perf/report.mjs` the comment and the pass/fail; `test/perf.test.ts` holds `docs/02-architecture.md` § Performance budget's table to `budget.json`. Artifacts: the metrics artifact keeps 14 days today (`retention-days: 14`, around line 281).
- **The label re-reports without a push.** The workflow runs on `deployment_status` and by hand today. The plan says how a `labeled` event re-runs only the report against the existing measurement (no new Lighthouse load, no new measured run counted against `LIGHTHOUSE_MONTHLY_CAP`, D-170).
- **The history moves.** § Performance budget's paragraphs on each raise, PR #80 to #224, move to a new `docs/perf-budget-history.md`, which the section links (`docs/archive/` is frozen).
- Decisions: D-142, D-158, D-160, D-170, the 0.10 budget rule it amends.
- *From TASK-114 (0.14c, PR #319):* both of 0.14c's hand runs (2026-11-23) measured `/books` over its 175,000 JS budget: 175,572, then 175,653 bytes (main's JS grew since its last measure; #318 and #320 drew the book sheet's controls and the dashboard rows that open it). The owner left it for this task, so until then every measured run reports that finding.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): `test/perf.test.ts` covers the growth gate on fixture metrics: a route 3,001
bytes of JS over the baseline fails, naming the route, the growth and the
baseline's PR, and 3,000 passes; the `perf-growth` label turns that failure into
accepted growth in the comment; no baseline skips the check and the comment says
so; a request to another origin counts toward no budget. `scripts/perf/budget.json`
holds the shared JS once and `test/perf.test.ts` holds the table in
`docs/02-architecture.md` to it. On a throwaway branch, a client import of
5 KB or more on one route fails the Lighthouse job with that route named, and
adding the label turns the job green with no new push. The job passes on this
entry's own PR, and `lighthouse-metrics` is kept 90 days.
- [ ] AC-2: On fixture metrics, document + RSC growth fails only when it is over both 10% and 1,500 bytes (10% and 1,400 bytes passes, 9% and 2,000 bytes passes, 11% and 1,600 bytes fails), and request growth fails at 4 and passes at 3.
- [ ] AC-3: Every ceiling in `budget.json` is this entry's preview measurement plus 25% (rounded as the plan says), written in the PR body as measured → ceiling per id, and `budget.json`'s `$comment` and § Performance budget say a ceiling is raised only with a decision (D-n).
- [ ] AC-4: § Performance budget keeps the table, the growth limits and how a ceiling is raised, and links `docs/perf-budget-history.md`, which holds every raise paragraph from PR #80 to #224 as it was. `docs/GIT-PR.md` says when to ask for **Perf growth** and that Claude never adds the label.
- [ ] AC-5: The per-route reports' artifacts keep 14 days; only `lighthouse-metrics` changes to 90 (both read from `lighthouse.yml` in a test).

## Out of scope

- 0.14d's baseline fix (unless the plan converts it first as its own task).
- 0.14c's new routes (TASK-114).
- What is measured, the route-handler check, CLS and accessibility: 0.10's, unchanged.
- Turning `LIGHTHOUSE_MODE` on or dispatching a run unasked.
- Timing gates.

## Files likely touched

- `scripts/perf/lib/perf.mjs`, `scripts/perf/report.mjs` — the growth check, the label, other-origin requests.
- `scripts/perf/budget.json` — the shared JS once, per-route own JS, new ceilings.
- `.github/workflows/lighthouse.yml` — the `labeled` re-report, `lighthouse-metrics` at 90 days.
- `test/perf.test.ts` — AC-1, AC-2, AC-5.
- `docs/02-architecture.md` § Performance budget, `docs/perf-budget-history.md` (new), `docs/GIT-PR.md`.

## Verification

- Automated: `test/perf.test.ts` (AC-1's fixture clauses, AC-2, AC-5); `npm run test:no-e2e`.
- Manual: with `LIGHTHOUSE_MODE` on, the PR's automatic run passes and its comment shows the new ceilings (AC-1, AC-3). On a throwaway branch with a 5 KB client import on one route, a hand run fails naming that route → add `perf-growth` → expected: the job re-reports green with no new push and no new measured run. The owner removes the throwaway branch's PR afterwards.

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
