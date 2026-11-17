---
id: TASK-112
title: 0.14 A measured deploy costs a third of what it did
status: Draft
depends_on: []
size: M
model: opus
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
---

# TASK-112 — 0.14 A measured deploy costs a third of what it did

## Goal

A Lighthouse measurement of a preview spends about a third of the Vercel Active CPU it does today. It still catches everything the job gates, so the owner can afford to turn `LIGHTHOUSE_MODE` back on.

## Context

- Roadmap: `docs/05-roadmap.md` § 0.14 (its **Check** is AC-1, verbatim). Built on 0.10 (the job) and 0.9 (the tap runner): `docs/05-roadmap.md` § 0.10, `docs/archive/TASKS.md` for 0.10 as built.
- Decisions: **D-158** (the switch; why this entry exists; the evidence), D-142 (0.13: growth over main, still open), D-141 (the browser suite is CI's).
- Architecture: `docs/02-architecture.md` § Performance budget (it says "three runs per route" and quotes medians of three).
- The evidence (Vercel Observability, 2026-11-16, 7am–7pm, 15 measured deploys): `/_not-found` 781 invocations; `/books`, `/comics`, `/settings` and `/watch` 2.3K each (nav prefetches); `/comics/[runId]` 4.6K (visible run links prefetched); `/api/login` 240; about 22 s of Active CPU per measured deploy, with prefetches about 60% of it.
- How a route is measured today (`scripts/perf/measure.mjs`): `RUNS` (default 3) Lighthouse loads, each a CLI run in a fresh profile, then `taps()`, which runs `RUNS` times. Each tap run opens a new context, loads `route.tap.from` with `waitUntil: "networkidle0"` ("every prefetch the page makes is done before the tap"), and taps. `phoneTab()` records every `/api/*` request, including prefetches, into `tapApiRequests`. That is where a route handler requested by a prefetch is caught. **For the plan gate:** say which of the Lighthouse load and the tap run also feed the route-handler gate (`apiPath`, `summariseLhr`, `gateProblems` in `scripts/perf/lib/perf.mjs`), and show that blocking `_rsc=` in the Lighthouse load loses none of it.
- **For the plan gate: one run against medians of three.** The budgets in `scripts/perf/budget.json` were set from medians of three. Using the per-load numbers in recent `lighthouse-metrics` artifacts (main's last runs; they're kept for 14 days), say how far one load's bytes and requests differ from the median per route. Say whether a single load can cross a budget the median doesn't, and what the plan does about it.
- **For the plan gate: what the numbers will do.** With prefetches blocked in the Lighthouse load, its request count and RSC bytes drop. The first run after this compares with main's three-run baseline, so the PR comment shows a drop. Say whether the budgets or the architecture doc's table change in this PR, or stay until 0.13.
- The proxy (`src/proxy.ts`): its matcher already leaves out `favicon.ico`, but the app has no icon, so the request renders `/_not-found`. `robots.txt` is not left out, so a signed-out request redirects to `/login`. There is no `public/` folder yet.
- Testing it costs Active CPU. A hand run on this PR is the owner's call (D-158: Claude never dispatches one unasked). Ask the owner to run it, or run it once they say to. `LIGHTHOUSE_MODE` stays off. The workflow may still be disabled (D-158): enable it only for the dispatch and disable it again straight after.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): a hand run on this entry's PR (`gh workflow run lighthouse.yml --ref <branch>`) measures every route with one Lighthouse load and one tap run and passes. No Lighthouse load's network log holds a `_rsc=` request. On a throwaway branch, a `<Link href="/api/export">` put back in the nav still fails the job with that request named. On the preview, `/favicon.ico` (or the app icon) and `/robots.txt` answer 200 with no redirect to `/login`. Vercel Observability shows no `/_not-found` invocation during the run, and the run's Active CPU is a third or less of a 3-run measurement.
- [ ] AC-2: `measure.mjs` with no `RUNS` set makes exactly one Lighthouse load and one tap run per route, and the merged `metrics.json` says `runs: 1`. `RUNS=3` still gives three of each, for a hand comparison. A test in `test/perf.test.ts` pins the default.
- [ ] AC-3: The Lighthouse load's CLI arguments block Next's RSC prefetch requests (`_rsc=`), and the tap run's don't. A test in `test/perf.test.ts` fails if the block reaches the tap run or leaves the Lighthouse load.
- [ ] AC-4: Signed out, `GET /robots.txt` returns 200 `text/plain` with `Disallow: /`, and `GET /favicon.ico` returns 200 with an image type. Neither goes through `proxy()`. `test/health.test.ts` (or the test that already pins the matcher) fails if either is matched.
- [ ] AC-5: Every place that says "three runs per route" or "median of three" about how the job measures from now on says one run: the `lighthouse.yml` header, `measure.mjs`'s header, `docs/02-architecture.md` § Performance budget and `docs/GIT-PR.md`. The past measurements quoted as medians of three keep their wording.

## Out of scope

- The debounce and the monthly cap: 0.14b (TASK-113).
- Changing what fails the job (growth over main, budgets that exclude other origins, a 90-day baseline): 0.13. Don't raise or lower any budget here unless the plan gate decides it.
- Turning `LIGHTHOUSE_MODE` on, or re-enabling the workflow for good.
- Turning off `<Link>` prefetching in the app. The tap runner depends on it (0.9) and so does real navigation.
- A designed app icon. This is a placeholder until the owner has one.

## Files likely touched

- `scripts/perf/measure.mjs`: `RUNS` default, the Lighthouse CLI's blocked URL pattern, the header
- `scripts/perf/lib/perf.mjs`: only if the route-handler gate needs to know which load blocked prefetches
- `.github/workflows/lighthouse.yml`: the header comment (three runs)
- `src/proxy.ts`: the matcher leaves out `robots.txt` (and the icon path, if it isn't `/favicon.ico`)
- `src/app/favicon.ico` or `src/app/icon.svg`: the placeholder icon (Next serves both statically)
- `src/app/robots.txt` or `public/robots.txt`: static, `Disallow: /`
- `test/perf.test.ts`, `test/health.test.ts`: the pins above
- `docs/02-architecture.md`, `docs/GIT-PR.md`: one run per route

## Verification

- Automated: `test/perf.test.ts` (the `RUNS` default and where the `_rsc=` block applies), `test/health.test.ts` (the matcher leaves out the icon and `robots.txt`), and an e2e or route test showing that signed out, `/robots.txt` and `/favicon.ico` answer 200 rather than 307. `npm run test:no-e2e` green.
- Manual (owner, costs Active CPU): the hand run in AC-1 → expected: green, `runs: 1` in the comment. In Vercel → Observability → Functions, filtered to the preview's deployment for the run's window → expected: no `/_not-found`, and Active CPU of a third or less of a three-run measurement (about 7 s or less).
- Manual: the throwaway branch with `<Link href="/api/export">` in the nav → expected: the job fails naming `/api/export`; removing the link → green. A dispatch on the throwaway branch costs one more run, so the owner says when.

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
