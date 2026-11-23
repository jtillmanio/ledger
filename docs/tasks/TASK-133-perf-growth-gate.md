---
id: TASK-133
title: 0.13 Gate a preview on what its PR adds, not on a ceiling it must raise
status: In progress
depends_on: [TASK-114]
size: M
model: opus
autonomy: attended
ui: false
plan_status: approved
planned_at_commit: 7b745ff
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

- 0.14d is absorbed by this task (owner, plan gate 2026-11-23): its Check is met by step 4's `baselineRun`, so it is ticked at close-out with this task's items (approved at plan).
- Owner steps the Check needs, for the Owner checklist: enable the Lighthouse workflow (`disabled_manually` since D-158), create the `perf-growth` label, start the two measured runs on this PR and the throwaway branch's run (approved at plan). For the throwaway branch, add the import on `/books` (or `/books/status`, `/book/[id]`): only those have more than 5 KB of room under their own-JS ceilings, so elsewhere the ceiling fails too and the label can't turn it green. Make it 5 KB or more *compressed*, since JS is counted as transferred (spec review, R1).
- `test/reading-log.test.tsx` › "drawn open with its read count (the book page, task 0.14c), no read loads until All reads is pressed" failed once in the full `test:no-e2e` run (`list()` null at line 691) and passed 3 of 3 alone: a flake under load, in code this task doesn't touch (0.14c's).
- Candidate decision: a ceiling is the measurement plus 25%, never less than the measurement plus one PR's growth limit (amends D-142's "plus 25%"; owner chose it at revision 1). Proposed at close-out.

## Plan

Approved at the plan gate, 2026-11-23. The owner folded the baseline fix into this task (0.14d absorbed) and kept it whole.

**Finding behind step 4.** `baselineRun` reads only the last merged PR's *head* commit, which is nearly always a docs-only close-out with no preview (PR #319's hand runs were on `e49dc0f` and `cd5f93c`, its head is `3b7f908`), so the growth gate would find no baseline on almost every PR.

**Steps**

1. `summariseLhr` records `scripts` (each same-origin script's path → bytes) and `otherOriginRequests`; `requests` counts only the document's own origin. Both reach `metrics.json` through `measure.mjs` unchanged.
2. Shared JS: `sharedScripts(routes)` is the scripts every measured route loaded; `sharedJs` / `ownJs` split each route's JS. `budget.json` holds `shared.jsBytes` once and each route's own `jsBytes`; `gateProblems` checks both.
3. Growth gate: `growthProblems(current, baseline)` with D-142's limits (JS > 3,000 bytes; document + RSC > 10% and > 1,500 bytes; requests > 3), each naming the route, the growth and the baseline's PR. `report()` reads the PR's live labels: with `perf-growth` the growth is listed as accepted in the comment, not a problem. No baseline: skipped, and the comment says so. A route the baseline lacks is skipped by name.
4. Baseline (0.14d, widened): `baselineRun(runs)` takes runs with their jobs and returns the newest whose `report` job concluded success; `findBaseline` walks the merged PRs newest first, reading each one's runs on its branch up to its merge, past PRs with no such run.
5. Label re-report: `pull_request: [labeled, unlabeled]` for `perf-growth` runs a `rejudge` job (`report.mjs rejudge`, `actions: write`) that re-runs only the `report` job of the head commit's newest run whose `report` ran (`rejudgeTarget`). Same run, no new load, not counted against the cap. The report job's metrics upload runs on attempt 1 only.
6. `lighthouse-metrics` kept 90 days; the per-route artifacts stay 14.
7. `report.mjs ceilings <metrics.json> [--write]` prints (or writes) `budget.json` from a run (`ceilingsFrom`): the larger of measurement × 1.25 and measurement + D-142's growth limit (JS 3,000, document + RSC 1,500, requests 3), bytes up to the next 100, requests up to a whole number, accessibility as measured. Applied from this PR's own preview; until then `budget.json` holds the same rule applied to PR #319's 2026-11-23 hand run (run 45184508856), the latest measurement. *(Revision 1, owner 2026-11-23: on #319's reports a route's own JS is 0–25.5 KB, so a strict +25% left `/login` 0 bytes and `/comics/runs` 292 of room, under the 3,000 one PR may grow.)*
8. Docs: § Performance budget keeps the table, the growth limits, how a ceiling is raised (a decision, D-n) and the rules still in force; every paragraph after the table moves verbatim to `docs/perf-budget-history.md`, linked. `budget.json` `$comment`; `docs/GIT-PR.md` **Perf growth**; `docs/COMMANDS.md` the `ceilings` command.
9. Measured runs, started by the owner (D-158): a hand run on this branch → apply `ceilings` → push → a second run passes. After merge: the throwaway branch's 5 KB import, then the label.

**Files**: `scripts/perf/lib/perf.mjs`, `scripts/perf/lib/perf.d.mts` (types; not in Files likely touched), `scripts/perf/report.mjs`, `scripts/perf/budget.json`, `.github/workflows/lighthouse.yml`, `test/perf.test.ts`, `docs/02-architecture.md`, `docs/perf-budget-history.md` (new), `docs/GIT-PR.md`, `docs/COMMANDS.md` (not listed: the new command).

**Test strategy** (`test/perf.test.ts`): AC-1 fixture clauses (3,001 / 3,000 bytes, the label, no baseline, other origin, shared JS once, the table); AC-2's four document + RSC cases and requests 4 / 3; `baselineRun` per 0.14d's Check, `findBaseline` walking back; `rejudgeTarget` and the workflow's label trigger; AC-5's retentions read from `lighthouse.yml`. AC-1's throwaway branch and AC-3's measurement are manual (owner's runs).

**Risks**: Turbopack re-splitting a shared chunk moves its bytes into every route's own JS (growth still names the real change; 25% headroom). The workflow is disabled and the label doesn't exist yet: both are the owner's.

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
