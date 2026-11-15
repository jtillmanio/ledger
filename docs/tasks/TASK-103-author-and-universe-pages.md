---
id: TASK-103
title: 5.11 Author and universe pages, and the follow control on them
status: Ready
depends_on: [TASK-102]
size: M
model: opus
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
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

- [ ] AC-1 (roadmap **Check:**, verbatim):
an author page and a universe page list their books with the
counts from their views. Setting *Reading* writes one follow row for the
user, survives a reload, and shows in the view's `follow_state`. *Not
following* deletes the row. No count or state column is added.
- [ ] AC-2: Given an author with 4 live books, 1 read and 1 soft-deleted, the author page reads `1 / 3` (the soft-deleted book left out), a `--ready` meter, and names the earliest-published unread book as next; the universe page does the same from `universe_progress`.
- [ ] AC-3: On an author page with no follow, choosing *Reading* writes one `author_follows` row `reading`; after a reload *Reading* is checked; *Not following* deletes it. On a universe page, *Not following* stores `off` and `universe_progress.follow_state` reads NULL. Each write raises the undo toast and its *Undo* puts the prior state back.
- [ ] AC-4: An author's name in a Library row links to its page; a universe with no live books renders its page with `0 / 0`, no meter fill and an empty state, never an error.
- [ ] AC-5: `design/mockups.html` gains the author and universe pages at phone, tablet and desktop, and `design/mockups-index.md` lists them (task 5.11); `docs/02-architecture.md` § 5 lists both routes; no migration is added.
- [ ] AC-6: Both pages meet the UX floor (`docs/04-design.md` § 10): empty state, loading skeletons, an error state, the radiogroup operable by keyboard with its name, targets ≥ 24px, contrast in light and dark, screenshots at each `ui.viewports` width.

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
