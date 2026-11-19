---
id: TASK-103
title: 5.11 Author and universe pages, and the follow control on them
status: Review
depends_on: [TASK-102]
size: M
model: opus
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: aefac9b
---

# TASK-103 — 5.11 Author and universe pages, and the follow control on them

## Goal

Every author and every universe has a page in the series page's shape, with how far through it you are, its next unread book, and the *Reading · Tracking · Not following* control.

## Context

- Roadmap: `docs/05-roadmap.md` § 5.11 Author and universe pages, and the follow control (M17; follow-up from PR #58, 1.15's *Not here*; D-42, D-43; product B6). Depends on 1.15 and 5.9 (TASK-102's page shape). After 1.26 in the tasklist's order. Feature F-20. Its **Check:** is the contract.
- **One task, not split:** two read-only pages in one shape plus placing an existing control; no schema, no new write (8 files or fewer by the list below).
- **The pages** (`/books/authors/[id]`, `/books/universes/[id]`; the paths are the plan's, added to `docs/02-architecture.md` § 5): `read / total` in mono from `author_progress` and `universe_progress` (`etl/views.sql`: live books only, a book with no status unread, no stated total), an `.emeter` filled with `--ready`, the next unread book (derived in the query, never stored: an author's by `published_year`, a universe's by `universe_position`, as `follow_queue` ranks them), and the books listed as TASK-102 lists a series'. A universe page groups its books under their series (D-119's nesting, as Now's rows do), if the plan agrees.
- **The control** (*Amended by the second 2026-11-02 intake, D-108*): 2.2c built it and its writes (`src/components/FollowSheet.tsx`, `POST /api/follows`, `setFollow` in `src/db/writes.ts`); this task places it on the author and universe pages and builds no control of its own. A `role="radiogroup"`; its middle choice reads *On hold* on something part-read and *Tracking* otherwise (D-118); *Not following* on a universe is a stored `off` (D-117, D-127), on an author it deletes the row (an author has no `off`). The Check's *Not following deletes the row* holds for an author; for a universe it stores `off`, which the view reads as `follow_state` NULL: the plan asserts each kind's real behaviour. The series page's control is TASK-102's (owner, at conversion, 2026-11-15: 5.11's D-108 amendment wins over 5.9's older *5.11 adds the follow control*), so this task places it on the author and universe pages only.
- **From TASK-023 (1.15, PR #134):** nothing sets a book's `universe_id` after the load, and Grishaverse loads with no member books (the books its Series-tab group lists are reads, which D-41 never loads), so its page would show 0/0 until a book can be put in a universe; **settle where that happens at this task's plan gate** (Calibre's `#superseries` is the universe's only source since 1.18b, D-90, so the answer may be *in Calibre, through 4.4's sync*). The first vitest suite that writes `book_universes` adds it to `truncateAll` in `test/db.ts`, which today clears it only through `books`' CASCADE.
- **Links:** an author's and a universe's name links to its page where the app prints it (a Library row, *where the book sits*, the follow sheet), as TASK-102 links series names.
- **Not drawn yet:** the mockup gains an author page and a universe page at phone, tablet and desktop, in this PR (`ui.redrawFiles`). The old `shelves` frame's *Stephen King* and *Cosmere* rows are those pages' content (D-42 moved them off shelves).
- Design: `design/mockups.html` § `follow` (the control), § `shelves` (the row shape); `docs/04-design.md` § 10 The UX floor.
- Decisions: D-41, D-42, D-43, D-90, D-108, D-117, D-118, D-119, D-127. Hard rule 2.

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim):
an author page and a universe page list their books with the
counts from their views. Setting *Reading* writes one follow row for the
user, survives a reload, and shows in the view's `follow_state`. *Not
following* deletes the row. No count or state column is added.
- [x] AC-2: Given an author with 4 live books, 1 read and 1 soft-deleted, the author page reads `1 / 3` (the soft-deleted book left out), a `--ready` meter, and names the earliest-published unread book as next; the universe page does the same from `universe_progress`.
- [x] AC-3: On an author page with no follow, choosing *Reading* writes one `author_follows` row `reading`; after a reload *Reading* is checked; *Not following* deletes it. On a universe page, *Not following* stores `off` and `universe_progress.follow_state` reads NULL. Each write raises the undo toast and its *Undo* puts the prior state back.
- [x] AC-4: A universe with no live books renders its page with `0 / 0`, no meter fill and an empty state, never an error. (*An author's name in a Library row links to its page* moved to TASK-125, owner at plan, 2026-11-18: it edits the same Library row as TASK-125's series links.)
- [x] AC-5: `design/mockups.html` gains the author and universe pages at phone, tablet and desktop, and `design/mockups-index.md` lists them (task 5.11); `docs/02-architecture.md` § 5 lists both routes; no migration is added.
- [x] AC-6: Both pages meet the UX floor (`docs/04-design.md` § 10): empty state, loading skeletons, an error state, the radiogroup operable by keyboard with its name, targets ≥ 24px, contrast in light and dark, screenshots at each `ui.viewports` width.

## Out of scope

- A new follow control or new follow writes (2.2c's).
- Setting a book's universe in the app (settled at the plan gate; built elsewhere if at all).
- The series page (TASK-102), `/progress` (5.12).

## Files likely touched

- `src/app/books/authors/[id]/page.tsx`, `src/app/books/universes/[id]/page.tsx` (+ `loading.tsx` each; new).
- `src/db/queries.ts` — one author's and one universe's books, counts and next unread.
- `src/components/FollowControl.tsx` (if the plan lifts the radiogroup out of `FollowSheet.tsx`), `src/components/FollowSheet.tsx`.
- `src/lib/format.ts` / `src/app/books/list/page.tsx` — author names as links.
- `test/db.ts` (`truncateAll` gains `book_universes`), `test/author-universe-pages.test.ts` (new), `test/e2e/author-universe.spec.ts` (new).
- `design/mockups.html`, `design/mockups-index.md`, `docs/02-architecture.md`.

## Verification

- Automated: `test/author-universe-pages.test.ts` (counts against the views, next unread, soft delete, the follow writes on `TEST_DATABASE_URL`), `test/e2e/author-universe.spec.ts` (AC-1's browser clauses, AC-3's reload, AC-4, axe; screenshots), `test/follows.test.ts` still green.
- Manual: on the dev database, Library → an author's name → the author page → *Reading* → reload → still *Reading* → *Undo*. Leave the data as found.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- Every author and universe name links to its page (a Library row, *where the book sits*, the follow sheet), with TASK-125's series links in the same row code; AC-4's first clause moved there (approved at plan) → docs/tasks/TASK-125-series-name-links.md § Context
- The dashboard's *Or keep going* (`follow_next`) names nothing while the first open book of a follow is in hand; the page marks the next unread after it (`seriesPage`'s rule, as the series page does), so the two can differ mid-book → not tracked: the series page already works this way, and `follow_next`'s comment says why it differs
- No index on `books.author_id` or `books.universe_id` (schema review, MINOR): each page scans `books`, as `author_progress` and `universe_progress` do; at ~1,400 books it costs nothing → not tracked: no measurable cost at this size

## Plan

Approved by the owner, 2026-11-18, with three answers at the gate: the name links go to TASK-125; the 5.15 worktree was removed for its test slot; a universe page offers both orders.

**Settled at the gate (the Grishaverse question, from TASK-023):** 4.4's sync (`src/db/calibre-sync.ts`) already sets `books.universe_id` and `universe_position` from Calibre's `#superseries` (D-90, D-133). A book joins a universe by setting `#superseries` in Calibre and running `npm run calibre:sync`; nothing in the app sets it, and nothing new is built.

**Steps**

1. `src/db/queries.ts`: `authorPage(userId, id)` and `universePage(userId, id)`, each `{ id, name, read, total, unread, followState, books, nextId }` in `seriesPage`'s shape. Counts and `followState` from `author_progress` / `universe_progress` (your row); `unread` the live books neither read nor DNF (`bookGroupings`' rule, for *On hold*); books with status, level and dates as `seriesPage` reads them, plus `published_year` (author) or `universe_position` and the series' id, name and position (universe). Order: an author's by `published_year` NULLS LAST, title, id; a universe's by `universe_position` NULLS LAST, title, id (`follow_queue`'s). Next unread: the first in that order with no status, `to_read` or `unlisted` (`follow_next`'s rule); none when `read >= total`. Unknown id → null.
2. `src/components/GroupingBooks.tsx` (new): the page in `SeriesBooks`' shape: *‹ Library*, the name, `read / total` in mono, a `--ready` meter, `FollowControl`, the rows (`SeriesBooks`' row, exported, with the year or `#position` in the mono slot), *Next up*. The control is drawn when the page has a live book or a stored follow (POST refuses following something with no live book). A universe page has *By series · In order* (links, `?order=flat`): by series, one group per series headed by its name (a link to its series page), groups by their earliest `universe_position`, books with no series last under *Not in a series*; in order, one list with each row's series and `#n` on its second line. No live books: an `EmptySlate`.
3. Routes `src/app/books/authors/[id]/` and `src/app/books/universes/[id]/`: `page.tsx`, `loading.tsx`, `error.tsx` each, as `series/[id]`'s.
4. `src/app/globals.css`: the group heading and the order switch, from tokens.
5. `test/db.ts`: `truncateAll` gains `book_universes`.
6. Tests (below). 7. `design/mockups.html` gains the `author` screen (author page at phone, tablet, desktop; universe by series at phone, tablet, desktop and in order at phone; empty universe at phone) with notes; `design/mockups-index.md` its row; `docs/02-architecture.md` § 5 both routes.

**Files**: the 6 route files, `GroupingBooks.tsx`, `SeriesBooks.tsx` (export the row), `queries.ts`, `globals.css`, `test/db.ts`, the 2 tests, `mockups.html`, `mockups-index.md`, `02-architecture.md`. Not touched (moved to TASK-125): `src/app/books/list/page.tsx`, `src/lib/format.ts`. `SeriesBooks.tsx` and `globals.css` are outside "Files likely touched".

**Test strategy**

- AC-1, AC-2: `test/author-universe-pages.test.ts`: *an author page reads its view's counts, leaves a removed book out and names the earliest-published unread as next*; the same for a universe from `universe_progress` by `universe_position`; *a universe with no live books reads 0 / 0 with no next*.
- AC-1, AC-3: the same file: *Reading on an author writes one row and shows in follow_state; Not following deletes it*; *Not following on a universe stores off and follow_state reads NULL* (through `POST /api/follows`, as `test/follows.test.ts` does). `test/e2e/author-universe.spec.ts`: choose *Reading*, reload, still checked, *Undo* puts the prior state back; universe *Not following*.
- AC-4, AC-6: e2e: the empty universe (`0 / 0`, meter at 0, the slate), the loading skeleton at the loaded size, the error state, the order switch, axe, contrast light and dark, 24px targets, no sideways scroll, the radiogroup by keyboard, screenshots at each width.
- AC-5: diff review (spec-reviewer), and `drizzle/` unchanged.

**Changes beyond the file list (after the plan, small and in scope):** `test/query-budget.test.ts` and the Performance budget line in `docs/02-architecture.md` count both routes (1 query, 1 wave each), as every page is counted; `design/mockups.html`'s screen nav gains *Series* (missing since TASK-101/102, so that screen could not be opened) beside the new *Author & universe*; `design/mockups-index.md` has every row's line range recomputed (most were stale, and this branch's insertions shift them all). The skeleton is `GroupingSkeleton` in `GroupingBooks.tsx`, not a new file. Spec review R1 asked for AC-5's universe frames at 834px and desktop: drawn (*By series*). UI review R1 found no gap between the lede and the list at 1024px and up (the side moves to the rail): `.sp-main` takes the mockup's 1rem there, which the series page shares.

**Risks**: the universe switch is a URL parameter, so no client state; real universes on the test DB are found by name, never by index.

## Review log

_Filled by /implement-task. One line per round._

- Verify R1 PASS | CI R1 cancelled (superseded by the R2 push) | Schema R1 APPROVE (comment wording, MINOR → fixed) | Spec R1 CHANGES (AC-5 universe frames at 834px and desktop, follow-up destination, unexplained files) → fixed | CI R2 PASS (every width, light and dark) | Spec R2 APPROVE | Audit R1 PASS | UI R1 CHANGES (desktop gap under the lede) → fixed, both specs PASS at w1280 | Verify R2 PASS | Close-out follow-ups check APPROVE | Schema not re-run: no data-layer change after its APPROVE (the comment only)
- UI R1 notes not acted on: the empty universe could not be walked (no empty universe on the dev database; `test/e2e/author-universe.spec.ts` covers it at every width); a one-word title link (*It*) is 12px wide, inline text under the target-size exception, as on the series page.

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 2
- Review rounds: 2 (spec), 1 (schema), 1 (UI), 1 (audit)
- First-pass AC FAILs: 1 (AC-5, the universe frames at 834px and desktop)
- Plan revisions after approval: 2 (the files beyond the list, recorded in the Plan; the desktop gap)
