---
id: TASK-113
title: 0.14b Automatic runs are debounced and capped
status: Ready
depends_on: [TASK-112]
size: M
model: opus
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
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

- [ ] AC-1 (roadmap **Check:**, verbatim): tests pin both rules: a commit that is no longer the PR's head after the wait is not measured, and with a cap of N the next automatic run that month is skipped, with a PR comment giving the reason. A `dry_run` hand run on the PR prints what an automatic run would decide (wait and cap) and loads no page. Nothing turns `LIGHTHOUSE_MODE` on.
- [ ] AC-2: Given an automatic run for commit A when the PR's head is B after the wait, `plan` outputs no URL and logs `Not measuring #<n>: <A> is no longer the head (<B> is)`. Given A is still the head, it measures. Both are tested on a pure function in `scripts/perf/lib/perf.mjs`, fed fixtures.
- [ ] AC-3: Given `LIGHTHOUSE_MONTHLY_CAP=2` and two automatic measured runs already this UTC month, a third automatic run outputs no URL and its PR comment says the cap was reached, with the count and the cap. A hand run in the same state measures. When the variable is unset, the default named in `docs/COMMANDS.md` applies. Tested on fixtures.
- [ ] AC-4: `docs/COMMANDS.md`, `docs/GIT-PR.md` and the `lighthouse.yml` header document the wait, the cap variable and its default, and that a hand run is exempt from both.

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
