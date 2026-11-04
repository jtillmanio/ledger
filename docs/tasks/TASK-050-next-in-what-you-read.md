---
id: TASK-050
title: 2.2d Next in what you're reading, on the dashboard
status: Draft
depends_on: [TASK-049, TASK-048]
size: L
model: opus
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-050 — 2.2d Next in what you're reading, on the dashboard

## Goal

When the book in hand belongs to something you follow as *Reading*, the dashboard names the next book in it. Between books, it lists up to three *Or keep going* rows, each with a **Start** that you can undo.

## Context

- Roadmap: `docs/05-roadmap.md` § 2.2d Next in what you're reading, on the dashboard (M10, after 2.2; owner intake 2026-11-02, D-108; the owner chose the dashboard and the plan sheet). The roadmap entry and its **Check:** are the contract; its Check was proposed at the intake and agreed by the owner on 2026-11-04, when these task files were written. Features: F-68. "In the browser (0.11)" is the Playwright harness, `test/e2e/` (TASK-013). Not one of the entries 1.25 pulls ahead of cutover. Depends on 2.2 (TASK-049, the dashboard's Now and *Between books*) and 2.2c (TASK-048, the follows it reads, `shelf_follows` included).
- **Why this is one large task** (`workflow.splitPolicy: never-split`): a view with its SQL cases, its query, two dashboard additions, the **Start** write with its undo and the `bdash` redraw at three widths land together, and the view is schema-adjacent, so the task is attended.
- **One derived list, read everywhere.** Proposed view `follow_next(kind, entity_id, name, book_id, read, total)` in `etl/views.sql`: for each series, universe, author and shelf followed as `reading`, its next book. Next is the lowest unread `series_position` for a series, the lowest `universe_position` for a universe, the lowest shelf `ordinal` (`shelf_books.ordinal`) for a shelf, and for an author the earliest `published_year`, then title. Unread means `to_read` or `unlisted`; a book read, DNF or parked (5.15, not built: the plan says how the view leaves room for it) is skipped; a listened book counts as read (1.23). A follow whose next book is the one you're reading now has no row, and nor does a follow with nothing left. Live books only (`deleted_at IS NULL`). Nothing is stored (Hard rule 2). It joins `docs/03-data-model.md` § 3. Views. **Ask at the plan gate:** a new view isn't a schema column, but the four kinds' tables differ (three follow tables keyed with `user_id` until 6.18, `shelf_follows` without, D-91): the plan shows the view's shape.
- **Under Now.** When the book in hand belongs to something followed as *Reading*, the hero gains one grey line under its meter, *Next in Mistborn: The Well of Ascension*, linking to that book (the Library row, until 3.5's sheet). One line only: the series first, then the universe, then the author.
- **Between books.** Under the top of the plan, *Or keep going* lists up to three rows from `follow_next`, most recently read first (the plan defines "most recently read" for a follow: its latest read's finish), each with its reason (*Next in Red Rising · 3 of 6 read*) and **Start** (sets the book `reading` through `saveBookStatus`, stamping 1.17's start, with undo through `undoBookStatus`). *Pick something else* stays. The top of the plan is still the primary, and the thumb bar's verb still starts it.
- **The plan sheet reads the same view** later: 2.10b's first three groups are `follow_next`'s rows, so the dashboard and the sheet can't disagree. Nothing for 2.10b is built here.
- No nudge copy, no streaks, nothing amber or red: a follow untouched for months is listed as calmly as one touched yesterday (D-108).
- **Not drawn yet.** The feel pass (D-40) draws Now and *Between books* without these lines; the mockup's `bdash` frames (`design/mockups.html`, redrawn by TASK-049) gain them at phone, tablet and desktop widths before they are built: the plan draws them first and the owner sees them at the plan gate (standing rule 6, `ui.redrawFiles`).
- This is a feel-pass surface (`docs/04-design.md` § 10): its new states are screenshotted at every feel-pass width, light and dark, reduced motion and transparency.
- Decisions: D-108 (only *Reading* means reading), D-43, D-37, D-85, D-40, D-91. Data model 2.18 (start dates).

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): `etl/test_views.sql`: with a series followed `reading`
whose books 1–2 are read and 3–4 `to_read`, `follow_next` lists book 3 only;
the same series at `tracking`, or unfollowed with 2 read, has no row; an
author followed `reading` lists their earliest unread book; a shelf followed
`reading` lists its lowest unread ordinal; a DNF next book is skipped; a
series whose next book is `reading` has no row. In the browser (0.11), with
nothing reading, *Between books* lists book 3 under *Or keep going*, **Start**
sets it `reading` and Undo restores `to_read`; reading book 2 of a `reading`
series, Now shows *Next in* naming book 3. Nothing on the dashboard resolves
to `--danger`. Screenshots at 360px and 1280px.
- [ ] AC-2: `etl/test_views.sql`: a universe followed `reading` lists its lowest unread `universe_position`; an `unlisted` next book is listed; a soft-deleted book is skipped and the next live one listed; a listened book counts as read; a follow whose every live book is read has no row; `read` and `total` equal the matching `*_progress` view's counts for the series.
- [ ] AC-3: Given four `reading` follows with a next book each, *Or keep going* lists exactly three, ordered by each follow's latest finish, newest first; given the book in hand in a `reading` series that is also in a `reading` universe, Now shows one *Next in* line, the series'.
- [ ] AC-4: The *Next in* line and the *Or keep going* rows meet the UX floor (`docs/04-design.md` § 10. The UX floor): the *Next in* line is an `<a href>` whose name includes the book's title; each **Start** is a `<button>` at least 44px tall whose name names its book; the rows' grey text is 4.5:1 in both themes; nothing is amber or red; screenshots of reading-with-*Next in* and *Between books*-with-rows at 360, 390, 412, 768, 1024 and 1280px, light and dark, reduced motion and reduced transparency; axe reports no new violations.

## Out of scope

- 2.10b's plan sheet and its suggestion groups (it reads this view later).
- The follow control, the follow sheet and the finish offer (2.2c, TASK-048).
- 5.12's *In the middle of* page and 5.15's parking.
- Any nudge, streak or staleness signal about follows (D-108).
- More than one *Next in* line under Now.

## Files likely touched

- `etl/views.sql`, `etl/test_views.sql` — `follow_next` and its cases.
- `src/db/queries.ts` — the hero's *Next in* and *Between books*' rows.
- `src/components/BooksNow.tsx`, `src/components/BetweenBooks.tsx` (from TASK-049) — the line and the rows.
- `src/components/StartBook.tsx` (new; the plan may reuse `src/components/BookStatus.tsx`'s write) — **Start** with its undo.
- `design/mockups.html`, `design/mockups-index.md` — `bdash` gains both (drawn first).
- `docs/03-data-model.md` — § 3. Views, the new row.
- `test/follow-next.test.ts` (new), `test/e2e/books-dashboard.spec.ts`.

## Verification

- Automated: `etl/test_views.sql` (`npm run test:views`) for AC-1's view half and AC-2; `test/follow-next.test.ts` for AC-3's ordering and the one-line rule; `test/e2e/books-dashboard.spec.ts` for **Start** and Undo, *Next in*, `--danger` absent, axe and the screenshots.
- Manual: `npm run dev`, follow a series as *Reading* with a book left (2.2c's sheet), finish nothing → *Between books* lists it under *Or keep going*; **Start**, then Undo → the book is back to its earlier status; set the follow back as it was.

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
