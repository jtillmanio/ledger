---
id: TASK-100
title: 5.7 Books coming out (2 of 2) — the add sheet's Coming out destination and the dashboard line
status: Ready
depends_on: [TASK-099]
size: M
model: opus
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-100 — 5.7 Books coming out (2 of 2) — the add sheet's Coming out destination and the dashboard line

## Goal

You can add a book you're waiting for straight to *Coming out*, with its release date or *no date yet*, and the books dashboard tells you how many are out now and coming this month.

## Context

- Roadmap: `docs/05-roadmap.md` § 5.7 Books coming out (M17; D-35). Pulled ahead of 1.26 by 1.25. Feature F-37. Its **Check:** is the contract.
- **Split, 2 of 2.** TASK-099 built the page, *Got it* and the nav item. This part adds the destination and the dashboard line, and **its merge ticks 5.7**.
- **Adding:** 1.4c's add sheet (`src/components/AddBooks.tsx`, *Add to*) gains a *Coming out* destination with a release-date field (a date, or *no date yet*). The book row is created or reused as usual, then the `releases` row (`book_id` primary key, so a book has one release; the plan says what re-adding a book that has one does). `Destination` and `writeDestination` in `src/db/writes.ts` gain the kind; `undoAddBooks` removes the `releases` row the add wrote and the book it created, as it does a shelf's row. A book the add creates gets no `book_status` row, as a shelf add leaves it (else it isn't wanted, TASK-099's rule); **ask at plan time** what *Coming out* does to a reused book that already has a status (it would not be listed).
- **Notify me is in the app, not a push:** the books dashboard's rollup slot (`src/app/books/page.tsx`, `data-slot="rollup"`, *2026 so far*) gains a line, *2 out now · 3 coming this month →*, linking to `/books/releases`, so the five slots keep their order (`.claude/rules/ui.md`). Its counts come from the same query as the page, so they cannot disagree. The line is grey text, never a state colour, and is absent when both counts are zero (the plan confirms against the redrawn frame). The digest email stays 7.6.
- **Not drawn yet:** the `add` frame gains the *Coming out* destination and its date field, and the `bdash` frames the rollup line, in this PR (`ui.redrawFiles`).
- Design: `design/mockups.html` § `add`, § `bdash`; `design/STYLE_GUIDE.md` § 14 (the five slots); `docs/04-design.md` § 10 The UX floor, § 12 The dashboards.
- Decisions: D-35, D-37, D-67.
- *From TASK-099 (5.7, PR #285):* extract loads no undated Coming Out row (`etl/extract.py`, `if not bid or pd.isna(date): continue`), so *No date yet* on `/books/releases` fills only from this task's add sheet (`release_date` NULL). TASK-099's `wantedReleases(userId, today)` in `src/db/queries.ts` is the page's one query (live book, a `releases` row, no `book_status` row; `grp` is `out`, a `YYYY-MM` month or `none`): the dashboard line's two counts should come from it, so they equal the list's.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves the dashboard line's counts equal the list's, on the test database and in the browser (0.11), and the add path that feeds both. TASK-099 proves the list, *Got it* and the screenshots):
a released-yesterday book with no status renders under *Out now*;
one due next month under that month; *Got it* writes one `to_read` row and
removes the row from the list, and Undo restores it; a book already `read`
never appears. The dashboard line's counts equal the list's. Screenshot at
360px, 834px and 1280px.
- [ ] AC-2: Given the add sheet, adding a new book by hand to *Coming out* with a date next month writes one `books` row and one `releases` row with that date and no `book_status` row, and the book shows on `/books/releases` under that month; *Undo* removes both rows.
- [ ] AC-3: Adding with *no date yet* writes a `releases` row with NULL `release_date`, listed under *No date yet*.
- [ ] AC-4: Given two wanted books out now and three due this month (Eastern), the books dashboard's rollup slot shows `2 out now · 3 coming this month →` linking to `/books/releases`; with none of either, the line is absent; the slots keep their order.
- [ ] AC-5: The `add` and `bdash` frames in `design/mockups.html` draw the destination with its date field and the rollup line, and `design/mockups-index.md` names them (task 5.7).
- [ ] AC-6: The destination and the line meet the UX floor (`docs/04-design.md` § 10): the date field is labelled and keyboard-operable, *no date yet* is a real control with a name, a bad date is refused under the field, the line is a real link with a name; contrast in light and dark; nothing on the dashboard resolves to `--danger`; screenshots at 360px, 834px and 1280px.

## Out of scope

- The page, *Got it* and the nav item (TASK-099).
- Editing a release date after the add (3.5's sheet or 3.1).
- Comic releases (5.8) and the email (7.6).

## Files likely touched

- `src/db/writes.ts` — the *Coming out* destination, its write and undo.
- `src/app/api/books/route.ts`, `src/app/api/books/bulk/route.ts` — the destination and its date in the body.
- `src/components/AddBooks.tsx` — the destination chip and the date field.
- `src/app/books/page.tsx`, `src/db/queries.ts` — the rollup line and its counts.
- `design/mockups.html`, `design/mockups-index.md` — `add` and `bdash` (redraw).
- `test/add-book.test.ts`, `test/books-dashboard.test.ts`, `test/e2e/releases.spec.ts`.

## Verification

- Automated: `test/add-book.test.ts` (AC-2, AC-3 and the undo on `TEST_DATABASE_URL`), `test/books-dashboard.test.ts` (AC-4's counts against the list's query), `test/e2e/releases.spec.ts` (the add to *Coming out*, the line's counts equal the page's, axe).
- Manual: on the dev database, Books → Add → *By hand* → *Coming out*, a date next month → the page lists it under that month, the dashboard line counts it → *Undo* → gone. Leave the data as found.

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
