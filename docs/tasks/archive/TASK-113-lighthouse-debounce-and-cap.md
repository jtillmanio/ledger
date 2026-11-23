---
id: TASK-113
title: 0.14b Automatic runs are debounced and capped
status: Done
depends_on: [TASK-112]
size: M
model: opus
autonomy: attended
ui: false
plan_status: approved
planned_at_commit: 75c88db
---

# TASK-113 — 0.14b Automatic runs are debounced and capped

## Goal

With `LIGHTHOUSE_MODE` on, a burst of pushes to one PR gets one measurement, not one per push. A busy month stops measuring automatically once it reaches a set number of runs, so Lighthouse can't push the Vercel account past its Active CPU allowance. Hand runs still measure whenever the owner asks.

## Context

- Roadmap: `docs/05-roadmap.md` § 0.14b (its **Check** is AC-1, verbatim). It comes after 0.14 (TASK-112), so the per-run cost the cap is sized against is the cheap one.
- Decisions: **D-158** (the switch, the manual run's replay of `deployment_status`, `dry_run`; Claude never turns the switch on or dispatches a run unasked).
- How a run is decided today: `.github/workflows/lighthouse.yml`. The `plan` job's `if` gates the deployment trigger on `vars.LIGHTHOUSE_MODE == 'on'`. *Find the branch's preview* replays a hand run as `deployment_status`. `node scripts/perf/report.mjs plan` (`plan()`) finds the PR, skips a PR whose app didn't change (`unchangedApp`) and sets the concurrency group `pr-<n>`. The measure and report jobs are cancelled by a newer run in the same group, but only after the plan job has started them.
- The evidence for a cap: measured runs per day reached 37 (2026-11-10), 20 (11-13) and 23 (11-16), against about 22 s of CPU each before 0.14.
- **For the plan gate: the wait.** How long, and where it happens. Options: sleep in the `plan` job and then compare the commit with the PR's head through the API; or a concurrency group on `plan` itself with `cancel-in-progress`; or both. Sleeping holds a runner, and Actions minutes are free on a public repo. Say what the PR sees while a run waits.
- **For the plan gate: counting the month.** What counts as one automatic measured run: a `lighthouse.yml` run whose trigger was a real `deployment_status` (not a hand run's replay) and whose `measure` job ran. How `plan()` counts them (the Actions runs and jobs API, with `actions: read`), the cap's default when `LIGHTHOUSE_MONTHLY_CAP` is unset, and which month (UTC calendar month).
- **For the plan gate: how a hand run is told apart.** After the D-158 replay, a hand run and an automatic one both reach `plan()` as `deployment_status`. The plan names the signal that tells them apart (for example, the real `github.event_name` passed on separately).
- A skipped automatic run says why on the PR, in the comment the job already keeps (`findComment` / `MARKER` in `scripts/perf/lib/perf.mjs`), or in a short status. The plan says which.

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim): tests pin both rules: a commit that is no longer the PR's head after the wait is not measured, and with a cap of N the next automatic run that month is skipped, with a PR comment giving the reason. A `dry_run` hand run on the PR prints what an automatic run would decide (wait and cap) and loads no page. Nothing turns `LIGHTHOUSE_MODE` on.
- [x] AC-2: Given an automatic run for commit A when the PR's head is B after the wait, `plan` outputs no URL and logs `Not measuring #<n>: <A> is no longer the head (<B> is)`. Given A is still the head, it measures. Both are tested on a pure function in `scripts/perf/lib/perf.mjs`, fed fixtures.
- [x] AC-3: Given `LIGHTHOUSE_MONTHLY_CAP=2` and two automatic measured runs already this UTC month, a third automatic run outputs no URL and its PR comment says the cap was reached, with the count and the cap. A hand run in the same state measures. When the variable is unset, the default named in `docs/COMMANDS.md` applies. Tested on fixtures.
- [x] AC-4: `docs/COMMANDS.md`, `docs/GIT-PR.md` and the `lighthouse.yml` header document the wait, the cap variable and its default, and that a hand run is exempt from both.

## Out of scope

- Turning `LIGHTHOUSE_MODE` on or setting `LIGHTHOUSE_MONTHLY_CAP` in the repo. The owner sets both.
- Making each run cheaper: 0.14 (TASK-112).
- Reading Vercel's own usage numbers. The cap counts runs, not CPU.
- Changing what fails the job: 0.13.

## Files likely touched

- `.github/workflows/lighthouse.yml`: the wait, `actions: read` for counting, the header
- `scripts/perf/report.mjs`: `plan()` applies the wait and the cap; the skip message on the PR
- `scripts/perf/lib/perf.mjs`: the pure decisions (still the head? under the cap?)
- `test/perf.test.ts`: the fixtures for both rules, and the workflow pins
- `docs/COMMANDS.md`, `docs/GIT-PR.md`: the wait, the cap and its default

## Verification

- Automated: `test/perf.test.ts`: the head check (head moved → not measured; head same → measured), the cap (N reached → skipped with reason; hand run → measured; unset → default), and that the workflow passes the real event name to `plan`. `npm run test:no-e2e` green.
- Manual (owner, no Active CPU): `gh workflow run lighthouse.yml --ref <branch> -f dry_run=true` on this PR → expected: the log says what an automatic run would decide, with the wait and the month's count against the cap, and `measure` and `report` are skipped.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- Decision: an automatic run waits 300 s and measures only the PR's head; the cap defaults to 100 automatic measured runs a UTC month, counted from the Actions runs and jobs API; a count that can't be read means not measured; a hand run is exempt (approved at plan) → docs/review/decisions.md § D-170
- `baselineRun` takes the newest green run on the last merged PR's head, and a plan-only run (cap-skipped, a dry run, an unchanged app) is green with no metrics, so the comparison loses its baseline: pick a run whose `report` job ran (approved at plan) → docs/05-roadmap.md § 0.14d (new; its **Check:** is a proposal), with its row in docs/06-tasklist.md beside 0.14b and in F-04's coverage row
- Spec review note: counting near the cap costs about one API request per candidate run; a rate limit falls into "can't count, not measuring" → docs/review/decisions.md § D-170 (recorded as accepted)
- Spec review note: a cap skip replaces the PR's last measured numbers in the one comment, as planned → not tracked: accepted as planned (the next measured run rewrites it)
- Spec review note: an automatic run whose commit no open PR names skips the head check and goes on to the cap, as before 0.14b → not tracked: accepted as is (no PR to compare a head with)

## Plan

_Written by /plan-batch or /implement-task Phase 1. Approved by the user (plan_status: approved) before any code is written._

Approved 2026-11-22 (owner: "approve plan, go with recommendations").

**Answers to the plan-gate questions.**
- *The wait*: in `plan()` itself (`report.mjs`), 300 s (`DEBOUNCE_SECONDS`), only when the real trigger is `deployment_status`; then the PR is looked up (so a PR opened just after the push is found) and its `head.sha` compared with the deployment's commit. No concurrency group on `plan`: GitHub's `deployment_status` payload names no PR to key it on, and the measure/report groups stay as they are. Actions minutes are free on a public repo. While a run waits, the PR shows the Lighthouse `plan` check running for about 5 minutes; a superseded run ends green with the log line `Not measuring #<n>: <A> is no longer the head (<B> is)` and writes no comment (the newer run answers). `plan`'s timeout goes 5 → 12 minutes.
- *Counting the month*: the UTC calendar month (`monthStart`). `plan()` lists `lighthouse.yml` runs with `event=deployment_status`, `created>=<month start>`, one query per status that can have measured (`success`, `failure`, `cancelled`, `in_progress`; skipped runs, which every status Vercel sends while the switch is off makes, are never fetched), leaves out this run, and asks the jobs API of each, newest first, whether a `measure` job reached a runner (`measureRan`: not skipped, has steps). It stops at the cap. Needs `actions: read` on `plan`. Default when `LIGHTHOUSE_MONTHLY_CAP` is unset or blank: 100 (about 12 min of Active CPU at 0.14's ≤ 7 s a run, 5% of the 4 h; 37 min even at the old 22 s). A value that isn't a whole number fails the job. A count that can't be read means not measuring (D-158: a paused account is worse than an unmeasured PR).
- *Hand run vs automatic*: `REAL_EVENT_NAME: ${{ github.event_name }}` passed beside the replayed `EVENT_NAME`. A hand run (`workflow_dispatch`) neither waits nor is capped.
- *The skip message*: the cap skip writes the one PR comment (`MARKER`, edited in place, `renderCapComment`); `plan` gets `pull-requests: write` for it (as `report` has). The head skip only logs.
- *Dry run*: `DRY_RUN: ${{ inputs.dry_run }}`; plan prints what an automatic run would decide (the wait, whether the commit is the PR's head now, the month's count against the cap), waits for nothing and writes no comment; measure and report stay skipped.

**Steps.**
1. `scripts/perf/lib/perf.mjs`: `DEBOUNCE_SECONDS`, `DEFAULT_MONTHLY_CAP`, `monthlyCap(value)`, `monthStart(now)`, `notHead({ number, sha, head })`, `automaticCandidates(runs, { since, exclude })`, `measureRan(jobs)`, `capReached({ count, cap, since })`, `renderCapComment({ sha, count, cap, since, branch })`; types in `perf.d.mts`.
2. `scripts/perf/report.mjs` `plan()`: the wait, the head check, the count and the cap, the cap comment, the dry run's report.
3. `.github/workflows/lighthouse.yml`: `plan`'s permissions, timeout and env; the header.
4. `test/perf.test.ts`: fixtures for every helper, and source pins on the workflow and `plan()`.
5. `docs/COMMANDS.md`, `docs/GIT-PR.md`: the wait, the cap variable and its default, a hand run exempt from both.

**Files.** `scripts/perf/lib/perf.mjs`, `scripts/perf/lib/perf.d.mts` (not in the likely list: the types beside it), `scripts/perf/report.mjs`, `.github/workflows/lighthouse.yml`, `test/perf.test.ts`, `docs/COMMANDS.md`, `docs/GIT-PR.md`. 7 files, no schema or UI.

**Tests.** AC-2: `notHead` (moved → the message; same → null) and a pin that `plan()` checks it before `output("url"`. AC-3: `capReached` at 2 of 2 → reason with count and cap; `renderCapComment` starts with `MARKER` and gives count and cap; `monthlyCap("")`/`undefined` → `DEFAULT_MONTHLY_CAP`, matching the number in `docs/COMMANDS.md`; `automaticCandidates` leaves out hand runs, last month's runs and this run; `measureRan` counts a measure job that ran, not a skipped or never-started one; a pin that `plan()` applies wait and cap only when `REAL_EVENT_NAME` is `deployment_status`. AC-1: those plus the workflow pins (`REAL_EVENT_NAME: ${{ github.event_name }}`, `DRY_RUN`, `actions: read`) and the existing "switch" pins unchanged. AC-4: by review, plus a pin that the three docs name `LIGHTHOUSE_MONTHLY_CAP`. Manual: the owner's `dry_run` hand run.

**Revision 1 (after the test audit, R1).** The choice of which runs wait and decide moved into a pure `gates({ realEventName, dryRun })` in `perf.mjs`, tested on fixtures (a hand run neither waits nor decides; a real `deployment_status` does both; a dry run decides without acting); `plan()` is pinned to `gate.wait` / `gate.decide`, and to the `return` that ends the cap's skip. Same files.

**Revision 2 (after the owner's dry run, run 45112285873, accepted 2026-11-22).** The dry run's `plan` took 3 min 19 s: the count read 197 runs' jobs one at a time, and a month at the cap would recount on every run, about 200 API requests each. The owner approved three changes: `countMeasured` reads the jobs ten at a time (`COUNT_CONCURRENCY`) and stops at the cap; the first run the cap stops leaves an artifact (`capMarkerName`, uploaded by a new step in the `plan` job, 31 days), which later runs that month find with one request and skip the count; a dry run's last line reads "A hand run would measure …". Same files, plus D-170 and `docs/COMMANDS.md` (also: a head Vercel skipped needs `-f url=`).

## Review log

_Filled by /implement-task. One line per round._

- Verify R1 PASS (`7ec6a60`; perf.test.ts 13 new tests failed first, then 66/66) | CI R1 PASS (run 45028141638: tests, e2e full 10/10, Vercel) | Spec R1 APPROVE (3 non-blocking notes, placed in Follow-ups) | Claude PR review: no issues | Audit R1 CHANGES (AC-3 hand run UNPROVEN: a source-string pin) → `gates()` on fixtures | Verify R2 PASS (`32941e9`) | Audit R2 PASS (mutations killed; one gap: the cap skip's `return` unpinned) → pinned, checked by removing it (fails) | Verify R3 PASS | Spec R2 APPROVE (the fixes' diff and the close-out follow-ups check) | Owner dry run (run 45112285873): passed, but `plan` 3 min 19 s → revision 2 | Verify R4 PASS (`a1a5260`; a books-dashboard test timed out under load, passed alone) | Spec R3 APPROVE | Audit R3 CHANGES (the cap clamp unproven: the only capped case ended on a batch boundary) → a mid-batch cap, checked by removing the clamp (fails)

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 4 (one per head: the change, the audit fix, the cap-return pin, revision 2)
- Review rounds: 2 (spec APPROVE ×2; audit CHANGES → PASS)
- First-pass AC FAILs: 0 (one UNPROVEN test: AC-3's hand run)
- Plan revisions after approval: 2 (`gates()`, from the audit; the faster count and the cap marker, from the owner's dry run)
