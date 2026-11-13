---
id: TASK-090
title: 4.5b On deck by genre
status: Ready
depends_on: [TASK-088, TASK-089, TASK-017]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-090 — 4.5b On deck by genre

## Goal

On deck can be narrowed to one genre and is grouped by genre, so picking the next fantasy (or the next thriller) is a glance, and nothing about On deck's order is stored.

## Context

- Roadmap: `docs/05-roadmap.md` § 4.5b On deck by genre (M16; depends on 4.5 and 1.9). The entry and its **Check:** are the contract; the owner agreed the Check on 2026-11-13 (it was *proposed*), without its clause *a book with no Calibre genre sorts by `books.genre`*, because 4.5 (TASK-089) drops that column before this is built. Feature F-74. Pulled ahead of 1.26 (D-139).
- **Chips and sections** (D-124). Status → *Up next* (`src/app/books/status/page.tsx`, `booksUpNext` in `src/db/queries.ts`; task 1.9, TASK-017) draws the plan by level, On deck last as one group. Its On deck group gains a chip per top-level genre that has an On deck book, and sections by top-level genre (`book_genre_tree` at depth 1). The chip is in the URL. A book in two top-level genres is in both sections and counts once on the tab (`src/components/StatusTabs.tsx`: *one count per tab, the rows that tab draws*).
- **After 4.5's drop** a book with no Calibre genre has no top-level genre (the entry's *`books.genre` for a book with none* no longer exists). **Stop and ask at plan time** where it goes: its own section, or after the sections unheaded; it still counts once.
- **Nothing is stored.** On deck stays unordered (D-37); inside a section, books run by series, then title. The chip writes nothing.
- **The Library's genre chips keep the filter** (D-124): today `libraryHref({ genre: g, ...order })` in `src/app/books/list/page.tsx` drops `status` and `level`, so *To read · On deck* then *Fantasy* loses On deck. A genre chip keeps both (`src/lib/library-sort.ts`).
- Size: the tasklist says S; the status screen, its query, the Library's chips and their tests are four to six files over two layers, so M.
- Design: no mockup frame draws the chips on *Up next*; the `status` frames (`powershell -NoProfile -File scripts/screen.ps1 status`) and `docs/04-design.md` § 11.2 Status screens set the look; `ui.redrawFiles` get the frame in the same PR.
- Decisions: D-37, D-98, D-124, D-139. Hard rules 2 and 6.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): with On deck books in `Fantasy.Epic Fantasy` and `Sci-Fi`, and one in
both, Status → *Up next* renders a *Fantasy* and a *Sci-Fi* section, the book in
both is in each, and the tab counts it once; the *Fantasy* chip leaves only
*Fantasy*, survives a reload and writes nothing. In the Library, *To read · On
deck* then a genre chip lists only that genre's On deck books. Screenshots at 360px and 1280px.
- [ ] AC-2: Given On deck books in `Fantasy.Epic Fantasy` and `Sci-Fi` and one in both, *Up next*'s On deck group draws a *Fantasy* and a *Sci-Fi* section, each listing its books by series then title, the two-genre book in both; the *Up next* tab's count is the number of distinct books it draws.
- [ ] AC-3: Choosing the *Fantasy* chip leaves only the *Fantasy* section, puts the genre in the URL, survives a reload, and makes no write request (no `POST`, `PATCH` or `DELETE` in the browser's log) and changes no row.
- [ ] AC-4: In the Library, *To read* · *On deck* then a genre chip lists only that genre's On deck books, and the URL keeps `status`, `level` and `genre`.
- [ ] AC-5: *Up next*'s genre chips and sections meet the UX floor (`docs/04-design.md` § 10. The UX floor): the chips are real links with names and `aria-current` on the chosen one, 44px on the phone, the row scrolls without a horizontal page scroll at 360px; section headings are headings; genre hues identity only; text 4.5:1 in both themes; axe reports no new violations; screenshots at 360px, 834px and 1280px, light and dark (the Check names 360 and 1280).

## Out of scope

- An order per genre or for On deck (D-124, not chosen).
- Genre chips on quarters, the bare-year lane or Someday.
- How genres are shown and mapped to hues (TASK-088's plan gate).

## Files likely touched

- `src/app/books/status/page.tsx` — the chips and sections in the On deck group.
- `src/db/queries.ts` — On deck books with their top-level genres.
- `src/app/books/list/page.tsx`, `src/lib/library-sort.ts` — the genre chip keeps status and level.
- `design/mockups.html`, `design/mockups-index.md` — the *Up next* frame (`ui.redrawFiles`).
- `test/status.test.ts`, `test/library-sort.test.ts`, `test/e2e/status.spec.ts`.

## Verification

- Automated: `test/status.test.ts` (AC-2's grouping and count), `test/library-sort.test.ts` (AC-4's URL), `test/e2e/status.spec.ts` (AC-1, AC-3, AC-4, axe, screenshots at 360px and 1280px).
- Manual: on the dev database, Status → *Up next* → *Fantasy* chip → only fantasy On deck books; reload → still filtered.

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
