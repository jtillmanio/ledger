---
id: TASK-107
title: 5.14 A queue to listen next (2 of 2) — Queue to listen, Listen next on Up next, and Done's Listened chip
status: Ready
depends_on: [TASK-106]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-107 — 5.14 A queue to listen next (2 of 2) — Queue to listen, Listen next on Up next, and Done's Listened chip

## Goal

From a book's row or the add sheet you can queue an audiobook to listen next and reorder the queue; Up next shows *Listen next* in that order, and Done can show just the books you listened to.

## Context

- Roadmap: `docs/05-roadmap.md` § 5.14 Audiobooks: a queue to listen next (M17). Pulled ahead of 1.26 (D-139). Feature F-59. Its **Check (proposed):** is the contract.
- **Split, 2 of 2.** TASK-106 built the table, the writes and the route. This part draws them, and **its merge ticks 5.14**.
- **The verbs:** *Queue to listen* on the master-list row's `⋯` (`src/components/BookRowMenu.tsx`) and the add sheet (1.4c, `src/components/AddBooks.tsx`: a destination or a second action, the plan's against the redrawn frame), and *Move to…* to reorder with 1.10's controls (`src/components/ReorderList.tsx`, `src/components/QueueList.tsx`). On the book sheet too, if 3.5's sheet (TASK-079) has merged by this plan. Each write raises the undo toast (`src/components/Undo.tsx`).
- **The three states on the status screens** (`src/app/books/status/page.tsx`, `src/lib/status-tabs.ts`, `booksUpNext`/`booksDone` in `src/db/queries.ts`): Up next gains a *Listen next* group, in queue order, after the reading plan's levels. In flight already has *Listening* (1.23). Done gains a *Listened* chip that keeps only books with an audio read (`book_reads.format = 'audio'`), beside its existing grouping. Each tab's count equals its rows (the Check), so the Up next count includes the queue's books unless the plan's answer (TASK-106: a book on the plan and the queue at once) means one book would count twice: then it counts once.
- **The dashboard** shows the first queued listen in its *Up next* slot only if TASK-106's plan gate said so.
- **Not drawn yet:** the `status` frames gain *Listen next* and the *Listened* chip, and `blist`/`add` the *Queue to listen* verb, in this PR (`ui.redrawFiles`).
- Design: `design/mockups.html` § `status`, § `blist`, § `add`; `docs/04-design.md` § 10 The UX floor; `.claude/rules/ui.md` (every status screen keeps *In flight · Up next · Done*, in that order and under those names).
- Decisions: D-85, D-139.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check (proposed):**, verbatim; this part proves the browser sentence on the test database: *Listen next* in queue order, the *Listened* chip, each tab's count. TASK-106 proves the `npm test` sentence and the export): (proposed; the owner agrees it by merging or edits it first)
`npm test`: queueing three books gives positions
1–3; setting #2 to *Listening* leaves the other two at 1–2, and its undo
restores all three in order. In the browser (0.11), Up next lists *Listen
next* in queue order; Done's *Listened* chip lists only books with an
audio read; each tab's count equals its rows. The export test passes with
`listen_queue`.
- [ ] AC-2: Given a to-read book, choosing *Queue to listen* from its `⋯` raises an undo toast and Up next's *Listen next* lists it last; *Undo* takes it off.
- [ ] AC-3: Given three queued books, *Move to…* position 1 on the third redraws *Listen next* as 3, 1, 2 without a reload, and the order survives a reload.
- [ ] AC-4: Given one book read as text and one listened, Done's *Listened* chip lists only the listened book, the chip is current (`aria-pressed` or `aria-current`) and in the URL, and *All* lists both.
- [ ] AC-5: The `status`, `blist` and `add` frames in `design/mockups.html` draw *Listen next*, the *Listened* chip and *Queue to listen*, and `design/mockups-index.md` names them (task 5.14).
- [ ] AC-6: The status screen and the verbs meet the UX floor (`docs/04-design.md` § 10): *Listen next* with no books is absent (not an empty heading), the chip and menu items are real controls with names, ≥ 24px, *Move to…* has a keyboard route, contrast in light and dark, reduced motion on reorder, screenshots at 360px and 1280px.

## Out of scope

- The table, writes and route (TASK-106).
- Parking a queued book (5.15).
- The book sheet, unless TASK-079 has merged by this plan.

## Files likely touched

- `src/components/BookRowMenu.tsx` — *Queue to listen*.
- `src/components/AddBooks.tsx` — the add sheet's verb.
- `src/app/books/status/page.tsx`, `src/lib/status-tabs.ts`, `src/db/queries.ts` — *Listen next* and the *Listened* chip.
- `src/components/QueueList.tsx` or `src/components/ReorderList.tsx` — reuse for the listen queue's *Move to…*.
- `design/mockups.html`, `design/mockups-index.md` — `status`, `blist`, `add` (redraw).
- `test/status.test.ts`, `test/e2e/listen-queue.spec.ts` (new).

## Verification

- Automated: `test/status.test.ts` (the groups, chip and counts against their rows), `test/e2e/listen-queue.spec.ts` (AC-1's browser sentence, AC-2 to AC-4, axe; screenshots at 360 and 1280).
- Manual: on the dev database, Library → a book's `⋯` → *Queue to listen* → Status → Up next → *Listen next* lists it → *Undo*. Leave the data as found.

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
