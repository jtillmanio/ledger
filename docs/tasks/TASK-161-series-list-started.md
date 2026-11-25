---
id: TASK-161
title: 5.9c The Series list opens on what you've started
status: In progress
depends_on: []
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: c6e2918
---

# TASK-161 — 5.9c The Series list opens on what you've started

## Goal

The Series page opens on the series the owner has started or follows, with *All* a tap away, and the Library no longer repeats a link to it.

## Context

- Roadmap: `docs/05-roadmap.md` § 5.9c The Series list opens on what you've started (M17 in `docs/06-tasklist.md`). Feature F-38. Its **Check:** is AC-1, verbatim; proposed in PR #342 and agreed when it merged (2026-11-25).
- Owner intake, 2026-11-24 (*do we need to load the whole series list, or just ones started and finished?*) and 2026-11-25 (*the Library's series line goes*).
- **What exists.** `src/app/books/series/page.tsx` reads `seriesList` (`src/db/queries.ts`, `series_progress` where `books_listed > 0`) and draws `src/components/SeriesList.tsx`. The Library's foot is `<p className="list-series-line">` with *All series →* in `src/app/books/list/page.tsx` (task 5.9, TASK-125). The status and Progress pages draw chips as real links (`src/app/progress/page.tsx`'s `prog-chips`).
- **Started** means a book read, in hand (Reading, Listening) or DNF, or a series follow of Tracking or Reading; the cut is in SQL, so the default reads fewer rows. *Started* · *All* are real links (`?show=all`), each with its count.
- **Budget.** `/books/series` and `/books/list` are in `scripts/perf/budget.json` (0.14e gives the series page its route).
- Design: `design/mockups.html` § `series` and `blist`; both redrawn (`ui.redrawFiles`). Rules: `.claude/rules/ui.md`. UX floor: `docs/04-design.md` § 10. The UX floor. Decisions: D-26, D-90.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim):
with the test database, three series: one with a read book, one followed
Tracking with none read, and one with only To-read books. `/books/series`
lists the first two and not the third, *All* lists all three, and each
chip shows its count. The Library has no *All series* link, and the nav's
*Series* opens the page. Screenshots at 360px and 1280px; axe passes.
- [ ] AC-2: Given `?show=` with any other value, the page shows *Started*; a reload and Back keep the chip.
- [ ] AC-3: Given no started series, *Started* draws an empty state naming *All* (with its count), never a blank page.
- [ ] AC-4: The page meets the UX floor (`docs/04-design.md` § 10. The UX floor): chips are links with `aria-current` on the open one, 44 px targets at phone widths, contrast in both themes, and screenshots at each `ui.viewports` width, light and dark; both routes stay within their budgets.

## Out of scope

- The Universes list (TASK-162).
- Changing a series' own page or its row.

## Files likely touched

- `src/db/queries.ts` — `seriesList` takes the cut.
- `src/app/books/series/page.tsx` — reads `?show=`.
- `src/components/SeriesList.tsx` — the chip row and the empty state.
- `src/app/books/list/page.tsx`, `src/app/globals.css` — the foot line and its style go.
- `design/mockups.html`, `design/mockups-index.md` — `series` and `blist`.
- `test/series-list.test.tsx`, `test/e2e/series.spec.ts` — AC-1 to AC-4.

## Verification

- Automated: `test/series-list.test.tsx` (the cut, the chips, the empty state) on the test database; `test/e2e/series.spec.ts` with axe at 360px and 1280px.
- Manual: `npm run dev`, Series → *All* → Back → expected: *Started* again, and the Library's foot has no *All series* link.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- 0.14e's `/books/series` route: the page now opens on *Started*, so its measured budget is that view, and the Library no longer links to it (the books nav's *Series* is the tap). (approved at plan) → planned: `docs/tasks/TASK-138-measure-series-author-universe-pages.md` § Context
- AC-4's "both routes stay within their budgets": `/books/series` has no budget until 0.14e (TASK-138); this task holds the Library to its budget and leaves the series page on `UNMEASURED`. Say so in the PR's **How it was verified** (owner, at plan, 2026-11-25). (approved at plan) → planned: not tracked: stated in the PR; the budget is 0.14e's

## Plan

*Approved by the owner 2026-11-25 (all four plan questions agreed: the budget reading above, the empty-state copy below, ledger_test_2 freed from the merged task-142 worktree, implement on Sonnet).*

### Steps

1. `src/db/queries.ts`: one shared SQL fragment for *started*: the series is followed (`series_progress.follow_state IN ('tracking', 'reading')`; a stored `off` already reads NULL), or a live book in it has `book_status.status IN ('read', 'reading', 'listening', 'dnf')` for this user (EXISTS). `seriesList(userId, show: SeriesShow = "all")` applies it in the WHERE when `show = "started"` (the cut is in SQL; the `next` lateral runs only for the rows shown); order unchanged. New `seriesCounts(userId)` → `{ started, all }`, one aggregate over the same `series_progress` rows (`books_listed > 0`), `COUNT(*) FILTER (WHERE <started>)`. Default `"all"` keeps `test/series-page.test.ts` and `test/unlisted.test.ts` callers unchanged. Export `type SeriesShow = "started" | "all"` and `parseSeriesShow` (only `"all"` is All; anything else, an array or none is Started).
2. `src/app/books/series/page.tsx`: `searchParams: Promise<{ show?: string | string[] }>`; `show = parseSeriesShow(...)`; `Promise.all([seriesList(userId, show), seriesCounts(userId)])`; passes `series`, `show`, `counts` to `SeriesList`.
3. `src/components/SeriesList.tsx`: props `{ series, show, counts }`. Under the head, a chip row as Progress draws it: `<div className="filters genre-row series-chips" role="group" aria-label="Show">`, two `Link prefetch={false}` chips, `/books/series` (*Started*) and `/books/series?show=all` (*All*), `className="chip"`, `aria-current` on the open one, text `Started <span className="n">{n}</span>`, `aria-label` *Started, 4 series* (*1 series*). States: `counts.all === 0` → today's *No series yet* slate, no chips; Started with no rows (`counts.started === 0`) → chips, then `EmptySlate` title **Nothing started yet**, text *A series shows here once you read or start a book in it, or follow it.*, one action **All {n} series** → `/books/series?show=all`. The lede stays.
4. `src/app/books/series/loading.tsx`: a chip-row skeleton at the loaded size (two chip bars in `filters genre-row series-chips`), so the list doesn't jump.
5. `src/app/books/list/page.tsx`: the `<p className="list-series-line">` foot and its comment go. `src/app/globals.css`: `.list-series-line` leaves the four rules (`.list-parked-line` stays); add `.series-page .series-chips{margin:...}` as `.progress-page .prog-chips` (chips 44px at phone come from `.genre-row .chip`).
6. `design/mockups.html` § `series`: the chip row (*Started 4 · All 5*, Started current) on the 360, 834 and desktop list frames, The Expanse (0 / 9, not followed) gone from them; a new 360 frame for Started with none started (chips, *Nothing started yet* slate, **All 5 series**). § `blist`: the *All series →* foot line comes out of the first frame. `design/mockups-index.md`: the `series` and `blist` rows say so (task 5.9c), line ranges updated.

**Files** (12; over 8, kept whole at the owner's OK: a split breaks AC-1, the verbatim Check across both pages, and 6 of the 12 are tests and the redraw files `ui.redrawFiles` requires): `src/db/queries.ts`, `src/app/books/series/page.tsx`, `src/components/SeriesList.tsx`, `src/app/books/series/loading.tsx` (not in Files likely touched: the skeleton draws the new chip row), `src/app/books/list/page.tsx`, `src/app/globals.css`, `design/mockups.html`, `design/mockups-index.md`, `test/series-page.test.ts` (not listed: the query tests live here, on the TEST database), `test/series-list.test.tsx`, `test/e2e/series.spec.ts`, `test/library-page.test.tsx` (not listed: its foot-link test now asserts the link is gone).

### Test strategy

- AC-1: `test/series-page.test.ts` *the Started cut (5.9c)*: a series with a read book, one followed Tracking with none read, one with only To-read books (plus reading/listening/DNF/Reading-follow/`off`-follow/other-user/soft-deleted-book cases): `seriesList(USER, "started")` ids are the first two, `"all"` all three, `seriesCounts` `{ started: 2, all: 3 }`. `test/e2e/series.spec.ts` new E2E series (`e2e-sc-*`: READ, TRACK, TODO): `/books/series` lists READ and TRACK, not TODO; *All* lists all three; each chip's count equals the rows it lists (the shared DB holds real series); `/books/list` has no `a[href="/books/series"]` in `main`; the visible nav's *Series* from `/books/list` opens `/books/series` with *Started* current; FLOOR (axe, screenshots at every width, light and dark; 360 and 1280 among them).
- AC-2: spec, ONCE: `?show=bogus` → *Started* `aria-current`, TODO absent; *All* → reload → *All* current → Back → *Started* current.
- AC-3: `test/series-list.test.tsx`: Started with no rows draws the slate with one link, **All 3 series** → `/books/series?show=all`, and the chips; `counts.all === 0` keeps *No series yet*. Spec, FEEL: the empty markup swapped into `<main>`, the floor, screenshots.
- AC-4: `series-list.test.tsx`: chips are `<a>` with the hrefs, `aria-current="true"` only on the open one, the counts and aria-labels. Spec, FLOOR: chip height ≥ 44 below 768px, contrast and axe in both themes, screenshots at each `ui.viewports` width. Budget: the Library's budget via Lighthouse when the switch is on; `/books/series` stays on `UNMEASURED` (0.14e).
- Existing: the spec's "in progress first" and "no stated total" tests open `?show=all` (NONE isn't started); `library-page.test.tsx`'s foot test asserts no `/books/series` link and no `.list-series-line`.

**Risks**: the *started* EXISTS runs per series row; `series_progress` already joins every book, so cost is flat. The e2e counts read a shared database, so they are compared with the rows drawn, never with a constant.

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
