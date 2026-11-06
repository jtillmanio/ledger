---
id: TASK-056
title: 2.2g Where the book sits, in Now
status: Ready
depends_on: [TASK-049, TASK-055]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
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

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): in the browser (0.11), a book in hand in a universe, a series and a
subseries renders three rows in that order, each `read / total` equal to its
view's; a book in a series alone renders one row; a standalone by an unfollowed
author renders none; a standalone by an author followed `reading` renders the
author's row; *Between books* renders none. Every meter fills with `--ready`,
nothing resolves to `--danger`, and there is no horizontal scroll at 360px. The
five slots keep their order. Screenshots at 360px, 834px and 1280px.
- [ ] AC-2: A book with a universe by an author followed `reading` renders the universe's row and no author row. A book with no universe, by an author followed `reading`, in a series and a subseries, renders three rows: author, series, subseries. The same book with the author at `tracking` renders two. No book renders more than three.
- [ ] AC-3: A universe, series or subseries that is unfollowed, at `tracking` or at `off` renders the same row with the same `read / total` as one at `reading`, and a *Listening* book renders rows as a *Reading* book does. The task's diff adds no column and no table.
- [ ] AC-4: Given a level with 1 of 4 read, its row shows `1 / 4` and its fill is a quarter of the track, resolving to `--ready`. Finishing the book and undoing it leaves the rows as they were. The rows sit above the *Next in* line when that line is drawn, and their type is the rollup's, smaller than the hero's title.
- [ ] AC-5: The rows meet the UX floor (`docs/04-design.md` § 10. The UX floor), as a feel-pass surface: the loading state (`src/app/books/loading.tsx`) holds their space where it can know it, or the plan says why a row's arrival causes no layout shift over budget; a long universe name truncates or wraps without horizontal scroll; text is 4.5:1 and the track 3:1 in both themes; axe reports no new violations; screenshots at 360, 390, 412, 768, 1024 and 1280px, light and dark, reduced motion and reduced transparency.

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
