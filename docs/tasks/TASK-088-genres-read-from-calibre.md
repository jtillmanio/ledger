---
id: TASK-088
title: 4.5 Calibre's genres on every screen (1 of 2) — every genre reader takes Calibre's genres
status: Review
depends_on: [TASK-033, TASK-047, TASK-051]
size: M
model: opus
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: 11d4126
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

- [x] AC-1 (roadmap **Check:**, verbatim; this part proves the filter and `books_by_year` clauses, with `books.genre` still in place for the book that has no Calibre genre. TASK-089 proves the drop and up → down → up): with one book given `book_genres` rows `Fantasy.Epic Fantasy` and
`Young Adult.Fantasy.Romantasy` and another with none and `books.genre` `Sci-Fi`,
the master list's genre filter finds the first under `Fantasy`, `Fantasy.Epic
Fantasy` and `Young Adult` and the second under `Sci-Fi`, and `books_by_year`
counts each; after the drop
migration no query, view or loader names `books.genre`, and up → down → up keeps
every `book_genres` row.
- [x] AC-2: The Library's genre chips are the genres of live books read through `book_genre_tree` at the level the plan gate chose (plus `books.genre` values of books with none), not a hard-coded list; each chip's filter returns exactly the books the view puts under that genre.
- [x] AC-3: A Library row shows the genre the plan gate chose (for example the last segment of the deepest direct path), and a book with no Calibre genre shows its `books.genre`.
- [x] AC-4: `books_by_year` counts a read once per genre at the chosen level, so the fixture's first book counts under each of its top-level genres in its year, and the second under `Sci-Fi`.
- [x] AC-5: The plan rail and the quarter rows colour a book by the hue its Calibre genre maps to under the approved mapping, and a book with no genre at all `--g8`; the same book has the same hue on the rail, the rows and while dragged.
- [x] AC-6: The Library's genre chips meet the UX floor (`docs/04-design.md` § 10. The UX floor): real links with names (a path's full name in the accessible name if the chip shows a segment), nothing under 24px and 44px on the phone, the chip row scrolls without a horizontal page scroll at 360px, genre hues identity only and never the only cue; text 4.5:1 in both themes; axe reports no new violations; screenshots at 360px, 834px and 1280px, light and dark.

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

- Calibre carries stray top-level genres (`l`, `i`, `Scie`, `Ecomonics`), which now become Library chips; fix them in Calibre, then `npm run calibre` and extract (approved at plan) → docs/OWNER-CHECKLIST.md § Actions from follow-ups
- TASK-089: the drop removes `book_genre_levels`' workbook-fallback branch; no reader changes (approved at plan) → docs/tasks/TASK-089-drop-books-genre.md § Context
- TASK-090: `listCounts().genres` and `book_genre_levels` serve On deck's top-level genre sections (approved at plan) → docs/tasks/TASK-090-on-deck-by-genre.md § Context
- `test/reading-log.test.tsx` › *two reads: All reads (2)…* is a timing flake: `openReads` waits a fixed 25ms for the lazy reads chunk, and under the full suite's load the list isn't there yet (`list()` null at :680); it passes alone. Wait for the list instead (`vi.waitFor`). Not this task's code (approved at close-out) → docs/OWNER-CHECKLIST.md § Actions from follow-ups
- Candidate decision: the plan-gate answers (row shows the deepest direct path's last segment; chips and year totals at depth 1; seven hue families, family order for a book with several) (approved at close-out) → docs/review/decisions.md § D-149
- Schema review R1: `.claude/rules/schema.md` still said `books.genre` stays the workbook's until 4.5, and `docs/03-data-model.md` § 3. Views had no `book_genre_levels` row and called `books_by_year` per genre (approved at close-out) → docs/03-data-model.md § 3. Views, .claude/rules/schema.md § Calibre owns a book's genres
- ui-verifier: AC-5's hue couldn't be seen in the browser, as the development database has no planned books; `test/plan-page.test.tsx` renders the plan page and the dashboard strip with seeded plans and checks each hue → not tracked: covered by the automated tests, no plan rows written to development data
- ui-verifier: the chip row shows the browser's own horizontal scrollbar under the chips on a desktop pointer (the sideways-scroll affordance) → not tracked: accepted as is, a hidden scrollbar would hide that the row scrolls

## Plan

_Approved 2026-11-13. Plan-gate answers (the entry's questions): a Library row shows the last segment of the book's deepest direct path (ties: alphabetical by path); chips are top-level genres only; year totals count at depth 1; hues are seven families in a hand-written table, a book with several top-level genres taking the first family in `--g1`…`--g7` order; `--g8` for no genre._

**Steps**

1. `etl/views.sql`: new view `book_genre_levels (book_id, genre, depth, direct, name)` — `book_genre_tree`'s rows, plus a book with no `book_genres` row's `books.genre` as one depth-1 direct row; case folded per book (`min(genre COLLATE "C")` grouped on `lower(genre)`); `name` is a path's last segment (SQL, never the app). The one home of the fallback, so TASK-089 drops only that branch. `books_by_year` counts each read once per depth-1 genre of `book_genre_levels` (NULL for a book with none). `plan_suggestions`' `top_genre` reads `book_genre_levels` at depth 1 instead of its own union.
2. `src/db/queries.ts`: `listBooks` filters with `EXISTS (book_genre_levels, any depth, lower(genre) = lower($genre))`; a row's `genre` is the `name` of its deepest direct path (ties alphabetical by path). `listCounts` gains `genres`: depth-1 genres of the live books the list's *Everything* shows (not Unlisted), merged case-insensitively, most books first, then by name (in the page's one chip query, task 0.9's budget; *revision 1*). `yearSummary` becomes reads per year from `book_reads` (the year chips; summing `books_by_year` would now count a two-genre read twice; *revision 1*). `planRail`, `planRows` and `quarterBlocks` return `genres text[]` (depth-1, sorted; *revision 2*).
3. `src/lib/plan-rail.ts`: `GENRE_FAMILIES` (g1 Fantasy; g2 Science Fiction; g3 Young Adult, Childrens; g4 Thriller, Mystery, Crime; g5 Horror, Paranormal; g6 History, Science, Biography, Autobiography, Nonfiction, Politics, Business, Religion, Christian, Psychology, Philosophy, Sociology, Ecomonics, Health, Food, Travel, Sports, Popular Culture, Games, Video Games, Survival; anything else g7); `genreHue(genres: string[])` = first family the book has, `--g7` for an unmapped genre, `--g8` for none. `RailBook.genres`; `PlanRail.tsx`, `PlanQuarterRows.tsx`, `RailDrag.tsx` pass it.
4. `src/app/books/list/page.tsx` + `src/app/globals.css`: chips from `listCounts().genres` in `role="group"` `aria-label="Genre"`, one row scrolling sideways (no page scroll), 44px on the phone; year chips from `yearSummary`, one row a year.
5. `design/mockups-index.md`: a not-drawn note — the Library's genre chip row (4.5) is built, not drawn.

**Files**

- `etl/views.sql` — `book_genre_levels`, `books_by_year`, `plan_suggestions`' `top_genre`.
- `src/db/queries.ts` — `listBooks` filter and row genre, `listCounts().genres`, `yearSummary`, rail/rows/strip `genres`.
- `src/app/books/list/page.tsx` — chips and year chips from the data.
- `src/lib/plan-rail.ts` — family table, `genreHue`.
- `src/components/PlanRail.tsx`, `PlanQuarterRows.tsx`, `RailDrag.tsx` — *not in Files likely touched* (named in Context): pass `genres`. (`QuarterStrip.tsx` unchanged: it spreads `quarterBlocks`' rows, now with `genres`.)
- `src/app/globals.css` — *not listed*: the scrolling genre row.
- `design/mockups-index.md` — *not listed*: the not-drawn note.
- Tests: `etl/test_views.sql`, `test/queries.test.ts`, `test/plan-rail.test.ts`, `test/library-page.test.tsx`; *not listed*: `test/year-chips.test.tsx`, `test/list-totals.test.tsx` (the new `yearSummary` and `listCounts` shapes), `test/plan-page.test.tsx` (AC-5 across the rail, rows and the dashboard strip), `test/books-dashboard.test.ts`, `test/e2e/plan-rail.spec.ts`, `test/e2e/skeletons.spec.ts` (fixtures: `genres`), new `test/e2e/library-genres.spec.ts`.

**Index**: none. The filter is a per-book `EXISTS` through the view, which reads `book_genres` by its primary key (`book_id` first); no query filters `book_genres` by `genre`, so an index on it would go unused.

**Test strategy**

- AC-1 (filter clauses), AC-2, AC-3 (row genre): `test/queries.test.ts` › *genres from Calibre (task 4.5)* — the Check's fixture; filter finds book 1 under `Fantasy`, `Fantasy.Epic Fantasy`, `Young Adult` (and not `Sci-Fi`), book 2 under `Sci-Fi`; `listCounts().genres` = the depth-1 genres of listed books, an Unlisted book's genre making no chip, and each chip's `listBooks` = the view's books under it; rows read `Romantasy` and `Sci-Fi`; `yearSummary` counts book 1 once.
- AC-1 (`books_by_year` counts each), AC-4: `etl/test_views.sql` — 2025 has one read each under `Fantasy`, `Young Adult`, `Sci-Fi`.
- AC-5: `test/plan-rail.test.ts` — the family table, family order, `--g7` unmapped, `--g8` none; `planRail`/`planRows` return Calibre's depth-1 genres else `books.genre`. Same `genreHue(book.genres)` call in the three components.
- AC-3 render, AC-2 chips from data: `test/library-page.test.tsx`.
- AC-6: `test/e2e/library-genres.spec.ts` — chip names, ≥ 44px at 360px, no horizontal page scroll, axe, screenshots 360/834/1280 light and dark.

**Risks**: the year chips change source; reading-log tests (single or no genre) should hold.

**Revisions after approval**

1. Chips and year chips through the existing `listCounts` and `yearSummary`, not new `libraryGenres` and `readYears`: the page keeps one chip query (task 0.9's budget), and `yearSummary`'s only reader is the year chips. Same results, no new function.
2. `quarterBlocks` returns `genres` instead of dropping `b.genre`: the plan called it unused, but `QuarterStrip.tsx` spreads its rows into `RailBook`, so the books dashboard's strip draws the hue from it (AC-5: one book, one hue).

**Size**: ~9 source and 7 test files, no schema. Already part 1 of 2; a further split would part the rail's hue from its data, so kept whole.

## Review log

_Filled by /implement-task. One line per round._

- Verify R1 FAIL(1: reading-log.test.tsx flake, passes alone; follow-up) → R2 PASS (tsc, lint, test:no-e2e: 1705 vitest, views SQL, 381 ETL) | touched specs in w390-light PASS (library-genres 4/4 after a cleanup-order fix, plan-rail, skeletons)
- Spec R1 APPROVE | Schema R1 APPROVE (3 MINOR: lower() under "C" folds ASCII only → COLLATE "default" on the readers this task added (not provable on the C-collated test databases); the workbook fallback untrimmed → btrim, new test fails without it; data-model/schema.md views docs → follow-up) | Verify R3 PASS (1706 vitest, views SQL, 381 ETL) | Spec R2 APPROVE | Schema R2 APPROVE | CI R1 (8a1cc77) cancelled, superseded → CI R2 (14ba99b) PASS, every project
- Audit R1 CHANGES (1 NON-DISCRIMINATING: queries.test.ts › counts a read once in its year's chip passed on base) → strengthened (books_by_year two rows vs yearSummary one; fails on base 11d4126) | Verify R4 PASS (1706 vitest, views SQL, 381 ETL) | CI R3 (bce54ee) PASS, every project
- UI R1 PASS on the development database (db:views applied with the owner's OK): chips a named group of 34 real links, Fantasy finds subgenre-only books, rows name the last segment, 44px under 768px and 29.5px above, one scrolling row, no page scroll at 360px, contrast ≥ 5.5:1 light and dark, focus ring unclipped, axe 0 at 360 and 1280 light and dark, year chips not inflated; AC-5 not visible (no planned books on dev), covered by test/plan-page.test.tsx | Close-out: follow-ups placed (D-149, OWNER-CHECKLIST ×2, TASK-089/090 Context, data model and schema.md approved); roadmap: nothing to tick (4.5 waits for TASK-089)
- Lighthouse R1 FAIL on 8a1cc77, 14ba99b, bce54ee (library: document + RSC 70,314 bytes, budget 70,000; the data-driven chip row) → fixed: only the chosen genre chip carries aria-current (~43 bytes a chip in the HTML and RSC payload) | Verify R5 PASS (1706 vitest, views SQL, 381 ETL) | touched specs PASS (library-page, library-genres 4/4)

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 5 (R1 flake, R2–R5 PASS)
- Review rounds: 2 (spec and schema R1 APPROVE with minors fixed, R2 APPROVE; audit R1 1 non-discriminating test fixed; UI R1 PASS)
- First-pass AC FAILs: 0
- Plan revisions after approval: 2
