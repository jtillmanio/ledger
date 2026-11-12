---
id: TASK-062
title: 2.2j The universe and series on a book's row
status: Done
depends_on: [TASK-049]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: a6074cb
---

# TASK-062 — 2.2j The universe and series on a book's row

## Goal

Every book row's second line names the author and where the book belongs, its universe and then its series and number, and reads the same on every books screen.

## Context

- Roadmap: `docs/05-roadmap.md` § 2.2j The universe and series on a book's row (M10; owner intake 2026-11-09, D-134). The entry and its **Check:** are the contract. Feature F-75. Depends on 2.2 (TASK-049: On deck and *Up next in Qn*). The owner pulled it ahead of 1.26 on 2026-11-10 (D-139): it is built before the books cutover.
- **Sized M, not the entry's S:** seven code files over two adjacent layers (queries and UI), plus the mockup redraw.
- **One line, one rule (D-134).** The author, then its place: the universe (D-90: Calibre's superseries), then the series and `#position` (*Brandon Sanderson · Cosmere · Mistborn #4*). No universe: the series alone (*Robot #2*). No series: the universe alone, unnumbered (*First Law World*). Neither: the author alone. A series with no position drops the `#`. When the series name already contains the universe's, case-insensitively, the universe is dropped (*Magic Tree House #3*). The subseries isn't on this line (2.2g draws it in Now).
- **One helper, read everywhere.** A pure function in `src/lib/format.ts` (proposed: `bookPlace`) builds the line and replaces `bookSub`'s series part (`format.ts` around line 109, read by `PlanQuarter.tsx` and `StatusBookRow.tsx`) and the Library's inline join (`src/app/books/list/page.tsx` around line 147). Its queries in `src/db/queries.ts` add the universe's name (`books.universe_id` → `book_universes`): `onDeck`, `quarterShelf`, `listBooks`, `booksInFlight`, `booksUpNext`, `booksDone`. Nothing is stored (Hard rule 2).
- **Where.** On deck (`OnDeckRow.tsx`) and *Up next in Qn* (`PlanShelf.tsx`) on the dashboard, neither of which shows a series today; the status tabs (`StatusBookRow.tsx`, `PlanQuarter.tsx`) and the Library, today *Series #n*, which now gain the universe. 2.10b's suggestion rows (TASK-072) use it when built. The plan rail's blocks have no second line, so 2.2b is unchanged.
- **The line wraps rather than truncates:** *The Chronicles of Thomas Covenant the Unbeliever* stays readable at 360px.
- **Not drawn yet.** The mockup's `bdash` frames show the line on On deck and Up next at phone, tablet and desktop widths before it is built, at the plan gate (`ui.redrawFiles`: `design/mockups.html`, `design/mockups-index.md`). The figures in the frames are sample data (D-7).
- `/books` has a query budget (`scripts/perf/budget.json`, TASK-049); the universe is a join on queries that already run, not a new query.
- The dashboard is a feel-pass surface (`docs/04-design.md` § 10), so its changed rows are screenshotted at every feel-pass width, light and dark.
- Design: `docs/04-design.md` § 12. The dashboards → Books dashboard; § 11.2 Status screens.
- Decisions: D-134, D-90, D-40, D-7. Hard rule 2.

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim): `npm test`: `bookPlace` returns *Cosmere · Mistborn #4* for a book
with both, *Robot #2* for a series alone, *First Law World* for a universe
alone, an empty place for neither, *Mistborn* for a series with no position,
and *Magic Tree House #3* when the series name contains the universe's;
`onDeck` and `quarterShelf` return the universe's name. In the browser (0.11),
an On deck row and an *Up next* row for *The Alloy of Law* read *Brandon
Sanderson · Cosmere · Mistborn #4*, and the same book reads the same on its
status tab and in the Library. There is no horizontal scroll at 360px, axe
passes, and nothing resolves to `--danger`. Screenshots at 360px and 1280px.
- [x] AC-2: The universe is dropped whatever the case: a universe *MAGIC TREE HOUSE* with a series *Magic Tree House: Merlin Missions* at position 2 gives *Magic Tree House: Merlin Missions #2*. A whole-number position prints without a decimal (`#4`, not `#4.0`).
- [x] AC-3: `listBooks`, `booksInFlight`, `booksUpNext` and `booksDone` also return the universe's name, null for a book with none; no other builder of the line is left (`bookSub`'s series part and the Library's inline join are gone).
- [x] AC-4: A row for a book in *The Chronicles of Thomas Covenant the Unbeliever* shows the series name in full at 360px, wrapped and with no ellipsis, and the page has no horizontal scroll.
- [x] AC-5: The changed rows meet the UX floor (`docs/04-design.md` § 10. The UX floor), on a feel-pass surface: the line's text is 4.5:1 in both themes, the loading states (`src/app/books/loading.tsx`, `src/app/books/status/loading.tsx`, `src/app/books/list/loading.tsx`) keep the rows' height or the plan says why no layout shift goes over budget, axe reports no new violations, and screenshots at 360, 390, 412, 768, 1024 and 1280px, light and dark, with reduced motion and reduced transparency.

## Out of scope

- The subseries on the row (2.2g draws it in Now).
- The plan rail's blocks (2.2b), which have no second line.
- Links from the line to series or universe pages (5.9, 5.11).
- 2.10b's suggestion rows (TASK-072), which reuse the helper later.

## Files likely touched

- `src/lib/format.ts` — `bookPlace`; `bookSub` keeps the author only, or goes.
- `src/db/queries.ts` — the universe's name on six queries.
- `src/components/OnDeckRow.tsx`, `src/components/PlanShelf.tsx` — the line on the dashboard.
- `src/components/StatusBookRow.tsx`, `src/components/PlanQuarter.tsx` — the status tabs.
- `src/app/books/list/page.tsx` — the Library's row.
- `design/mockups.html`, `design/mockups-index.md` — `bdash` gains the line (drawn first).
- `test/format.test.ts` (new) or `test/books-dashboard.test.ts`, `test/queries.test.ts`, `test/e2e/books-dashboard.spec.ts`, `test/e2e/status.spec.ts`, `test/e2e/library-sort.spec.ts`.

## Verification

- Automated: a vitest file for `bookPlace` (AC-1's cases, AC-2); `test/books-dashboard.test.ts` / `test/queries.test.ts` (the six queries' universe name, AC-3); `test/e2e/books-dashboard.spec.ts` (AC-1's browser rows, AC-4, axe, `--danger` absent, the feel-pass screenshots); `test/e2e/status.spec.ts` and `test/e2e/library-sort.spec.ts` (the same line on the status tab and the Library).
- Manual: `npm run dev`. On `/books`, a book in a universe and a series on On deck → *Author · Universe · Series #n*. Find it on its status tab and in the Library → the same line. Resize to 360px → long series names wrap, no sideways scroll.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- Add books' search results (`src/components/BookSearch.tsx` around line 175) build their own second line, *author · series #n · pages*, so a library hit there doesn't name its universe; a Hardcover hit has none to name. Out of scope here (owner, plan gate 2026-11-12) → docs/05-roadmap.md § 2.2l (new) (approved at plan; Check proposed), and docs/06-tasklist.md § M10 (new row)
- The plan sheet (`src/components/PlanPicker.tsx`, 2.3) still names the book it moves as *author · words*, with no universe or series, although the 2026-11-09 intake asked for the line on "the plan sheet" (found by spec-reviewer and ui-verifier). Owner, at close-out 2026-11-12: add it to 2.2l → docs/05-roadmap.md § 2.2l (new)
- The *Up next* card's pages-and-words line follows its place line, so it sits 14px higher on a card whose place wraps less (cards stay equal height; found by ui-verifier). Cosmetic; pinning `.card-meta` to the card's bottom would align them → not tracked: cosmetic, the cards' heights and tops match, and the plan's risks named mixed heights as acceptable
- The status tab's quarter rows set the line in `.mono` (their existing `.qmeta .mono` style), the other screens in Plex Sans (found by ui-verifier) → not tracked: the mono sub line predates 2.2j, and the plan's own wording keeps `PlanQuarter`'s calls unchanged
- `quarterShelf` and `onDeck` don't filter `b.deleted_at IS NULL` themselves; the views they read do (schema-reviewer, minor, pre-existing) → not tracked: no soft-deleted row leaks, and nothing in 2.2j changes it

## Plan

Approved by the owner at the plan gate, 2026-11-12 (Opus session; implemented on Sonnet, the task's `model`). Kept whole, not split, although it is 11 code files plus the mockup: the roadmap **Check:** is one contract across the dashboard, the status tabs and the Library, and there is no schema change (owner, plan gate).

### Steps

1. **Mockup first** (`ui.redrawFiles`). In `design/mockups.html`'s `bdash` frames (all nine: phone reading and between at 390, listening, between and nothing-planned at 360, tablet reading and between, desktop reading and between), the On deck rows' grey line becomes *Author · Universe · Series #n* (sample data, D-7: give at least one row a universe and series, one a series alone, one the author alone), and each *Up next in Q4* card gains a place line between `tb-sname` and `tb-meta` that wraps, never clamps (a `tb-sub` style in the mockup's own CSS, `--muted`, the card-meta size). Add a line to the frame's notes list naming the rule (D-134). Update the `bdash` row of `design/mockups-index.md` (task 2.2j, D-134; the line range if it moves).
2. **`bookPlace` in `src/lib/format.ts`.** `bookPlace(b: { universe: string | null; series: string | null; series_position: number | null }): string`. Series with a position: `${series} #${Number(position)}` (so `#4`, `#1.5`, never `#4.0`); a position of `0` prints `#0` (only a null position drops the `#`: D-134). Universe and series: `${universe} · ${seriesPart}`, except that the universe is dropped when `series.toLowerCase().includes(universe.toLowerCase())`. Universe alone: the universe, unnumbered. Neither: `""`. Then `bookSub(b)` becomes `[b.author, bookPlace(b)].filter(Boolean).join(" · ")`, so it formats no series itself; its type gains `universe: string | null`. Doc comments cite task 2.2j and D-134.
3. **Queries, `src/db/queries.ts`**: `LEFT JOIN book_universes u ON u.id = b.universe_id`, `u.name AS universe` on `onDeck`, `quarterShelf`, `listBooks`, `booksInFlight`, `booksUpNext`, `booksDone`, and `planRows` (the plan page, task 2.10, which landed after this task was written). `ShelfBook` gains `series`, `series_position` and `universe` (add `s.name AS series`, `b.series_position` and the `book_series` join to `onDeck` and `quarterShelf`); `BookRow` and `StatusBook` gain `universe`; `PlanRow` gains `universe`. Each is a join on a query that already runs: `/books` makes no new query (`scripts/perf/budget.json`). Nothing stored (Hard rule 2). `book_universes` has no `deleted_at` column; check `schema.ts` and, if it has one, filter it.
4. **The rows.**
   - `src/components/OnDeckRow.tsx`: the `row-sub` reads `bookSub(book)` (shown when non-empty), in place of the bare author.
   - `src/components/PlanShelf.tsx`: each card gains `<span className="card-sub">{bookSub(b)}</span>` between `card-title` and `card-meta`, when non-empty.
   - `src/components/StatusBookRow.tsx` and `src/components/PlanQuarter.tsx`: unchanged calls to `bookSub`; their `book` / `QuarterBook` types gain `universe`.
   - `src/app/books/list/page.tsx`: the Library's `row-sub` becomes `[bookSub(b), b.genre].filter(Boolean).join(" · ")`; the inline series join goes.
   - `src/components/PlanQuarterRows.tsx` (`/books/plan`): its inline join becomes `bookSub({ author: r.author, universe: r.universe, series: r.series, series_position: r.seriesPosition })`.
   - Every `row-sub` the line lands in wraps (`overflow-wrap: anywhere` where a long word would otherwise overflow) and has no `text-overflow: ellipsis` or `nowrap`; check `.row-sub` in `globals.css` and fix it there if it truncates.
5. **CSS, `src/app/globals.css`**: `.shelf .card-sub{font-size:.6875rem;line-height:.875rem;color:var(--muted);overflow-wrap:anywhere}` beside `.shelf .card-meta` (no clamp, no ellipsis; tokens only, Hard rule 6). `--muted` must be 4.5:1 on the card's surface in both themes (it is the token `card-meta` already uses; the axe and contrast checks prove it).
6. **The loading state.** `ShelfSkeleton` in `src/components/Skeleton.tsx` (used only by `src/app/books/loading.tsx`) gains `<Bar w="75%" className="sk-card-sub" />` between title and meta, with `.shelf .card .sk-card-sub{height:10px;margin:2px 0}` in `globals.css`, so the skeleton card is as tall as a loaded card whose place is one line. A place that wraps to more lines makes the loaded shelf taller than its skeleton by those lines (about 14px each); that shift is the reason the skeleton draws one line rather than none, and the e2e screenshots show what remains. The status and Library skeletons already draw a sub line per row, and On deck has no skeleton on the dashboard (`books/loading.tsx` draws Now, the shelf and the strip): no change there.
7. **Tests** (below), then `verify.full`.

### Files

- `design/mockups.html`, `design/mockups-index.md`: `bdash` gains the line (step 1).
- `src/lib/format.ts`: `bookPlace`; `bookSub` composes it.
- `src/db/queries.ts`: the universe on seven queries; `ShelfBook`'s series.
- `src/components/OnDeckRow.tsx`, `src/components/PlanShelf.tsx`: the dashboard's rows.
- `src/components/StatusBookRow.tsx`, `src/components/PlanQuarter.tsx`: the status tabs (types only).
- `src/app/books/list/page.tsx`: the Library.
- ⚑ `src/components/PlanQuarterRows.tsx`: not in *Files likely touched*; the plan page's inline builder (task 2.10, #237), which AC-3 rules out.
- ⚑ `src/app/globals.css`: not listed; `.card-sub` and the skeleton bar.
- ⚑ `src/components/Skeleton.tsx`: not listed; `ShelfSkeleton`'s sub bar (AC-5).
- Tests: `test/format.test.ts` (new), `test/books-dashboard.test.ts`, `test/queries.test.ts`, `test/plan-page.test.tsx`, `test/e2e/books-dashboard.spec.ts`.

### Test strategy

- **AC-1 (unit) and AC-2**: `test/format.test.ts` (new), `describe("bookPlace (task 2.2j, D-134)")`: *Cosmere · Mistborn #4* (both); *Robot #2* (series alone); *First Law World* (universe alone); `""` (neither); *Mistborn* (series, null position); *Magic Tree House #3* (series contains the universe); *Magic Tree House: Merlin Missions #2* for universe *MAGIC TREE HOUSE* (AC-2); `#4` for position `4` and for `4.0`, never `#4.0` (AC-2); `#1.5`; `#0`. `describe("bookSub")`: *Brandon Sanderson · Cosmere · Mistborn #4*; the author alone with neither; the place alone with no author.
- **AC-3, no other builder**: in `test/format.test.ts`, a source scan over `src/**/*.tsx` and `src/**/*.ts` (except `src/lib/format.ts`) that fails on a template building ``#${…position…}`` / ``#${…Position…}``, with `src/components/BookSearch.tsx` exempted by name (owner, plan gate: Add books' search line is a follow-up). It must fail before the change: today `list/page.tsx` and `PlanQuarterRows.tsx` each build the line themselves.
- **AC-1 (queries)**: `test/books-dashboard.test.ts`, `onDeck` and `quarterShelf` return `universe` (the universe's name for a book in one, null without), and `series` / `series_position`.
- **AC-3 (queries)**: `test/queries.test.ts`: `listBooks`, `booksInFlight`, `booksUpNext`, `booksDone` return `universe`, the name for a book in one and null for one with none. `test/plan-page.test.tsx`: `planRows` the same.
- **AC-1, AC-4, AC-5 (browser)**: `test/e2e/books-dashboard.spec.ts`, `test.describe("the book's place on its row (2.2j)")`, with its own fixture (ids `e2e-dash-place-%`, cleaned before and after, beside `seedWhere`'s): *The Alloy of Law* by Brandon Sanderson in universe *Cosmere*, series *Mistborn* at 4, On deck; a second Mistborn book in the current quarter; a book in *The Chronicles of Thomas Covenant the Unbeliever* (no universe) at #1, On deck.
  - The On deck row and the *Up next* card for *The Alloy of Law* read *Brandon Sanderson · Cosmere · Mistborn #4* (the Up next card's book is moved into the quarter for that check, or the fixture plans it in the quarter and puts a second copy of the assertion on its card).
  - The same book reads the same line on `/books/status?tab=next` (its On deck section) and in the Library (`/books/list?q=Alloy`; the line followed by its genre, if any).
  - At 360px, the Thomas Covenant row shows the series name in full: its `row-sub` text contains the whole name, its computed `text-overflow` is not `ellipsis`, `scrollWidth <= clientWidth`, and its height is more than one line (it wraps); the page has no horizontal scroll (`document.documentElement.scrollWidth <= innerWidth`) on `/books`, the status tab and the Library (AC-4).
  - axe passes; nothing on the dashboard resolves to `--danger` (the spec's existing helper); the line's text is 4.5:1 in both themes (the contrast helper the 2.2g rows use).
  - Screenshots at 360, 390, 412, 768, 1024 and 1280px, light and dark, plus reduced motion and reduced transparency (the feel-pass helper the spec already uses), named `2.2j-*`. These cover the Check's 360px and 1280px.
  - The existing *the loading state is the loaded geometry in --sunk (AC-5)* test is extended: the skeleton card's height matches a loaded card whose place is one line.
- The status tab and the Library are checked in `books-dashboard.spec.ts` (one fixture, three screens) rather than in `status.spec.ts` and `library-sort.spec.ts`; those two specs aren't changed.
- **Grep before the first run** (`.claude/project/implement-task.md`): `test/`, `etl/test_*.py` and `etl/test_views.sql` for `bookSub`, `ShelfBook`, `onDeck`, `quarterShelf`, `planRows` and the row-sub text the specs pin (an existing assertion on *Tamsyn Muir* alone, or *Series #n* in the Library, now gains the universe and must be updated, not deleted).

### Risks and open questions

- The Library carries about 500 rows in its RSC payload (`library` budget 70,000 bytes). The universe adds its name to rows in one, as text in the server-rendered line, not as a prop. Lighthouse on the preview is the check; if it goes over, say so and stop rather than raise the budget.
- `PlanShelf` and `OnDeckRow` are client components: `ShelfBook` grows three fields per card. The dashboard's `books` budget is 19,000 bytes; the shelf is a handful of books, so expect well under 1 KB.
- A position of `0` now prints `#0` where `bookSub` dropped it (D-134: only a missing position drops the `#`).
- Mixed card heights in the *Up next* shelf when one place wraps: the cards align to the top (`.shelf` already lays them out in a row), so nothing jumps; the screenshots show it.

## Review log

Verify R1 PASS (`verify.full`, then the new and changed specs in `w390-light`: 45 passed) | CI R1 PASS on `b44ea97` (`check`, e2e full 8/8, Lighthouse within budget after one rerun of `measure (run-small)`, a Chrome launch timeout on an unrelated comics route) | Audit R1 PASS (every AC test fails on the base; the reduced-transparency `place` case passes at base and no AC relies on it) | Spec R1 APPROVE (two departures traced: `PlanQuarter`'s `qplace`/`qwords` markup for AC-4, and the AC-3 scan's exemptions of `book-parse.ts` and `book-review.ts` beside `BookSearch.tsx`, which echo a typed bulk-entry line and a review explanation, not a row's place) | Schema R1 APPROVE | UI R1 PASS (six widths, light and dark, four screens; two visual notes, both in Follow-ups as not tracked). No reviewer fix, so no round 2.

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 1
- Review rounds: 1
- First-pass AC FAILs: 0
- Plan revisions after approval: 0 (two additions inside the plan's steps: the AC-3 scan's two extra exemptions, and `PlanQuarter`'s `qplace`/`qwords` classes for AC-4)
