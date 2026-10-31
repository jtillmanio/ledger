---
id: TASK-041
title: 1.22 Search as you type, and where each result comes from
status: Ready
depends_on: [TASK-029, TASK-040]
size: L
model: opus
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-041 — 1.22 Search as you type, and where each result comes from

## Goal

Every search box in the app searches once you have typed three characters and paused, without pressing Enter, and every result says in words where it came from: where a library book sits on your list, or which outside source found it.

## Context

- Roadmap: `docs/05-roadmap.md` § 1.22 Search as you type, and where each result comes from (M9, sitting 9, after 1.4f and 1.19, before 1.24). The roadmap entry, its two amendments and its **Check:** are the contract. "In the browser (0.11)" is the Playwright harness, `test/e2e/` (TASK-013).
- **The Check's *Open Library* reads *Hardcover*** (the entry's 2026-10-28 amendment, D-94): this task follows 1.4f (TASK-040), so the outside book results are Hardcover's, the source tag reads *Hardcover* and the group head *From Hardcover*, and the Check's *recorded Open Library answers* are Hardcover's. AC-1 copies the Check verbatim; AC-2 onward say *Hardcover*.
- **Why this is one large task** (`workflow.splitPolicy: never-split`): three search boxes (two client components and one server-rendered form), a shared debounce-and-abort piece, the library query that supplies each book's level, the rule edit in `.claude/rules/ui.md` and the redrawn frames land together, so the behaviour is the same in every box at once.
- The three boxes today:
  - **Add books, *Search***: `src/components/BookSearch.tsx`, `fetch("/api/books/search")` on submit; hint *Searches when you press Enter* (after 1.4f: *Matched against your library first, then Hardcover*); groups *In your library* and *From Hardcover*.
  - **Add issues**: `src/components/IssueSearch.tsx`, `fetch("/api/metron/search")` on submit; hint *Your catalog first, then Metron. Searches when you press Enter.*; groups *In your catalog* and *From Metron*, whose rows already carry tags (*already in this run*, the run count, *not in the label grammar*). `src/components/AddIssues.tsx` already uses an `AbortController` for its own request: the pattern to reuse or say why not.
  - **The master list**: `src/app/books/list/page.tsx`, a server-rendered `<form action="/books/list">` with `<input type="search" name="q">`, so typing has to move to a small client piece that replaces `?q=` (`router.replace`, no history entry per keystroke) while the filter chips keep their links. `test/query-budget.test.ts` and `test/no-prefetched-filters.test.ts` already guard this page.
- **The rule it amends** (D-84; the task edits the rule): `.claude/rules/ui.md` § *No page render calls an external API*: *searched when the user submits a search in Add* becomes *when the user submits or pauses typing in Add*. Answers stay cached (D-53, D-62; `hardcover_cache` from 1.4f), so retyping a query asks no API, and the rate-limited states of 1.3b and 1.4c (and 1.4f) are unchanged.
- **Where a library book's tag comes from**: `librarySearch` in `src/db/queries.ts` returns `LibraryHit.status` only. *Someday*, *On deck* and *Q1 2027* are levels read through the `to_read_level` view (`etl/views.sql`, D-37), never parsed in the app; *Unlisted* is `status = 'unlisted'` (D-86); *Calibre* reads `books.calibre_id` (1.18b, D-90): the 2026-10-27 amendment says this task adds **no column**.
- **Settled with the owner, 2026-10-31** (the entry left these open; the plan builds them, it doesn't reopen them; the PR says the Metron answer, as the entry asks):
  - **Metron waits for the pause, not for a complete label.** Add issues asks Metron on the same 500 ms pause as every other box (owner: "if typing has stopped for some amount of time it makes a call"). A label that doesn't parse, or a range whose end is before its start (`thor 337-3`), asks nothing, as today; D-60's ten-number cap stands, and the cache makes a retyped query free.
  - **One tag per library row, saying where the book sits:** a quarter (*Q1 2027*), a bare year (*2027*), *On deck*, *Someday*, *Reading*, *Read*, *DNF*, *Unlisted* (and *Listening* once 1.23 lands). A book with no status (one only on a shelf; the add flows already call it *in your library, not on your list yet*) reads *Not on your list*.
  - **No separate *Calibre* tag on a book on your list:** nearly every library book has a `calibre_id` (1.18), so the tag would be on almost every row and tell you nothing. The one row where it does tell you something is a book Calibre has that isn't on your list: an Unlisted book with a `calibre_id` reads *Unlisted · Calibre*. This reads 1.18b's column and adds none (the 2026-10-27 amendment).
  - **An outside result** reads *Hardcover* or *Metron*. **A catalog issue** in Add issues keeps the run-count tag it has today (*in 2 runs*, *already in this run*), which already says it is yours; it gets no second tag.
  - **The master list waits too:** the same 3-character floor and 500 ms pause as the add flows (owner: consistent). Under 3 characters, the list shows everything again (the `?q=` is cleared), not an empty list.
- Design: mockups `add` (Add books' *Search*), `bulk` (Add issues) and `blist` (the master list's search box) in `design/mockups.html` (lines in `design/mockups-index.md`; print each with `scripts/screen.ps1 <id>`). None draws a per-row source tag. Standing rule 6: the frames that gain the tag or the new hint are redrawn in the same PR (`ui.redrawFiles`).
- Decisions: D-84 (as you type, 3 characters, 500 ms; each result says where it came from), D-94 (Hardcover is the outside book source), D-53, D-60, D-62 (caches and Metron's per-number requests), D-37, D-86, D-90 (levels, Unlisted, `calibre_id`), F-15 and B16 in `docs/01-product.md`.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): in the browser (0.11), with recorded Open Library answers: typing
`pir` and pausing lists results without Enter; typing `pi` and pausing makes no
request; typing `piranesi` quickly makes one request, not six; a library result
shows its level tag and an Open Library result its source tag, each part of the
row's accessible name; the master list narrows as you type, and one Back leaves
it. A vitest with fake timers shows the older request aborted when a newer
query starts.
- [ ] AC-2: A vitest with fake timers, for the shared search piece: at 2 characters and 600 ms nothing is sent and any shown results clear; at 3 characters a request is sent 500 ms after the last keystroke and not before (none at 499 ms); Enter sends at once and the pending pause sends nothing more; a newer query aborts the older request's signal, and an answer to the older query that arrives after the newer one is dropped (the list shows the newer query's results).
- [ ] AC-3: On Add books, with recorded Hardcover answers and a fixture library holding one book at each of Someday, On deck, a quarter, a bare year, *Reading*, *Read*, *DNF* and *Unlisted*: each library row has exactly one tag, reading where the book sits in text (*Someday*, *On deck*, *Q1 2027*, *2027*, *Reading*, *Read*, *DNF*, *Unlisted*), a Hardcover row's reads *Hardcover*, and on Add issues a Metron row's reads *Metron* while a catalog row keeps its run-count tag; the tags are text inside the row's accessible name, not colour alone. An Unlisted book with a `calibre_id` reads *Unlisted · Calibre*, and a Someday book with a `calibre_id` reads *Someday* alone. The group heads *In your library* and *From Hardcover* stay.
- [ ] AC-4: Typing the same query twice, minutes apart, makes one outside request in total (the second is served from the cache); the rate-limited state appears on a recorded 429 as it does on Enter today, on Add books and Add issues. The hints read *Searches as you type* in place of *Searches when you press Enter*, and `.claude/rules/ui.md` says *when the user submits or pauses typing*.
- [ ] AC-5: The master list at `/books/list`: typing `pir` and pausing replaces the URL's `?q=pir` (a filter chip already chosen stays in the URL), the list narrows to the matching books, and the history gains no entry per keystroke: one Back from `/books/list?q=piranesi` returns to the page before the list. Reloading `/books/list?q=pir` shows the same narrowed list (the server still reads `q`). Typing `pi` and pausing makes no request, and deleting back to two characters after a search clears `?q=` and shows the whole list.
- [ ] AC-6: The three search boxes meet the UX floor (`docs/04-design.md` § 10. The UX floor): each is a real `type="search"` input with an accessible name; the searching state is announced once per request (not per keystroke) through a polite live region; the no-results, rate-limited and error states are drawn; each tag is at 4.5:1 in both themes; reduced motion shows no spinner animation; screenshots at every `ui.viewports` width, light and dark.

## Out of scope

- Moving Add books to Hardcover (1.4f, TASK-040, which this follows).
- The headphones glyph in search results (1.23, which adds it here later).
- A search box that doesn't exist yet (the watchlist, the comics run list, the inbox): the rule covers them when they are built.
- Fuzzy matching or ranking changes in `librarySearch`: the words-in-title-or-author rule stays.
- A new column for a book's source (the amendment: `books.calibre_id` is read, nothing is added).
- Asking an outside API from the master list: it searches your library only.

## Files likely touched

- `src/lib/use-search.ts` (new, or the name the plan picks): the 3-character floor, the 500 ms pause, Enter at once, abort and drop-late.
- `src/components/BookSearch.tsx`, `src/components/IssueSearch.tsx`: as-you-type, the tags, the hints.
- `src/components/BookListSearch.tsx` (new client piece) and `src/app/books/list/page.tsx`: the master list's box.
- `src/db/queries.ts`: `librarySearch` returns each book's level (from `to_read_level`) and whether it has a `calibre_id`.
- `src/components/AddIssues.tsx`: the Metron half asked on the pause.
- `src/app/globals.css`: the tag, from the existing `.tag` tokens.
- `.claude/rules/ui.md`: the add-flow sentence (D-84).
- `test/use-search.test.ts` (new, fake timers), `test/issue-search.test.tsx`, `test/add-book-sheet.test.tsx`, `test/e2e/book-search.spec.ts` (from 1.4f) and a master-list spec, with axe.
- `design/mockups.html`, `design/mockups-index.md`: the `add`, `bulk` and `blist` frames' tags and hints.

## Verification

- Automated: `test/use-search.test.ts` covers AC-1's vitest and AC-2; the component tests and the e2e specs cover AC-1's browser half, AC-3 to AC-6 (axe, screenshots); `test/query-budget.test.ts` still passes for `/books/list`.
- Manual: on `npm run dev`, open `/books/add` *Search* and type `pir` slowly → expected: results after the pause, no Enter; each row tagged (*Someday*, *Hardcover*, …). Type `pi` → expected: nothing listed. Open `/books/list`, type `sanderson` → expected: the list narrows as you type; press Back once → expected: you leave the list. Open a run's *Add issues*, type `thor 337-340` → expected: catalog and Metron results with their tags, and Metron asked as the plan settled.

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
