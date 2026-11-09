---
id: TASK-050
title: 2.2d Next in what you're reading, on the dashboard
status: In progress
depends_on: [TASK-049, TASK-048]
size: L
model: opus
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: c867967
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
- *From TASK-049 (2.2, PR #196):* the *Next in* line goes under the hero in `src/components/BooksNow.tsx`, and *Or keep going* under the offer in `src/components/BetweenBooks.tsx`. 2.2 leaves both as named slots.
- **From the 2026-11-05 intake (2.2h, D-117).** If 2.2h has landed, `follow_next` also lists each subseries followed as `reading`, its next book the lowest unread `subseries_position`, and the *Next in* line prefers the subseries, then the series, the universe and the author. A `state` of `off`, if the 2.2h plan gate approves it, counts as no follow. 2.2g's rows sit above the *Next in* line. If 2.2h has not landed, build as written.
- *From TASK-055 (2.2h, PR #204):* 2.2h has landed (migration 0023, D-127). `subseries_follows(subseries_id, state)` has no `user_id`, and `subseries_progress(user_id, subseries_id, name, series_id, books_listed, books_read, pct, follow_state)` reads it. `off` was approved: `series_follows`, `universe_follows` and `subseries_follows` can hold it, and `series_progress`, `universe_progress` and `subseries_progress` give `follow_state` NULL for it, so read `follow_state` from the views, never the tables' raw `state`. 2.2h's "a book left" is a live book neither read nor DNF, which matches `follow_next`'s skipping a DNF.

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

Approved by the owner 2026-11-09, with the three plan-gate questions answered yes (below). Kept whole: #205 left TASK-049–051 as sized under `never-split`.

**Steps**

1. **Drawn first.** `bdash` in `design/mockups.html` gains *Next in* on its reading frames (390, 834, desktop) and *Or keep going* on its *Between books* frames (390, 360, 834, desktop); its notes and `design/mockups-index.md` say so. The owner looks before step 2 (as TASK-049).
2. **The views**, tests first in `etl/test_views.sql` (AC-1's view half, AC-2), then `etl/views.sql`:
   - `follow_queue(user_id, kind, entity_id, name, book_id, status, rank)`: every open live book of each follow at *Reading*, read through the `*_progress` views' `follow_state` (so `off` is no follow). Kinds: subseries, series, universe, author, shelf. Rank: `subseries_position` / `series_position` / `universe_position` / shelf `ordinal` / author `published_year`, each NULLS LAST, then title, id. *Open* is a list of the statuses that count: `to_read`, `unlisted`, no status row (counted unread, as the progress views do; owner Q3), `reading`, `listening`. Read (a listen included), DNF and anything later, such as 5.15's `parked`, are skipped with no change to the view.
   - `follow_next(user_id, kind, entity_id, name, book_id, read, total, last_read_on)`: each follow's rank-1 book when it is unread (`to_read`, `unlisted`, no status); rank 1 in hand (Reading or Listening) means no row. `read`/`total` from the progress view (a series' `total_books`); `last_read_on` the follow's latest dated finish over its live books (`book_reads`), NULL when none: "most recently read first".
3. **Queries**, tests first in `test/follow-next.test.ts` (AC-3), then `src/db/queries.ts`: `keepGoing(userId, offerId, 3)` reads `follow_next`, one row per book with the narrowest reason (subseries, series, universe, author, shelf; owner Q2), leaves out the top-of-plan offer's book (owner Q2), orders by `last_read_on DESC NULLS LAST`, then name; `nextIn(userId, heroId)` reads `follow_queue`: of the follows holding the book in hand, the lowest-ranked unread book, subseries before series, universe and author (never a shelf), or null.
4. **UI.** `BooksNow.tsx`: one grey *Next in {name}: {title}* line, an `<a href>` to the Library row (`/books/list?q=<title>`), after the band and before the foot (no meter until 2.1b). `BetweenBooks.tsx`: *Or keep going* under the offer, up to three rows (title, *Next in Red Rising · 3 of 6 read*, **Start**). `StartBook.tsx` (new): a 44px `<button>` named *Start {title}*, through `ThumbBar.tsx`'s `useBookVerb`, now exported (its retry, and focus to the thumb bar's verb once the row is gone). `src/app/books/page.tsx` fetches both; `src/app/globals.css` styles them (tokens only, grey, nothing amber or red).
5. **Browser** (`test/e2e/books-dashboard.spec.ts`): **Start** then Undo restores `to_read`; reading book 2 shows *Next in* naming book 3; no `--danger`; UX floor names and sizes; axe; screenshots of both states at every feel-pass width, light and dark, reduced motion and transparency.
6. `docs/03-data-model.md` § 3. Views: the two rows.

**Files**: `design/mockups.html`, `design/mockups-index.md`, `etl/views.sql`, `etl/test_views.sql`, `src/db/queries.ts`, `src/components/BooksNow.tsx`, `src/components/BetweenBooks.tsx`, `src/components/StartBook.tsx` (new), `src/components/ThumbBar.tsx` (not in the task's list: exports `useBookVerb`), `src/app/books/page.tsx` (not listed: fetches both), `src/app/globals.css` (not listed: the styles), `docs/03-data-model.md`, `test/follow-next.test.ts` (new), `test/e2e/books-dashboard.spec.ts`.

**Test strategy**: AC-1 (views) and AC-2 → `etl/test_views.sql`, one block per case; AC-1 (browser) → `books-dashboard.spec.ts` *Or keep going: Start and Undo*, *Next in names the next book*, *nothing resolves to --danger*; AC-3 → `test/follow-next.test.ts` *three of four, newest finish first* and *one line, the series'*; AC-4 → the spec's names, 44px, contrast, axe and screenshot tests.

**Plan-gate answers (owner, 2026-11-09)**: Q1 the two-view shape: yes. Q2 one row per book with the narrowest reason, and the offer's book left out: yes to both. Q3 a book with no status row counts as unread: yes.

**Plan revision 1 (owner, 2026-11-09, after verify R1).** Two failures outside the plan's files: (a) `drizzle/down/0011_dated_reading_log.sql` drops `book_reads`, which the new views read, so the 0007 and 0011 round-trip tests failed; it drops `follow_next` and `follow_queue` first, as 2.1 did for its capacity views. (b) `/books` went to 10 queries in two waves. Now one wave: *Next in* is `booksInHand`'s `next_in` (no `nextIn` query; `test/follow-next.test.ts` reads it there), and `keepGoing(userId, period, limit)` leaves out the quarter's offer by `quarterShelf`'s rule itself. `test/query-budget.test.ts` and `docs/02-architecture.md` § Operational posture raise `/books` from 9 to 10 queries with that reason. `follow_queue` also carries `read`, `total` and `last_read_on` at its end (the follow's, for `follow_next`).

**Risks**: the loading skeleton has no *Next in* row, so the spec's geometry check may need one; the e2e fixture's series, shelf and follows need cleaning as its books are.

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
