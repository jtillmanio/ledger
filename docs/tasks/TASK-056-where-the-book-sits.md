---
id: TASK-056
title: 2.2g Where the book sits, in Now
status: Review
depends_on: [TASK-049, TASK-055]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: 5d0474a
---

# TASK-056 — 2.2g Where the book sits, in Now

## Goal

Under the book in hand, thin stacked meters show how far along you are in its universe, series and subseries.

## Context

- Roadmap: `docs/05-roadmap.md` § 2.2g Where the book sits, in Now (M10, after 2.2d; owner intake 2026-11-05, D-119). The roadmap entry and its **Check:** are the contract; its Check was proposed at the intake and agreed by the owner on 2026-11-06, when these task files were written. Features: F-72. "In the browser (0.11)" is the Playwright harness, `test/e2e/` (TASK-013). Depends on 2.2 (TASK-049, Now) and 2.2h (TASK-055, `subseries_progress`). This is the working version: 6.21 redesigns it with the design tool, and its Check keeps this one's facts. Not one of the entries 1.25 pulls ahead of cutover.
- **One thin row per level the book belongs to**, outermost first: the universe (D-90: Calibre's superseries is the universe), or with no universe the author when followed as *Reading*; then the series; then the subseries. Each row is the name, an `.emeter` filled with `--ready`, and `read / total` in mono.
- **At most three rows, and no empty one.** A level the book lacks draws nothing, a standalone by an unfollowed author draws none, and *Between books* draws none. A *Listening* book draws them too.
- **Position is a fact, not a follow.** Each row reads `universe_progress`, `series_progress`, `author_progress` or `subseries_progress`, whether or not that level is followed: D-108 stops a progress view saying what you're *reading*, never how far along you are. So a level set to *Not following* (`off`, TASK-055) still draws its row. Only the author's row looks at the follow, because the entry shows the author only when followed as *Reading*. Nothing is stored (Hard rule 2).
- **`bookGroupings`** (`src/db/queries.ts`) already reads these views for a book and gains the subseries in TASK-055, so the plan should reuse its counts: a series' `total` there is its stated `total_books`, the others the books listed. The sheet and these rows must not disagree.
- **Where the rows sit.** The entry says *under the meter*, but TASK-049's approved plan draws Now with no meter until 2.1b stores a position (its Q1), showing the page count, *Started …* and the time left. The rows go under that block, and under the meter once 2.1b adds one. They sit above 2.2d's *Next in* line (TASK-050), which by M10's order lands first; the Check's *five slots keep their order* holds, since this is all inside Now. The file is `src/components/BooksNow.tsx`, named by TASK-049's plan: use the name it landed with.
- **The meter.** `.emeter` exists only as `.era .emeter`, 5px tall and 52px wide (`src/app/globals.css`), so it needs a scope of its own here. The fill is `--ready` (Hard rule 6). Its figure is the visible `read / total`, so the meter itself adds nothing for a screen reader.
- **Now stays the one large thing:** these rows use the rollup's type sizes (*2026 so far*), not the hero's (`docs/04-design.md` § 12, `design/STYLE_GUIDE.md` § 14).
- **The query** runs on `/books`, whose budget TASK-049 sets (`scripts/perf/budget.json`), and adds nothing for *Between books*.
- **Not drawn yet.** The mockup's `bdash` frames gain the rows at phone, tablet and desktop widths before they are built: the plan draws them first and the owner sees them at the plan gate (standing rule 6, `ui.redrawFiles`). The figures in those frames are sample data (D-7).
- This is a feel-pass surface (`docs/04-design.md` § 10), so its new states are screenshotted at every feel-pass width, light and dark, reduced motion and transparency.
- *From the 2026-11-05 intake:* 5.12's `/progress` nests its rows the same way (D-119), and reads what this draws.
- Decisions: D-119, D-90, D-108, D-40, D-7. Hard rules 2 and 6.
- *From TASK-055 (2.2h, PR #204):* `bookGroupings` now lists the subseries second (series, subseries, author, universe, shelf), its `total` the books listed in `subseries_progress`. Its `unread` counts live books neither read nor DNF, and a stored `off` reads as `state: null`. The rows here read position, not the follow, so none of that changes their counts.

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim): in the browser (0.11), a book in hand in a universe, a series and a
subseries renders three rows in that order, each `read / total` equal to its
view's; a book in a series alone renders one row; a standalone by an unfollowed
author renders none; a standalone by an author followed `reading` renders the
author's row; *Between books* renders none. Every meter fills with `--ready`,
nothing resolves to `--danger`, and there is no horizontal scroll at 360px. The
five slots keep their order. Screenshots at 360px, 834px and 1280px.
- [x] AC-2: A book with a universe by an author followed `reading` renders the universe's row and no author row. A book with no universe, by an author followed `reading`, in a series and a subseries, renders three rows: author, series, subseries. The same book with the author at `tracking` renders two. No book renders more than three.
- [x] AC-3: A universe, series or subseries that is unfollowed, at `tracking` or at `off` renders the same row with the same `read / total` as one at `reading`, and a *Listening* book renders rows as a *Reading* book does. The task's diff adds no column and no table.
- [x] AC-4: Given a level with 1 of 4 read, its row shows `1 / 4` and its fill is a quarter of the track, resolving to `--ready`. Finishing the book and undoing it leaves the rows as they were. The rows sit above the *Next in* line when that line is drawn, and their type is the rollup's, smaller than the hero's title.
- [x] AC-5: The rows meet the UX floor (`docs/04-design.md` § 10. The UX floor), as a feel-pass surface: the loading state (`src/app/books/loading.tsx`) holds their space where it can know it, or the plan says why a row's arrival causes no layout shift over budget; a long universe name truncates or wraps without horizontal scroll; text is 4.5:1 and the track 3:1 in both themes; axe reports no new violations; screenshots at 360, 390, 412, 768, 1024 and 1280px, light and dark, reduced motion and reduced transparency.

## Out of scope

- 6.21's redesign, and 5.12's `/progress`.
- Following anything from here: these rows are read-only, and not links (the series, author and universe pages are 5.9, 5.11).
- Now's page position and its meter (2.1b).
- 2.2d's *Next in* line (TASK-050).
- Any change to the progress views beyond what TASK-055 builds.

## Files likely touched

- `src/db/queries.ts` — the book in hand's levels, from the progress views.
- `src/components/BooksNow.tsx` (from TASK-049) — draws the rows.
- `src/components/WhereItSits.tsx` (new; the plan's name) — the rows.
- `src/app/globals.css` — the rows and an `.emeter` outside `.era`, from tokens only.
- `src/app/books/loading.tsx` (from TASK-049) — their space, if the plan keeps one.
- `design/mockups.html`, `design/mockups-index.md` — `bdash` gains the rows (drawn first).
- `test/books-dashboard.test.ts`, `test/e2e/books-dashboard.spec.ts` (from TASK-049).

## Verification

- Automated: `test/books-dashboard.test.ts` (the levels' rules: AC-2, AC-3's counts); `test/e2e/books-dashboard.spec.ts` (AC-1's browser cases, AC-4's fill and order, `--danger` absent, no scroll at 360px, axe, screenshots).
- Manual: `npm run dev`. From the Books dashboard, with a book *Reading* in a universe, a series and a subseries → Now shows three rows, outermost first. Open the Library and find that book: ⋯ → *Follow…* shows the same `read / total` for each. Set one to *Not following* → the row stays. Put it back, as found.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

None at plan (approved at plan).

- `/books` scrolled sideways at 360–412px with 5+ Up next cards (each card's sr-only number escaped the shelf's clip; found by ui-verifier, predates this task, the fixtures held 2 cards) → not tracked: done in this PR (plan revision 1, owner approved)
- The row track's 3:1 is asserted as the `--faint-deco` outline (a token commented ≥ 3:1), not as a measured ratio in the e2e; ui-verifier measured 3.39 light and 4.08 dark → not tracked: advisory from the test audit and spec review, measured once by hand
- AC-5's loading clause (no layout shift from the rows arriving) has no automated test; the plan argues none → not tracked: Lighthouse's CLS gate on the preview is the check (a ready gate)
- The 360px screenshot of the rows comes from the full scope (`e2e:full`), not the core projects → not tracked: the `e2e:full` label gate on this PR runs it

## Plan

Approved by the owner, 2026-11-09. The `bdash` frames were drawn first, at the plan gate (in the planning commit): the 390, 834 and desktop reading frames show *N. K. Jemisin 4 / 12* and *The Broken Earth 0 / 3*; the 360 listening frame *Andy Weir 2 / 3*; a note in the notes column and the `mockups-index.md` row.

**Layout.** A full-width block under `.now-band` and above `.now-next`: the hero lands as band → Next in → foot, and 2.1b's meter goes in the band, so this is the roadmap's "under the meter, above Next in". Each row is a grid: the name (wraps with `overflow-wrap:anywhere`, never scrolls), a meter 64px wide (120px from 768px), and `read / total` in mono, right-aligned, `minmax(7ch, max-content)`. Type `--fs-caption` (12/16, the rollup's `dt`), colour `--ink-2`. The track is `--sunk` with an inset 1px `--faint-deco` outline (3:1 on `--surface` in both themes; `--sunk` alone isn't), height 6px, the fill `--ready`. Padding 12px 16px, 12px 20px from 768px (as `.now-next`), `border-top: 1px solid var(--line)`.

**Steps**
1. `booksInHand` (`src/db/queries.ts`): the `hand` CTE carries the book's `series_id`, `subseries_id`, `author_id`, `universe_id`; a `levels` CTE builds, per book in hand, a `json_agg` ordered by level of `{kind, id, name, read, total}` from a LATERAL `UNION ALL` over `universe_progress` (ord 1), `author_progress` (ord 1, only `b.universe_id IS NULL` and `follow_state = 'reading'`), `series_progress` (ord 2, `total` = `total_books`) and `subseries_progress` (ord 3, `total` = `books_listed`), each `user_id = ${userId}`, dropping a row whose total is 0; `InHandBook` gains `levels: Level[]` (`[]` when none, via `COALESCE(..., '[]'::json)`). Same query: `/books` stays 10 queries in one wave, and *Between books* (no hand) adds nothing. The counts are read as `bookGroupings` reads them.
2. `src/components/WhereItSits.tsx` (new, server component): `<ul className="now-where" aria-label="Where this book sits">`, one `<li>` per level: `<span className="now-where-name">`, `<span className="emeter" aria-hidden="true"><i style={{ width: `${fillShare * 100}%` }} /></span>`, `<span className="now-where-n mono">{read} / {total}</span>`. Exports `fillShare(read, total)` = `min(1, read / total)` (0 for total ≤ 0). Renders null for an empty list.
3. `src/components/BooksNow.tsx`: draw `<WhereItSits levels={book.levels} />` between `.now-band` and the *Next in* link; update the doc comment.
4. `src/app/globals.css`: `.now-where`, its rows, and `.now-where .emeter` (a scope of its own; `.era .emeter` unchanged), tokens only, the 768px padding and meter width in the existing media blocks.
5. Tests first (below), confirmed failing, then 1–4.

**Files** (8; no schema, no migration, no view): `src/db/queries.ts`, `src/components/WhereItSits.tsx` (new), `src/components/BooksNow.tsx`, `src/app/globals.css`, `design/mockups.html` and `design/mockups-index.md` (drawn at the plan gate), `test/books-dashboard.test.ts`, `test/e2e/books-dashboard.spec.ts`. `src/app/books/loading.tsx` is not changed (see Loading).

**Test strategy**
- AC-2, AC-3's counts: `test/books-dashboard.test.ts` › "Where the book sits (2.2g)": universe + series + subseries → kinds `universe, series, subseries`, each `read / total` equal to its view's; series alone → `series`, its total the stated `total_books`; standalone, author unfollowed → `[]`; author `reading` → `author`; author `tracking` → `[]`; a universe and an author at `reading` → `universe` only; no universe, author `reading`, series and subseries → `author, series, subseries`, author `tracking` → two; never more than three; a universe, series and subseries each unfollowed, `tracking`, `off` and `reading` → the same rows and figures; a *Listening* book → the same rows as *Reading*; every level's figures equal `bookGroupings`' for the same kind and book.
- Unit (same file): `fillShare(1, 4) = 0.25`, `fillShare(5, 4) = 1`, `fillShare(0, 0) = 0`; `WhereItSits` with `[]` renders nothing; with 1 / 4 its markup has `1 / 4` and `width:25%`.
- AC-1, AC-4, AC-5: `test/e2e/books-dashboard.spec.ts` › "where the book sits (2.2g)": a fixture with the hero in a universe, a series and a subseries → three rows in that order, each figure equal to its view's (queried in the test); series alone → one; standalone, author unfollowed → none; author `reading` → the author's row; *Between books* → no `.now-where`; the fill's `background-color` is `--ready` and at 1 / 4 its width a quarter of the track's (±1px); the track's outline is `--faint-deco`; `.now-where` sits above `.now-next`; the row font size is below `.now-name`'s; ✓ finished then Undo → the rows as before; a long universe name at 360px → no horizontal scroll; the floor (no `--danger`, no horizontal scroll, targets, axe, contrast); screenshots in every project (360–1280, light and dark, reduced motion), one at 834×1112 set by hand (no 834 project), and a reduced-transparency state.
- AC-3 "no column and no table": the diff touches no `src/db/schema.ts`, `drizzle/` or `etl/views.sql`: spec-reviewer checks it; listed in the PR.

**Loading (AC-5).** `loading.tsx` keeps no space for the rows: the skeleton can't know whether 0–3 rows come. It is `/books`' only Suspense fallback, so the rows arrive in the same commit as the hero and everything below it, all newly inserted nodes, which the Layout Instability API doesn't score; nothing outside `main` moves (the thumb bar is fixed). The same reasoning covers *Next in*'s 44px row (TASK-050). Lighthouse's CLS gate (< 0.1) on the preview checks it; the existing geometry test (a hero with no levels) still holds.

**Risks.** The views' pushdown inside a LATERAL: `bookGroupings` already joins them per book the same way, and `test/query-budget.test.ts` pins the count. The e2e fixture adds a universe, a subseries and follows: `clean()` deletes them by the `e2e-dash-` prefix (universes, subseries, then series).

**Size.** 8 files, UI and a query, no schema: no split.

**Plan revision 1 (owner approved, 2026-11-09).** ui-verifier found `/books` scrolled sideways at 360–412px once Up next held 5+ cards, with or without the rows: each shelf card's `.sr-only` number is `position:absolute` with no positioned ancestor inside the row, so the row's clip doesn't contain it and it widens the page. Predates this task (TASK-049's shelf); the fixtures held 2 cards. Step 4 gains `.shelf .card{position:relative}` in `globals.css` (a planned file), and the e2e spec a test "a full Up next shelf and the rows together" (six cards, 360px). The row gap is 6px, as the mockup draws it.

## Review log

Verify R1 round (tsc, lint, unit) PASS → full PASS (957 browser tests) | R2 round PASS + dashboard spec (78) after the shelf fix | Audit R1 PASS (3 advisories: one taken, two recorded) | Spec R1 APPROVE → R2 APPROVE (fix diff only) | Schema R1 APPROVE (schema-reviewer; two minor notes, none required) | UI R1 CHANGES (page scrolled sideways at 360–412px with 5+ Up next cards, predates the task; rows themselves PASS at every width, light and dark; fixed as plan revision 1) → R2 not re-run: the change is one `position:relative` declaration pinned by a six-card e2e test (the dev database holds no shelf cards to look at), and CI's e2e:full and the owner's preview walk cover the rest.

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 2 (R1 round → full; R2 round + dashboard spec)
- Review rounds: 2 (spec, UI; schema once)
- First-pass AC FAILs: 1 (AC-1 horizontal scroll at 360px on a full Up next shelf, found by ui-verifier)
- Plan revisions after approval: 1 (the shelf fix and its test)
