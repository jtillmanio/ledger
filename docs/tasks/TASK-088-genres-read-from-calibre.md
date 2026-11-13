---
id: TASK-088
title: 4.5 Calibre's genres on every screen (1 of 2) — every genre reader takes Calibre's genres
status: Draft
depends_on: [TASK-033, TASK-047, TASK-051]
size: M
model: opus
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-088 — 4.5 Calibre's genres on every screen (1 of 2) — every genre reader takes Calibre's genres

## Goal

The Library's genre filter, each row's genre, the yearly totals and the plan rail's colours come from the genres the owner keeps in Calibre, so filtering by *Fantasy* also finds every book tagged with a kind of fantasy.

## Context

- Roadmap: `docs/05-roadmap.md` § 4.5 Calibre's genres on every screen (M16; depends on 1.18c). The entry and its **Check:** are the contract. Feature F-33 (with F-74 after it). Pulled ahead of 1.26 (D-139); 4.5b follows it.
- **Split, 1 of 2** (`workflow.splitPolicy: split`: readers across the views and the UI, then a dropped column). This part moves every reader; TASK-089 drops `books.genre`, and its merge ticks the entry.
- **The rule** (D-98; `.claude/rules/schema.md` → *Calibre owns a book's genres*): each reader takes a book's genres through the `book_genre_tree` view (`etl/views.sql`: `book_id, genre, depth, direct`), never by splitting a path in the app, so a book tagged `Fantasy.Epic Fantasy` alone is in `Fantasy` too; `books.genre` counts only for a book with no Calibre genre.
- **The readers today** (from `books.genre`):
  - the Library: `GENRES`, a hard-coded chip list in `src/app/books/list/page.tsx`; `listBooks`'s `genre` filter (`b.genre = ${genre}`) and the genre on each row (`src/db/queries.ts`);
  - `books_by_year` (`etl/views.sql`, read by `yearSummary`);
  - the plan rail's hue: `genreHue(book.genre)` in `src/lib/plan-rail.ts`, fed by the plan queries in `src/db/queries.ts` (`b.genre` in the rail and quarter-row selects) and drawn by `PlanRail.tsx`, `PlanQuarterRows.tsx` and `RailDrag.tsx`;
  - `plan_suggestions`' *A change of genre* already reads `book_genre_tree` at depth 1, else `books.genre`.
  Items not built yet that read a genre take `book_genre_tree` from the start (3.1, 3.5's book sheet, 6.2).
- **Stop and ask at plan time** (the entry): how a dotted path is shown (its last segment or the whole path); which level a chip, a year total and a hue group by; and how the 43 top-level genres map onto the eight identity hues (`--g1`–`--g8`; today a stable hash, `--g8` for none).
- An index on `book_genres(genre)` comes with the first query that filters by it (the entry): this part's genre filter, if it filters `book_genre_tree` by genre; the plan says.
- **Not here:** the Library's genre chips keeping *status* and *level* (4.5b, D-124).
- Data model: `docs/03-data-model.md` § 2. Decisions (1.18c's), § 3. Views. Design: `docs/04-design.md` § 3 Tokens (hue is identity only), § 6 The plan rail.
- Decisions: D-90, D-98, D-124. Hard rules 2 and 6.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves the filter and `books_by_year` clauses, with `books.genre` still in place for the book that has no Calibre genre. TASK-089 proves the drop and up → down → up): with one book given `book_genres` rows `Fantasy.Epic Fantasy` and
`Young Adult.Fantasy.Romantasy` and another with none and `books.genre` `Sci-Fi`,
the master list's genre filter finds the first under `Fantasy`, `Fantasy.Epic
Fantasy` and `Young Adult` and the second under `Sci-Fi`, and `books_by_year`
counts each; after the drop
migration no query, view or loader names `books.genre`, and up → down → up keeps
every `book_genres` row.
- [ ] AC-2: The Library's genre chips are the genres of live books read through `book_genre_tree` at the level the plan gate chose (plus `books.genre` values of books with none), not a hard-coded list; each chip's filter returns exactly the books the view puts under that genre.
- [ ] AC-3: A Library row shows the genre the plan gate chose (for example the last segment of the deepest direct path), and a book with no Calibre genre shows its `books.genre`.
- [ ] AC-4: `books_by_year` counts a read once per genre at the chosen level, so the fixture's first book counts under each of its top-level genres in its year, and the second under `Sci-Fi`.
- [ ] AC-5: The plan rail and the quarter rows colour a book by the hue its Calibre genre maps to under the approved mapping, and a book with no genre at all `--g8`; the same book has the same hue on the rail, the rows and while dragged.
- [ ] AC-6: The Library's genre chips meet the UX floor (`docs/04-design.md` § 10. The UX floor): real links with names (a path's full name in the accessible name if the chip shows a segment), nothing under 24px and 44px on the phone, the chip row scrolls without a horizontal page scroll at 360px, genre hues identity only and never the only cue; text 4.5:1 in both themes; axe reports no new violations; screenshots at 360px, 834px and 1280px, light and dark.

## Out of scope

- Dropping `books.genre` (TASK-089).
- The Library's genre chips keeping status and level, and On deck by genre (4.5b, TASK-090).
- Editing genres in the app (Calibre owns them, D-98).
- 6.2's genre mix.

## Files likely touched

- `src/db/queries.ts` — `listBooks`'s filter and row genre, the genre list, the plan queries.
- `etl/views.sql` — `books_by_year` over `book_genre_tree`.
- `src/app/books/list/page.tsx` — chips from the data.
- `src/lib/plan-rail.ts` — the approved genre-to-hue mapping.
- `etl/test_views.sql` — `books_by_year` over the fixture.
- `test/queries.test.ts`, `test/plan-rail.test.ts`, `test/library-page.test.tsx`.
- `drizzle/<new migration>.sql`, `drizzle/meta/*`, `src/db/schema.ts` — only the `book_genres(genre)` index, if the plan adds it.

## Verification

- Automated: `test/queries.test.ts` (AC-1's filter clauses, AC-2), `etl/test_views.sql` (AC-4), `test/plan-rail.test.ts` (AC-5), `test/library-page.test.tsx` (AC-3), `test/e2e/library-sort.spec.ts` or a new genre spec (AC-6's axe).
- Manual: on the dev database, the Library's *Fantasy* chip → books tagged only with a fantasy subgenre are listed.

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
