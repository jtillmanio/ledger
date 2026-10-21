---
id: TASK-027
title: 1.8d Failed writes, skeletons and row markup
status: Review
depends_on: [TASK-014]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: efb218b
---

# TASK-027 — 1.8d Failed writes, skeletons and row markup

## Goal

A mark that fails to save never looks saved, and it can be retried in one tap. A loading screen holds the layout it is about to show. Every row and control on a dashboard is real, named markup.

## Context

- Roadmap: `docs/05-roadmap.md` § 1.8d Failed writes, skeletons and row markup, plus three parts of § 1.8 that are this task's contract: *A failed write is never silent* (the revert and the toast; the sync pill is 1.8's), the **Skeletons** bullet and the **Markup rules** bullet. Split out of TASK-014 (1.8) by the owner, 2026-10-19. Sitting 6: 0.11 → 1.8c → 1.8 → **1.8d** → 1.8b.
- Design: STYLE_GUIDE §9 (skeletons, toast), §14.3 (the toast's lines), §15 (copy); mockups `states` (loading frames), `home` (the telecard), `bdash` (the plan rail), `watchlist` (season rows).
- Decisions: R1-07 (a failed write reverts and raises the error toast with *Retry*; the offline queue is 6.4), D-63 (the toast stays live over a sheet), UX-N05.
- Builds on TASK-001 (the undo stack and its toast region, `src/components/Undo.tsx`), TASK-026 (the routes and their `loading.tsx`) and TASK-014 (the chrome the axe run covers). 1.8b then places the error toast above the thumb bar.
- The telecard (2.5b), the plan rail (2.2b) and season rows (8.7) have no loaded component yet. Their skeletons are measured against fixtures built from the mockup's markup on `globals.css`, and each task that builds the real component re-measures it.
- Today a failed tick calls `alert()` (`src/components/IssueRow.tsx` `toggle`), and a thrown fetch isn't caught.
- *From TASK-026 (1.8c, PR #108):* the run page `/comics/cap-origin` scrolls sideways at 360, 390 and 412px on the dev data (`scrollWidth` 450): a row's `a.btn.sec.sm`, `.menu-wrap` and `button.more` run past the edge. Not checked on `main`; if it is the row markup, it is this task's (arrived after the plan was approved).

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim): A spine tick whose write fails (a mocked 500) reverts the tick and raises the error toast with *Retry*, and *Retry* re-sends the same request. Skeletons for the telecard, run rows, plan rail and season rows render within 2px of the loaded geometry at 360px, and their shimmer stops under `prefers-reduced-motion`. An axe-core run over each dashboard reports no `nested-interactive`, `button-name` or `link-name` violations.
- [x] AC-2: A tick whose write fails, by a non-2xx answer or a network error, leaves the row unticked and raises the toast *That didn't save* with a *Retry* button, in the always-mounted `role="status"` region. *Retry* re-sends the same body. A success then ticks the row and offers *Undo* as a normal tick does. No `alert()` remains in `src/components/`.
- [x] AC-3: `TelecardSkeleton`, `RunRowsSkeleton`, `PlanRailSkeleton` and `SeasonRowsSkeleton` exist in `src/components/Skeleton.tsx`. `/comics` loads on the telecard and run rows, `/comics/runs` and `/books/list` on run rows, and `/watch` on season rows. Each is busy for assistive tech and announces itself once.
- [x] AC-4: On `/comics`, `/comics/runs` and `/books/list`, a navigable row is `<article class="row"><a class="row-link">` with a stretched-link overlay, and secondary buttons sit outside the anchor (no `a button`, no `a a`). Segmented controls, chips and switches are real buttons. Each page has exactly one `<h1>`.
- [x] AC-5: The changed screens meet the UX floor (`docs/04-design.md` § 10. The UX floor): the error toast's text clears 4.5:1 on `--toast-bg`, hover reveals are hidden at rest with a fine pointer at 1280px, and there are screenshots of `/comics`, `/comics/runs` and `/books/list` at each `ui.viewports` width, light and dark, plus reduced motion.

## Out of scope

- The toast's place above the thumb bar, its countdown bar and the enter motion (1.8b).
- The offline queue and *queued* writes (6.4).
- The range and date writes' failure paths (`openRange`, the date change): they already throw into their own sheets' error lines.
- The real telecard, plan rail and season rows (2.5b, 2.2b, 8.7).

## Files likely touched

- `src/components/Undo.tsx`: `fail()`, the error toast.
- `src/components/IssueRow.tsx`: the revert and *Retry*.
- `src/components/Skeleton.tsx` and the `loading.tsx` of `/comics`, `/comics/runs`, `/books/list` and `/watch`.
- `src/app/comics/(dash)/page.tsx`, `src/app/comics/runs/page.tsx`, `src/app/books/list/page.tsx`: the row markup.
- `src/app/globals.css`: `.row-link`, the error toast.
- `test/spine-toggle.test.tsx`, `test/loading-states.test.tsx`, `test/e2e/skeletons.spec.ts` (new), `test/e2e/markup.spec.ts` (new), `test/e2e/fixtures/{telecard,plan-rail,season-rows}.html` (new).

## Verification

- Automated: `test/spine-toggle.test.tsx` covers AC-2. `test/e2e/skeletons.spec.ts` covers the geometry and reduced motion (AC-1, AC-3). `test/e2e/markup.spec.ts` covers the axe run and the markup (AC-1, AC-4, AC-5).
- Manual: in DevTools, set the network offline and tick a row → expected: it stays unticked, and the toast says *That didn't save* · *Retry*. Back online, *Retry* → expected: ticked, then *Undo*.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- The telecard skeleton is re-measured against the real telecard; its `/comics` loading screen also lacks the Mid-run rows' 10px `.measure` meter → docs/05-roadmap.md § 2.5b (approved at plan; the re-measure note was already on main, the meter sentence is new)
- The plan-rail skeleton is re-measured against the real rail → docs/05-roadmap.md § 2.2b (approved at plan; already on main)
- The season-rows skeleton is re-measured against the real rows → docs/05-roadmap.md § 8.7 (approved at plan; already on main)
- The error toast with *Retry* moves from TASK-014 to this task, and 1.8b places it above the thumb bar → docs/tasks/TASK-015-thumb-bar-contrast.md § Context (approved at plan; the move note was already on main, the built-API bullet is new)
- `/books/list`'s loading screen draws run rows (70px) where a loaded book row is 139px, with a cover and status controls → docs/05-roadmap.md § 4.3
- `/comics/runs`'s skeleton filter chips take less room than the loaded chips on real data (first row about 111px lower once loaded): `ListSkeleton`'s chip lines are task 0.9's guess, and the 1.8d Check measures rows only → not tracked: pre-existing from 0.9, the chip block's height follows the data (37 tracks with counts wrap more); promote it if the jump bothers the owner
- AC-4 says chips are "real buttons", and the filter chips are navigation links (`<a href aria-current>`), which the UX floor accepts as "a real `<button>` or `<a href>`" → not tracked: accepted as is, a link is the right semantics for a chip that navigates
- The browser suite's sign-in step looped on `/login` locally while `.next` held a stale cache (`next dev` logging "Compiled in 1ms"); deleting `.next` fixed it three runs in a row → not tracked: not reproduced on a clean tree, and CI starts clean; delete `.next` if it recurs

## Plan

Re-planned 2026-10-21 at `efb218b` (the first plan predated 1.8c and 1.8; TASK-014 is Done). Approved by the owner, with the two open points agreed.

Steps:
1. `Undo.tsx`: `UndoApi.fail({ label, retry })` shows a toast with a *Retry* button in the same `role="status"` region, styled with `--toast-*` (`--toast-link` for *Retry*). It lasts `UNDO_MS` like any toast (1.8b revisits timing with its countdown bar). It never sits on the undo stack, so Ctrl+Z skips it.
2. `IssueRow.tsx` (`RunSpine.toggle`): factor into `attempt(next)`, which wraps the post in `try`. On `!res.ok` or a throw the optimistic row snaps back (`saved` is untouched) and it calls `fail({ label: "That didn't save", retry: () => attempt(next) })`. *Retry* re-enters the transition, re-sends the same body, and a success sets `saved` and pushes *Undo* as a normal tick does. `alert()` goes.
3. `Skeleton.tsx`: add `TelecardSkeleton` (svg block on `aspect-ratio: 344/354`, not the mockup's fixed 354px), `RunRowsSkeleton` (`ListSkeleton` reuses it), `PlanRailSkeleton` and `SeasonRowsSkeleton`, as aria-hidden pieces on `.sk`. Each `loading.tsx` supplies the one `<main aria-busy="true">` and the one `role="status"`. `/comics` = title row, telecard, run rows; `/comics/runs` and `/books/list` = run rows; `/watch` = season rows. 1.8a's reduced-motion block already stops the shimmer.
4. Row markup: on `/comics` and `/comics/runs`, a row is `<article class="row"><a class="row-link" href>…</a></article>`, the link stretched with `.row-link::after{inset:0}` and any secondary control after the anchor, above the overlay. `/books/list` rows are not navigable, so they become plain `<article class="row">` with no link. Audit `.seg`, chips and switches for real buttons, and one `<h1>` per page.
5. Fixtures `test/e2e/fixtures/{telecard,plan-rail,season-rows}.html`: the loaded markup copied from the `home`, `bdash` and `watchlist` frames (`scripts/screen.ps1`), rendered on `src/app/globals.css`.
6. Tick 1.8d in `docs/05-roadmap.md`. No mockup redraw: D-27 says the error toast is undrawn.

Test strategy:
- AC-1 → `test/spine-toggle.test.tsx` `a failed tick reverts and offers Retry` (fetch mocked to 500: the row's `data-read` is back to `false`, the toast reads *That didn't save*) and `Retry re-sends the same body and ticks` (the second fetch's body equals the first; `data-read` is `true`; *Undo* is offered). `test/e2e/skeletons.spec.ts` at 360px: each skeleton's `getBoundingClientRect` against its loaded counterpart, within 2px. Run rows are measured against `/comics/runs`, the other three against their fixtures. In `w390-reduced-motion`, `.sk` computes `animation-name: none`. `test/e2e/markup.spec.ts` runs `expectNoAxeViolations(page, ["nested-interactive", "button-name", "link-name"])` on `/comics`, `/watch`, `/comics/runs` and `/books/list` (`/books` redirects until 2.2) in every width × theme project.
- AC-2 → `spine-toggle.test.tsx` `a network error reverts too` (fetch rejects), plus a grep test: `no alert() in src/components`.
- AC-3 → `test/loading-states.test.tsx` lists the routes (`/watch` added) with their `aria-busy` and single `role="status"`, and checks the four components are exported.
- AC-4 → `markup.spec.ts` `rows are article > a.row-link with nothing interactive inside the link` and `one h1 per page`, on the three pages.
- AC-5 → `markup.spec.ts` `hover reveals are hidden at rest` (`.rowmenu-btn` opacity 0 at 1280, fine pointer); `npm run test:tokens` already checks the toast pairs; manual: screenshots via ui-verifier.

Risks / open questions:
- Settled (owner, 2026-10-19): *That didn't save*, today's `alert()` copy shortened (STYLE_GUIDE §15 has no error-toast line).
- The fixtures copy mockup markup, so they drift if the mockup changes. They're replaced when 2.5b, 2.2b and 8.7 build the real components (Follow-ups).

- Settled (owner, 2026-10-21): the failure toast lasts `UNDO_MS` like the others, and the error toast is not redrawn in the mockup.
- The 1.8c sideways-scroll note on the run page: TASK-014 wrapped `.run-actions` and `shell.spec.ts` covers it. Re-check in the UI walk; change nothing unless it still reproduces.

Size check: M, about 21 files, one layer (components, their CSS and tests). No schema. `splitPolicy` is `never-split`, so it stays whole and attended.

## Review log

Verify R1 PASS (tsc, lint, 707 unit tests, build; the browser suite flaked at sign-in on a stale `.next`, then passed 434) | Audit R1 CHANGES (3 vacuous guards in markup.spec, no AC unproven) → R2 PASS | Spec R1 APPROVE | UI R1 PASS (screenshots `t027-*` in the session scratchpad; 1.8c sideways scroll does not reproduce).

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 1 (plus a re-run of the browser suite after clearing `.next`)
- Review rounds: 1 (spec and UI), 2 (test audit)
- First-pass AC FAILs: 0
- Plan revisions after approval: 1 (the e2e seed gains two books, in `test/e2e/global-setup.ts` and `helpers.ts`, so `/books/list` has rows to check; outside the plan's file list, reported at close-out)
