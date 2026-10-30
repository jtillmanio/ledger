---
id: TASK-038
title: 1.19 Comics Add remembers the last run
status: Ready
depends_on: [TASK-014, TASK-005]
size: M
model: opus
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-038 — 1.19 Comics Add remembers the last run

## Goal

The comics *Add* item in the navigation is on, and it opens *Add issues* for the run you last added to, so a second add doesn't start by finding the run again. Before you have added to any run, it opens the run list.

## Context

- Roadmap: `docs/05-roadmap.md` § 1.19 Comics Add remembers the last run (M9, sitting 9, after 1.4e and 1.4f). The roadmap entry and its **Check:** are the contract; the Check was proposed at 1.8b's plan (2026-10-22). *From 1.8b (TASK-015, PR #114):* design §14 *Bulk add*, **Remember the last run** you added to, so consecutive adds don't re-navigate.
- **"All three navs" and the phone (open question, raised at conversion).** The Check says the item is enabled in all three navs, but the phone's bar (`src/components/nav/MediaBar.tsx`) draws only the media switch, never a medium's items: `test/nav-items.test.tsx` asserts `comics-runs` is drawn by two bars, the tablet rail and the sidebar. On a phone, *+ Add issues* is the thumb bar's third slot on a run page (`src/components/ThumbBar.tsx`). Either the Check means the two bars that draw medium items, or this task adds *Add* to the phone. Settle it with the owner before the plan; a change to the Check's wording is the owner's.
- The item: `src/components/nav/items.ts` `comics-add`, today `enabled: false` with the static href `/comics/add` (no such route; `/comics/[runId]/add` is the screen). `NAV_ITEMS` is static and read by client components (`NavRail.tsx`, `Sidebar.tsx`, `MediaBar.tsx`, through `ShellFrame.tsx`), so the remembered run reaches them from the server: `src/components/nav/Shell.tsx` already streams the Inbox count in a `<Suspense>` outside the per-page query budget (D-77, `test/query-budget.test.ts`).
- **Where the run is kept is the plan's to propose; a new column means stop and ask** (the roadmap, CLAUDE.md). The add flow is `POST /api/runs/[runId]/issues` (`src/app/api/runs/[runId]/issues/route.ts`, `insertIssuesIntoRun` in `src/db/writes.ts`), and its undo is the same route's `DELETE`. Nothing stored says when a placement was added (`run_issues` has no timestamp), so it can't be derived from the catalog. Candidates: a cookie set by the insert's answer, as `ledger_medium` is a cookie (R1-13, `src/lib/last-medium.ts`), which is per browser, so the phone and the desktop would each remember their own; or a stored value, such as a column on `reading_settings` (stop and ask). "Per user" in the entry predates D-91: there is one user.
- "A soft-deleted run is never the target": a remembered run whose `runs.deleted_at` is set falls back to `/comics/runs` (Hard rule 4), however it is kept.
- Whether an add that is then undone still counts as the last run is the plan's to say.
- Decisions: D-77 (the shell sends all three navs, CSS picks; the Inbox count streams outside the page budget), R1-06 (one item list for every bar; `enabled: false` renders nowhere), R1-13 (the last medium is a cookie), D-91 (single user).
- Design: no frame draws the item's href; the rail and sidebar draw *Add* as every other medium item (`design/mockups.html` `home` and `spine` desktop frames, `design/LedgerDesktop.dc.html`).

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): after adding an issue to run A from `/comics/A/add`, the comics *Add*
nav item is enabled in all three navs and links to `/comics/A/add`; after a
later add to run B it links to `/comics/B/add`; for a user who has added
nothing it links to `/comics/runs`. A soft-deleted run is never the target.
- [ ] AC-2: `test/nav-items.test.tsx`: `comics-add` is enabled and drops out of the *unbuilt screens* list; given a remembered run `A`, every bar that draws comics' items renders `href="/comics/A/add"`; given none, `href="/comics/runs"`. The other medium items' hrefs are unchanged.
- [ ] AC-3: Against the TEST database, a successful insert through `POST /api/runs/A/issues` makes A the remembered run, and a dry run (`dryRun: true`) and a refused insert (4xx) do not change it. Given remembered run A soft-deleted (`deleted_at` set), the item links to `/comics/runs`.
- [ ] AC-4: In the browser (0.11), at 1280px: add one issue to a test run from its *Add issues* screen, then open `/comics` → the sidebar's *Add* has `href` `/comics/<that run>/add`, and following it opens that run's *Add issues*. On a run's own page the current item is still *Runs*, not *Add* (`currentItem`'s rule, `holdsDetail`).
- [ ] AC-5: The comics *Add* item meets the UX floor (`docs/04-design.md` § 10. The UX floor): a real link with the accessible name *Add*, at least 24px tall in the rail and the sidebar, `aria-current="page"` only on an *Add issues* screen; screenshots at the tablet and desktop `ui.viewports` widths, light and dark (and at the phone widths if the phone question is settled toward drawing it there).

## Out of scope

- The books and watch *Add* items: books' is on already; watch's waits for 8.7.
- A comics add screen with no run (a run picker as its own route).
- Remembering which issue or position in the run you added at.
- The thumb bar's *+ Add issues* on a run page, which already targets that run.

## Files likely touched

- `src/components/nav/items.ts`: `comics-add` enabled; its href supplied at render.
- `src/components/nav/Shell.tsx`, `ShellFrame.tsx`, `NavRail.tsx`, `Sidebar.tsx` (and `MediaBar.tsx` if the phone draws it): the remembered run's href to the bars.
- `src/app/api/runs/[runId]/issues/route.ts`: record the run after a successful insert.
- `src/db/queries.ts`: the live-run check for the remembered run.
- `src/lib/last-run.ts` (new, if a cookie): its name and parsing, beside `last-medium.ts`.
- `test/nav-items.test.tsx` (AC-2), `test/last-run.test.ts` (new, DB, AC-3), `test/e2e/shell.spec.ts` (AC-4).

## Verification

- Automated: `test/nav-items.test.tsx` (AC-2); `test/last-run.test.ts` against `TEST_DATABASE_URL` (AC-3); `test/e2e/shell.spec.ts` (AC-4, with axe); `test/query-budget.test.ts` still passes.
- Manual: on `npm run dev`, add an issue to one run, then go to `/comics` at 1280px → expected: *Add* in the sidebar opens that run's *Add issues*. Add to a second run → expected: *Add* now opens the second. Leave the development data as found (undo the adds).

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
