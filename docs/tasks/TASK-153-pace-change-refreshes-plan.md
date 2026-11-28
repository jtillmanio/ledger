---
id: TASK-153
title: 2.0c A pace change reaches the plan without a reload
status: Review
depends_on: []
size: S
model: sonnet
autonomy: unattended
ui: true
plan_status: approved
planned_at_commit: 6937521
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

- [x] AC-1 (roadmap **Check:**, verbatim):
in the
browser (0.11): open Plan and note this year's capacity, go to Settings and
change *Minutes a day* from 45 to 90; Plan reached with the browser's Back, and
again from the nav, shows the capacity for 90 minutes without a reload, and the
books dashboard's budget line agrees. A save that fails (the route answering
500) leaves the capacity as it was.
- [x] AC-2: Given a held stepper that sends one `PATCH` (2.0b), the cache is dropped once, after that save succeeds, not on every step.
- [x] AC-3: Given the page is left while a save is still waiting (the `keepalive` send), the next Plan visit shows the new capacity.
- [x] AC-4: Settings meets the UX floor (`docs/04-design.md` § 10. The UX floor) as before: no layout shift from the refresh, and screenshots at 360px and 1280px.

## Out of scope

- Any change to how capacity is computed, or a stored capacity (hard rule 2).
- Moving books when the capacity drops (rebalance is 2.7's).

## Files likely touched

- `src/components/PaceSettings.tsx` — drop the router cache after a successful save.
- `test/settings.test.tsx` — AC-2 with fake timers.
- `test/e2e/settings.spec.ts` — AC-1 and AC-3 in the browser.

## Verification

- Automated: `test/pace-settings.test.tsx` (one refresh per save; none on a failed save; see the Plan for why not `test/settings.test.tsx`); `test/e2e/settings.spec.ts` (AC-1, AC-3, AC-4).
- Manual: `npm run dev`, Plan → Settings → *Minutes a day* 90 → Back → expected: the year's capacity is the 90-minute figure without a reload.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- This task's Verification named `test/settings.test.tsx` for the refresh's unit test; the test is `test/pace-settings.test.tsx` (spec-reviewer, R1) → docs/tasks/TASK-153-pace-change-refreshes-plan.md § Verification (fixed in this PR)
- `router.refresh()` after a client write whose figure other screens derive, and in Next 16.4 it also empties the back/forward cache → not tracked: the pattern is already the app's (`src/components/AddBooks.tsx`); the Next 16.4 detail is recorded in `PaceSettings`'s doc comment and this task's Plan, so no new decision
- AC-4's no-shift assertions can only fail once the refresh has happened: on the old code the test fails by waiting for the refresh, not on a box (test-auditor) → not tracked: accepted as is; the refresh is the event the AC is about, and AC-2's unit tests prove there is none on a failed save
- At 360px the Settings screen's visible nav has no Plan link (ui-verifier) → not tracked: the phone nav is 6.25's (D-178) and this task doesn't change it; at 390px the browser test reaches Plan from Settings through a visible nav link

## Plan

Approved by the owner, 2026-11-28 ("approve with recommendations"; implemented on Opus by the owner's choice, not the `model: sonnet` above).

**Why `router.refresh()`** (Next 16.4.6, `node_modules/next/dist/client/components/router-reducer/reducers/refresh-reducer.js`):
`refreshReducer` calls `invalidateSegmentCacheEntries` and then `refreshDynamicData`, whose first act is
`invalidateBfCache()` (`segment-cache/bfcache.js`), bumping the version every Back/forward read checks. So one
refresh after a successful save makes Back, the nav and the dashboard all fetch afresh. `use-router.md` says the
refresh clears "the current route"; the source clears every route's dynamic data and the back/forward cache.

**Steps**

1. `src/components/PaceSettings.tsx`: `useRouter()` from `next/navigation`; in `send()`, after `res.ok` and
   `saved.current` is updated, `router.refresh()`. Never in the catch. A hold is one `PATCH` (2.0b), so one
   refresh; a save flushed by the unmount cleanup (the `keepalive` send) refreshes whatever route is current
   when it lands, which is the Plan the user went to.
2. `test/pace-settings.test.tsx` (new, `@vitest-environment happy-dom`; not `test/settings.test.tsx`, which runs
   in node against the TEST database): AC-2.
3. `test/e2e/settings.spec.ts`: AC-1 (two tests: the save, the failed save), AC-3, AC-4.

**Files**

- `src/components/PaceSettings.tsx`: drop the router cache after a successful save.
- `test/pace-settings.test.tsx` (new; the task listed `test/settings.test.tsx`): AC-2 with fake timers.
- `test/e2e/settings.spec.ts`: AC-1, AC-3, AC-4 in the browser.
- No `design/mockups.html` redraw: nothing on the screen changes.
- `test/stepper.test.tsx` (revision 1, after approval: its 2.0b PaceSettings tests render outside an app router,
  so `useRouter()` threw; they get the same `next/navigation` mock the other component tests use).

**Test strategy**

- AC-1: `settings.spec.ts` › "a pace change reaches Plan by Back and by the nav, and the dashboard, without a
  reload (TASK-153 AC-1)": one book planned in this year's lane (`e2e-pace-*`), Plan → Settings by the nav,
  *Minutes a day* 45 → 90; `.plan-total` ends `of <kWords(year capacity)>` from `plan_capacity`, after Back and
  after the nav, with a `window` marker that a reload would clear; the dashboard's `.qfigs` reads the quarter's
  capacity. › "a pace save that fails leaves Plan's capacity as it was (TASK-153 AC-1)": the route answers 500.
- AC-2: `pace-settings.test.tsx` › a held + sends one PATCH and refreshes once, after it resolves; a 500 refreshes
  nothing; Retry that lands refreshes once.
- AC-3: `settings.spec.ts` › "a press still waiting when Settings is left by Back reaches Plan (TASK-153 AC-3)".
- AC-4: `settings.spec.ts` › "the refresh after a save moves nothing on Settings, at 360 and 1280px (TASK-153
  AC-4)": the steppers' and the card's boxes are equal before and after the refresh's RSC request; screenshots.
  The existing floor tests keep running at every width.

**Risks**: the refresh re-renders Settings, but `PaceSettings` keeps its `useState(initial)`, so nothing jumps
(AC-4). The bundle cost is nil: `next/navigation` is already in the client bundle.

## Review log

_Filled by /implement-task. One line per round._

- Verify R1 FAIL (`test/stepper.test.tsx`: `useRouter` outside an app router; tsc and lint passed) → mock added (plan revision 1) | Verify R2 PASS | touched specs in w390-light PASS (settings.spec.ts 35 tests; the refresh removed, AC-1's Back and AC-3 show `of 3M`)
- CI R1 (f4f3c55) PASS | Spec R1 APPROVE (note: AC-3's stored-row check could race the 500 ms wait) → test fixed | Verify R3 PASS | CI R2 (cea830c) PASS | Drift R1 merge as-is (0 behind)
- Audit R1 PASS (AC-1, AC-2 ×2, AC-3, AC-4 PROVEN; the failed save a guard) | UI R1 PASS (AC-1, its failure leg, AC-3 at 390; AC-4 at 360, 768, 1280; no console errors; the dev data left as found)
- Spec not re-run for the AC-3 fix: a test-only change it asked for; the close-out check covers the close-out

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 3
- Review rounds: 1
- First-pass AC FAILs: 0
- Plan revisions after approval: 1 (the `next/navigation` mock in `test/stepper.test.tsx`)
