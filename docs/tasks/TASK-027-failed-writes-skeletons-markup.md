---
id: TASK-027
title: 1.8d Failed writes, skeletons and row markup
status: Ready
depends_on: [TASK-014]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: 4bba78a
---

# TASK-027 — 1.8d Failed writes, skeletons and row markup

## Goal

A mark that fails to save never looks saved, and it can be retried in one tap. A loading screen holds the layout it is about to show. Every row and control on a dashboard is real, named markup.

## Context

- Roadmap: `docs/TASKS.md` § 1.8d Failed writes, skeletons and row markup, plus three parts of § 1.8 that are this task's contract: *A failed write is never silent* (the revert and the toast; the sync pill is 1.8's), the **Skeletons** bullet and the **Markup rules** bullet. Split out of TASK-014 (1.8) by the owner, 2026-10-19. Sitting 6: 0.11 → 1.8c → 1.8 → **1.8d** → 1.8b.
- Design: STYLE_GUIDE §9 (skeletons, toast), §14.3 (the toast's lines), §15 (copy); mockups `states` (loading frames), `home` (the telecard), `bdash` (the plan rail), `watchlist` (season rows).
- Decisions: R1-07 (a failed write reverts and raises the error toast with *Retry*; the offline queue is 6.4), D-63 (the toast stays live over a sheet), UX-N05.
- Builds on TASK-001 (the undo stack and its toast region, `src/components/Undo.tsx`), TASK-026 (the routes and their `loading.tsx`) and TASK-014 (the chrome the axe run covers). 1.8b then places the error toast above the thumb bar.
- The telecard (2.5b), the plan rail (2.2b) and season rows (8.7) have no loaded component yet. Their skeletons are measured against fixtures built from the mockup's markup on `globals.css`, and each task that builds the real component re-measures it.
- Today a failed tick calls `alert()` (`src/components/IssueRow.tsx` `toggle`), and a thrown fetch isn't caught.
- *From TASK-026 (1.8c, PR #108):* the run page `/comics/cap-origin` scrolls sideways at 360, 390 and 412px on the dev data (`scrollWidth` 450): a row's `a.btn.sec.sm`, `.menu-wrap` and `button.more` run past the edge. Not checked on `main`; if it is the row markup, it is this task's (arrived after the plan was approved).

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): A spine tick whose write fails (a mocked 500) reverts the tick and raises the error toast with *Retry*, and *Retry* re-sends the same request. Skeletons for the telecard, run rows, plan rail and season rows render within 2px of the loaded geometry at 360px, and their shimmer stops under `prefers-reduced-motion`. An axe-core run over each dashboard reports no `nested-interactive`, `button-name` or `link-name` violations.
- [ ] AC-2: A tick whose write fails, by a non-2xx answer or a network error, leaves the row unticked and raises the toast *That didn't save* with a *Retry* button, in the always-mounted `role="status"` region. *Retry* re-sends the same body. A success then ticks the row and offers *Undo* as a normal tick does. No `alert()` remains in `src/components/`.
- [ ] AC-3: `TelecardSkeleton`, `RunRowsSkeleton`, `PlanRailSkeleton` and `SeasonRowsSkeleton` exist in `src/components/Skeleton.tsx`. `/comics` loads on the telecard and run rows, `/comics/runs` and `/books/list` on run rows, and `/watch` on season rows. Each is busy for assistive tech and announces itself once.
- [ ] AC-4: On `/comics`, `/comics/runs` and `/books/list`, a navigable row is `<article class="row"><a class="row-link">` with a stretched-link overlay, and secondary buttons sit outside the anchor (no `a button`, no `a a`). Segmented controls, chips and switches are real buttons. Each page has exactly one `<h1>`.
- [ ] AC-5: The changed screens meet the UX floor (`docs/TASKS.md` § *The UX floor, for every UI task*): the error toast's text clears 4.5:1 on `--toast-bg`, hover reveals are hidden at rest with a fine pointer at 1280px, and there are screenshots of `/comics`, `/comics/runs` and `/books/list` at each `ui.viewports` width, light and dark, plus reduced motion.

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

- The telecard skeleton is re-measured against the real telecard → docs/TASKS.md § 2.5b (approved at plan)
- The plan-rail skeleton is re-measured against the real rail → docs/TASKS.md § 2.2b (approved at plan)
- The season-rows skeleton is re-measured against the real rows → docs/TASKS.md § 8.7 (approved at plan)
- The error toast with *Retry* moves from TASK-014 to this task, and 1.8b places it above the thumb bar → docs/tasks/TASK-015-thumb-bar-contrast.md § Context (approved at plan)

## Plan

Provisional: depends on TASK-014 (not Done), and through it on TASK-026 and TASK-013 (the routes, their `loading.tsx` and the harness).

Steps:
1. `Undo.tsx`: `UndoApi.fail({ label, retry })` shows a toast with a *Retry* button in the same region, styled with `--toast-*` (`--toast-link` for *Retry*). *Retry* takes the entry off and awaits `retry()`. A rejection shows the failure again. It never sits on the undo stack, so Ctrl+Z skips it.
2. `IssueRow.toggle`: wrap the post in `try`. On `!res.ok` or a throw, leave `saved` as it is (the optimistic row snaps back) and call `fail({ label: "That didn't save", retry: () => send(next) })`, where `send` is the success path factored out of `toggle` (setSaved, then push the undo). `alert()` goes.
3. `Skeleton.tsx`: the four skeletons on `.sk`, sized from the mockup's classes (`.telecard` 16px padding and its rails, `.row` 48px, `.planrail` columns, the season `.row`). 1.8a's reduced-motion block already stops the shimmer. Wire them into the four `loading.tsx` files.
4. Row markup on the three pages: `<article class="row"><a class="row-link" href>…</a></article>`, the link stretched over the row with `::after{inset:0}`, any secondary control after the anchor. `.rows .row` keeps its spacing. Chips that are links stay `<a>`; chips that toggle state are `<button aria-pressed>`.
5. Fixtures `test/e2e/fixtures/{telecard,plan-rail,season-rows}.html`: the loaded markup copied from the mockup frames (`scripts/screen.ps1 home|bdash|watchlist`), rendered on `src/app/globals.css`.
6. Tick 1.8d in `docs/TASKS.md`.

Test strategy:
- AC-1 → `test/spine-toggle.test.tsx` `a failed tick reverts and offers Retry` (fetch mocked to 500: the row's `data-read` is back to `false`, the toast reads *That didn't save*) and `Retry re-sends the same body and ticks` (the second fetch's body equals the first; `data-read` is `true`; *Undo* is offered). `test/e2e/skeletons.spec.ts` at 360px: each skeleton's `getBoundingClientRect` against its loaded counterpart, within 2px. Run rows are measured against `/comics/runs`, the other three against their fixtures. In `w390-reduced-motion`, `.sk` computes `animation-name: none`. `test/e2e/markup.spec.ts` runs `expectNoAxeViolations(page, ["nested-interactive", "button-name", "link-name"])` on `/comics` and `/watch` in every width × theme project.
- AC-2 → `spine-toggle.test.tsx` `a network error reverts too` (fetch rejects), plus a grep test: `no alert() in src/components`.
- AC-3 → `test/loading-states.test.tsx` lists the four routes and their skeleton's `aria-busy` and single `role="status"`.
- AC-4 → `markup.spec.ts` `rows are article > a.row-link with nothing interactive inside the link` and `one h1 per page`, on the three pages.
- AC-5 → `markup.spec.ts` `hover reveals are hidden at rest` (`.rowmenu-btn` opacity 0 at 1280, fine pointer); `npm run test:tokens` already checks the toast pairs; manual: screenshots via ui-verifier.

Risks / open questions:
- Settled (owner, 2026-10-19): *That didn't save*, today's `alert()` copy shortened (STYLE_GUIDE §15 has no error-toast line).
- The fixtures copy mockup markup, so they drift if the mockup changes. They're replaced when 2.5b, 2.2b and 8.7 build the real components (Follow-ups).

Size check: M, about 15 files, one layer (components, their CSS and tests). No schema. Attended.

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
