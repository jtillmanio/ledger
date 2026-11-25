---
id: TASK-150
title: 0.14f The books screens that wait a second are timed and explained
status: Ready
depends_on: []
size: M
model: opus
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
---

# TASK-150 — 0.14f The books screens that wait a second are timed and explained

## Goal

Every books screen has a measured server time against the development database, cold and warm, and each one that takes over half a second warm has a named cause, fixed here when the fix is one query.

## Context

- Roadmap: `docs/05-roadmap.md` § 0.14f The books screens that wait a second are timed and explained (M9 in `docs/06-tasklist.md`; Phase 0's, listed beside 0.14e; not a cutover gate). Feature F-04. Its **Check:** is AC-1, verbatim; proposed in PR #342 and agreed when it merged (2026-11-25).
- Owner intake, 2026-11-24 (*some db calls seem to take a second*). 0.14c measures what a page costs the browser on the preview (`scripts/perf/measure.mjs`, `routes.mjs`, `budget.json`); nothing times the server's side against a real database.
- **The development database only.** Loading screens through the running app (`npm run dev`) may read the development database without asking (owner, 2026-10-09). Anything aimed at it directly (`EXPLAIN` through `psql`, a query log) is touching a database that isn't `TEST_DATABASE_URL`: the plan names it and asks first (CLAUDE.md). Production is never timed.
- **Where the time goes.** The query waves are in `src/db/queries.ts` (raw SQL, `postgres.js`, `prepare: false` for Neon's pooler); `test/query-budget.test.ts` counts each route's `sql` calls. Neon suspends an idle compute, so a cold load includes the wake: the report keeps cold and warm apart.
- **A fix here is one query or one wave.** An index is a migration and asks first; anything larger becomes a roadmap entry (Follow-ups).
- Decisions: D-158, D-160 (how the preview measures). Architecture: `docs/02-architecture.md` § Performance budget.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim):
`docs/perf/books-server-timing.md` lists every books route with its cold and
warm server time against development and a cause for each one over 500 ms
warm; each fix made here has a test that would have failed before it (a query
count in `test/query-budget.test.ts`, or an `EXPLAIN` assertion), and a second
run recorded in the same file shows each fixed route under 500 ms warm.
- [ ] AC-2: Given `npm run dev` against the development database, when the timing script loads each books route in `scripts/perf/routes.mjs` (the book sheet, Library, Status, Plan, Shelves, Series, Top, Coming out, Add, the dashboard), then `docs/perf/books-server-timing.md` records, per route, the server time of each query wave for a cold load (after the database has sat idle past Neon's suspend) and a warm one.
- [ ] AC-3: Every route over 500 ms warm has one named cause in the file: the query and its `EXPLAIN (ANALYZE)` output, the waves that could run as one, or the database waking (cold only).
- [ ] AC-4: Each fix this task makes has a test that fails before it: a lower `sql` call count for that route in `test/query-budget.test.ts`, or an assertion on the query's plan against the test database.
- [ ] AC-5: The timing script reads `.env`'s `DATABASE_URL` through the app only, and refuses when the env file it is given sets `LEDGER_LIVE=true` (it is never pointed at production).

## Out of scope

- A new index or any migration (asks first; its own entry).
- Budgets in `scripts/perf/budget.json` (0.14c, 0.14e own them) and the preview's Lighthouse run.
- Timing production, or comics routes.

## Files likely touched

- `scripts/perf/server-timing.mjs` — new: loads each books route cold and warm and records the server's waves.
- `src/lib/server-timing.ts` or `src/db/index.ts` — a `Server-Timing` header (or a dev-only log) per query wave, off in production.
- `src/db/queries.ts` — the one-query fixes, if any.
- `docs/perf/books-server-timing.md` — new: the two runs and the causes.
- `test/query-budget.test.ts` — the fixed routes' counts.
- `package.json` — a `perf:server` script.

## Verification

- Automated: `test/query-budget.test.ts` (AC-3); a unit test that the timing script refuses an env file with `LEDGER_LIVE=true` (AC-4).
- Manual: `npm run dev`, wait out Neon's suspend, run `npm run perf:server` → expected: the report lists every books route with cold and warm times, and a cause beside each route over 500 ms warm.

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
