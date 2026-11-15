---
id: TASK-105
title: 5.12 In the middle of, and completed (2 of 2) — the /progress page, its tabs and chips
status: Ready
depends_on: [TASK-104]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-105 — 5.12 In the middle of, and completed (2 of 2) — the /progress page, its tabs and chips

## Goal

One page, beside Inbox, shows everything you're in the middle of and everything you've completed, books and comics together or one medium at a time, with the bigger things nesting their parts beneath them.

## Context

- Roadmap: `docs/05-roadmap.md` § 5.12 In the middle of, and completed: one page for every medium (M17). D-109, D-108, D-118, D-119. Feature F-69. Its **Check:** is the contract.
- **Split, 2 of 2.** TASK-104 built the rows. This part draws them, and **its merge ticks 5.12**.
- **One page, `/progress`, two tabs: *In the middle of · Completed***, in the global part of the nav beside Inbox (`NAV_ITEMS`, `group: "global"`, `src/components/nav/items.ts`; the phone's tab row shows Inbox from the global group today: the plan says where *Progress* sits there, per 2.2i's `tabRowItems`), with a chip per medium (*All · Books · Comics*; *Watch*, *Music* and *Games* once they exist). The tabs follow the status screens' tablist (`src/components/StatusTabs.tsx`); the tab and chip are in the URL so a reload keeps them. It replaces the old plan of a group on 1.9's books *In flight* tab: In flight keeps the books and runs in hand.
- **On hold** is a collapsed group under *In the middle of*, with its count, labelled as 2.2h's control labels it (*On hold*).
- **Each row**: the medium's glyph, the kind (*series*, *universe*, *author*, *shelf*, *run*, *track*), the name, `read / total` in mono, an `.emeter` filled with `--ready`, and on *In the middle of* the next thing named. *Completed* shows the finish's month (*finished Mar 2026*). A row opens its page where one exists (5.9's series page, 5.11's author and universe pages, 5.1's shelf page, 5.2's track page, the run); where none exists yet it is not a link (the plan lists which exist when it is written).
- **Rows nest** (D-119): a series under a listed universe sits indented beneath it, and a subseries beneath its series, as 2.2g's rows do in Now (`src/components/WhereItSits.tsx`). A row whose parent isn't listed stands on its own.
- **Links in:** the books and comics dashboards' rollups link here (`src/app/books/page.tsx`, `src/app/comics/(dash)/page.tsx`, the `rollup` slot), keeping the five slots' order.
- **Empty states are calm:** *Nothing in the middle. Follow a series as Reading to see it here* with *Open the Library* (2.2e); the plan writes *Completed*'s against the frame.
- **Not drawn yet:** the mockup gains `/progress` at phone, tablet and desktop widths before it is built, and `design/mockups-index.md` lists it (`ui.redrawFiles`); this PR draws it first.
- Architecture: add `/progress` to `docs/02-architecture.md` § 5.
- Design: `design/STYLE_GUIDE.md` § 14–§ 16 (the feel pass: empty and caught-up states, completion has no celebration); `docs/04-design.md` § 10 The UX floor; `.claude/rules/ui.md`.
- Decisions: D-40, D-108, D-109, D-118, D-119, D-120; R1-06.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves, in the browser (0.11) on the test database: the *Books* chip hides the run, a series under a listed universe nests beneath it, *On hold* drawn below *In the middle of*, and the screenshots. TASK-104 proves the membership and counts):
a series followed `reading` with 2 of 5 read is under *In the
middle of* and the same series unfollowed is not; a series with 5 of 5
read is under *Completed* whether followed or not, and a one-book
series read is not; an author appears only when followed; a shelf
followed `reading` with 1 of 3 read appears; a run with 3 of 10 read is
under *In the middle of*, and with 10 of 10 under *Completed*; the
*Books* chip hides the run; nothing is written; each row's counts equal
its view's. A series followed `tracking` with 2 of 5 read is under *On
hold* and not above it, and at 0 of 5 it is on neither; a series under a
listed universe nests beneath it. Screenshots at 360px and 1280px.
- [ ] AC-2: Given the Check's fixtures, `/progress` opens on *In the middle of* with the series, the shelf and the run, each with its kind, `read / total` and next thing; *Books* hides the run and *Comics* hides the books rows; the choice and the tab survive a reload.
- [ ] AC-3: *On hold* is collapsed with its count, a real button with `aria-expanded`; expanding it lists the tracking series at 2 of 5.
- [ ] AC-4: *Completed* lists the 5-of-5 series and the 10-of-10 run, each with *finished <Mon YYYY>*; a row with a page is a link to it.
- [ ] AC-5: *Progress* shows in the global part of the rail and the sidebar beside Inbox and in the phone's navigation, current on `/progress`; the books and comics dashboards' rollups link to it; `design/mockups.html` draws `/progress` at phone, tablet and desktop, and `design/mockups-index.md` lists it (task 5.12).
- [ ] AC-6: The page meets the UX floor (`docs/04-design.md` § 10): each tab's empty state with one action, loading skeletons, an error state, the tablist and chips operable by keyboard with names, targets ≥ 24px, contrast in light and dark, nothing red, screenshots at 360px and 1280px (and the other `ui.viewports` widths).

## Out of scope

- The queries (TASK-104).
- Pages that don't exist yet (5.2's tracks page, 5.9, 5.11): rows link where a page exists.
- Watch, music and games rows (8.8, 9.6, 10.3).

## Files likely touched

- `src/app/progress/page.tsx`, `src/app/progress/loading.tsx` (new).
- `src/components/ProgressRows.tsx` (new; the name is the plan's) — rows, nesting, the *On hold* group.
- `src/components/nav/items.ts` — the *Progress* item.
- `src/app/books/page.tsx`, `src/app/comics/(dash)/page.tsx` — the rollup links.
- `design/mockups.html`, `design/mockups-index.md`, `docs/02-architecture.md`.
- `test/nav-items.test.tsx`, `test/e2e/progress.spec.ts` (new).

## Verification

- Automated: `test/e2e/progress.spec.ts` (AC-1's browser clauses, AC-2 to AC-5, axe; screenshots at each width), `test/nav-items.test.tsx`.
- Manual: on the dev database, Inbox's neighbour *Progress* → *In the middle of* → a followed series and a part-read run; *Books* → the run goes; *Completed* → finished months.

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
