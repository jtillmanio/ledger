---
id: TASK-153
title: 2.0c A pace change reaches the plan without a reload
status: Ready
depends_on: []
size: S
model: sonnet
autonomy: unattended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-153 — 2.0c A pace change reaches the plan without a reload

## Goal

After the reading pace is changed in Settings, the Plan screen and the books dashboard show the new capacity the next time they're opened, with no reload.

## Context

- Roadmap: `docs/05-roadmap.md` § 2.0c A pace change reaches the plan without a reload (M10 in `docs/06-tasklist.md`). Feature F-21. Its **Check:** is AC-1, verbatim; proposed in PR #342 and agreed when it merged (2026-11-25).
- Owner intake, 2026-11-24 and 2026-11-25 (*I wanted it to happen automatically, not need a new load*).
- **What exists.** `src/components/PaceSettings.tsx` saves with `fetch("/api/settings", { method: "PATCH" })`, 500 ms after the last change, and never tells the router. Capacity is derived on every render (`plan_capacity` in `etl/views.sql`, read by `planCapacity` in `src/db/queries.ts`; hard rule 2), so the stale figure is the client router cache, not the data. `src/components/AddBooks.tsx` already calls `router.refresh()` after a write: the pattern to copy. Read the Next 16 guide (`node_modules/next/dist/docs/`) on the router cache and Back navigation before choosing the call.
- Rules: `.claude/rules/ui.md`. UX floor: `docs/04-design.md` § 10. The UX floor. Decisions: D-123 (the steppers).

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim):
in the
browser (0.11): open Plan and note this year's capacity, go to Settings and
change *Minutes a day* from 45 to 90; Plan reached with the browser's Back, and
again from the nav, shows the capacity for 90 minutes without a reload, and the
books dashboard's budget line agrees. A save that fails (the route answering
500) leaves the capacity as it was.
- [ ] AC-2: Given a held stepper that sends one `PATCH` (2.0b), the cache is dropped once, after that save succeeds, not on every step.
- [ ] AC-3: Given the page is left while a save is still waiting (the `keepalive` send), the next Plan visit shows the new capacity.
- [ ] AC-4: Settings meets the UX floor (`docs/04-design.md` § 10. The UX floor) as before: no layout shift from the refresh, and screenshots at 360px and 1280px.

## Out of scope

- Any change to how capacity is computed, or a stored capacity (hard rule 2).
- Moving books when the capacity drops (rebalance is 2.7's).

## Files likely touched

- `src/components/PaceSettings.tsx` — drop the router cache after a successful save.
- `test/settings.test.tsx` — AC-2 with fake timers.
- `test/e2e/settings.spec.ts` — AC-1 and AC-3 in the browser.

## Verification

- Automated: `test/settings.test.tsx` (one refresh per save; none on a failed save); `test/e2e/settings.spec.ts` (AC-1, AC-3).
- Manual: `npm run dev`, Plan → Settings → *Minutes a day* 90 → Back → expected: the year's capacity is the 90-minute figure without a reload.

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
