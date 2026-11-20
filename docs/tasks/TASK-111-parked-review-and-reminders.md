---
id: TASK-111
title: 5.15 Parked (4 of 4) — the /parked review, the dashboard line and the Inbox row
status: Ready
depends_on: [TASK-109, TASK-110]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-111 — 5.15 Parked (4 of 4) — the /parked review, the dashboard line and the Inbox row

## Goal

A review page lists everything you've parked, oldest first, and lets you keep each one parked, plan it (or pick it back up), or let it go to Unlisted; when the review is due, the books dashboard and the Inbox say so, quietly.

## Context

- Roadmap: `docs/05-roadmap.md` § 5.15 Parked (M17), *The review* and *The reminder is in the app* bullets. D-105. Pulled ahead of 1.26 (D-139). Feature F-66. Its **Check (proposed):** is the contract.
- **Split, 4 of 4.** TASK-108 built the status, TASK-109 the verb and chip, TASK-110 the cadence and due rule. This part draws the review and the reminders, and **its merge ticks 5.15**.
- **The review.** `/parked` lists every parked item, books first (then each medium's as it lands: 5.16's runs), oldest parked first, each with *Parked 4 months* (from `book_status.parked_on`, TASK-108). Each book row has three verbs, each one write with Undo: **Keep parked**; **Plan…** (2.3's picker, `src/components/PlanPicker.tsx`: a quarter, a year, On deck or Someday), or for a book parked mid-read **Pick it back up** (back to `reading`, keeping its start); and **Unlisted** (writes `unlisted`; its Undo puts back `parked`). *Done reviewing* records the review (TASK-110's write), whatever is left parked. What *Keep parked* writes is the plan's (nothing but a mark that the row was seen, or nothing at all: the Check doesn't need it stored).
- **The reminder is in the app** (owner, 2026-11-02). When the review is due (TASK-110's rule), the books dashboard's rollup slot (2.2; `src/app/books/page.tsx`, `data-slot="rollup"`) gains a grey line, *Review 9 parked →*, linking to `/parked`, with no nudge copy, and the Inbox (`src/app/inbox/page.tsx`, `src/lib/inbox.ts`) lists one *Parked review* row at its top until it is done. No push notification. The email is 7.6's. TASK-100 adds *Coming out*'s line to the same slot; whichever lands second sets their order against the frame.
- **Navigation:** `/parked` is reached from the line, the Inbox row and the Library's *Parked · N* chip (the plan says whether it gets a nav item; the entry names none). Add `/parked` to `docs/02-architecture.md` § 5.
- **Not drawn yet:** the mockup gains `/parked` and the dashboard line at phone, tablet and desktop widths, before they are built; `design/mockups-index.md` lists them (`ui.redrawFiles`).
- Design: `design/mockups.html` § `bdash`, § `capture` (the Inbox screen); `design/STYLE_GUIDE.md` § 14 (the five slots); `docs/04-design.md` § 10 The UX floor, § 12 The dashboards; `.claude/rules/ui.md` (nothing on a dashboard is red; *Remove* and *Drop* only may be red, and *Unlisted* is neither).
- Decisions: D-105, D-37, D-83.
- *From TASK-109 (5.15, PR #299), owner's answer at its plan gate:* an add to a plan level (On deck, a year or a quarter: `writeDestination` in `src/db/writes.ts`, Add books' *Use that* and *Paste a list*) moves a Parked book to `to_read` and plans it, as it moves an Unlisted one (`promote`), clearing `parked_on` with the status. Re-read the status under the plan lock, so a park that commits between the `waiting` read and `placeInPlan` can't leave a planned Parked book. The review's *Plan…* needs the same unparking. Its undo puts back `parked` and the day.
- *From TASK-109 (5.15, PR #299), owner's answer at its plan gate:* `queueListen` (`/api/listen-queue`) refuses a Parked book with 400 and writes nothing. The UI already hides *Queue to listen* for one (`queueable` in `src/lib/status-tabs.ts`), so this only closes the API.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check (proposed):**, verbatim; this part proves, in the browser (0.11) on the test database: the review's *Plan…* opens 2.3's picker, *Unlisted* writes `unlisted` and Undo puts back `parked`, the dashboard line shows only when the review is due, and nothing on the dashboard or the review resolves to `--danger`. TASK-108 to TASK-110 prove the rest): (proposed; the owner agrees it by merging or edits it first)
`npm test`: parking the 2nd of 3 books in 2027 Q1
writes `parked`, removes its plan row and leaves Q1 at ordinals 1–2, and
Undo restores `to_read` at position 2. A parked book is absent from
`to_read_level`, `plan_period`, the three status-screen tabs and 2.10b's
suggestions, and present under the master list's *Parked* chip and in
search tagged *Parked*; a series with one read and one parked book reads
`1 / 2`. With a monthly cadence, one parked book and a last review 40 days
ago, the review is due; with nothing parked it is not; *Done reviewing*
makes it not due. In the browser (0.11), the review's *Plan…* opens 2.3's
picker, *Unlisted* writes `unlisted` and Undo puts back `parked`, and the
dashboard line shows only when the review is due. Nothing on the
dashboard or the review resolves to `--danger`.
- [ ] AC-2: Given two books parked 4 months and 2 weeks ago, `/parked` lists the older first, each with its *Parked …* age; a book parked from `reading` shows *Pick it back up* in place of *Plan…*, and pressing it returns it to In flight with its start date.
- [ ] AC-3: *Plan…* → a quarter places the book at that quarter's end and takes it off the review; its Undo puts it back to `parked` and removes the plan row.
- [ ] AC-4: With the review due, the books dashboard's rollup slot shows *Review N parked →* (N = the parked count) linking to `/parked`, and the Inbox's first row is *Parked review*; after *Done reviewing*, both are gone; the five slots keep their order.
- [ ] AC-5: `design/mockups.html` draws `/parked` and the dashboard line at phone, tablet and desktop, and `design/mockups-index.md` lists them (task 5.15); `docs/02-architecture.md` § 5 lists `/parked`.
- [ ] AC-6: The review and the line meet the UX floor (`docs/04-design.md` § 10): `/parked` with nothing parked draws a calm empty state, loading skeletons, an error state; every verb is a real button naming its book, ≥ 24px (44px on a phone row); contrast in light and dark; no computed colour on the dashboard or the review equals `--danger`; screenshots at each `ui.viewports` width.

## Out of scope

- The status, verb, chip and cadence (TASK-108 to TASK-110).
- Parked runs (5.16) and other media; the email (7.6); push notifications.

## Files likely touched

- `src/app/parked/page.tsx`, `src/app/parked/loading.tsx` (new).
- `src/components/ParkedRow.tsx` (new; the name is the plan's) — the three verbs through `useBookWrite` and `PlanPicker`.
- `src/app/books/page.tsx`, `src/db/queries.ts` — the dashboard line.
- `src/lib/inbox.ts`, `src/app/inbox/page.tsx` — the *Parked review* row.
- `design/mockups.html`, `design/mockups-index.md`, `docs/02-architecture.md`.
- `test/inbox.test.ts`, `test/books-dashboard.test.ts`, `test/e2e/parked-review.spec.ts` (new).

## Verification

- Automated: `test/books-dashboard.test.ts` and `test/inbox.test.ts` (the line and the row only when due), `test/e2e/parked-review.spec.ts` (AC-1's browser clauses, AC-2 to AC-4, the `--danger` sweep, axe; screenshots at each width).
- Manual: on the dev database with a parked book and a monthly cadence last reviewed long ago, Books → the rollup's *Review 1 parked →* → `/parked` → *Plan…* → a quarter → *Undo* → *Done reviewing* → the line is gone. Leave the data as found.

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
