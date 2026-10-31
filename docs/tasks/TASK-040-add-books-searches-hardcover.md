---
id: TASK-040
title: 1.4f Add books searches Hardcover
status: Draft
depends_on: []
size: L
model: opus
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-040 — 1.4f Add books searches Hardcover

## Goal

*Search* on Add books lists Hardcover's books instead of Open Library's: one record per book, its subtitle and series apart from its title, and no omnibuses. Adding a result saves Hardcover's id, cover, pages and year, and a book you already have lists as yours.

## Context

- Roadmap: `docs/05-roadmap.md` § 1.4f Add books searches Hardcover (M9, sitting 9, after 1.4e and before 1.19 and 1.22). The roadmap entry and its **Check:** are the contract. "In the browser (0.11)" is the Playwright harness, `test/e2e/` (TASK-013).
- **Why this is one large task** (`workflow.splitPolicy: never-split`): a new table and its migration, a new server-side client, the search route, the add route and its write, and the search screen's copy land together; the table is useless without the client and the client without the screen.
- **Schema: the table is approved** (owner, 2026-10-28, D-94): `hardcover_cache(key text PRIMARY KEY, body jsonb NOT NULL, fetched_at timestamptz NOT NULL DEFAULT now())`, `open_library_cache`'s shape (`src/db/schema.ts`), no `user_id` (D-91). Rebuildable, so it joins `NOT_EXPORTED` in `src/db/export-tables.ts` beside `metron_cache` and `open_library_cache` (`test/export-tables.test.ts` fails on a table in neither list). The migration only adds, so there is no `drizzle/down/` file (Hard rule 7). `books.hardcover_id` (integer) already exists (1.14b). Any other column (for example a stored subtitle) is a **stop and ask**.
- The pattern to copy: `src/lib/openlibrary.ts` (cache key per query, `FRESH_DAYS = 7` per D-62, the 429's `Retry-After` kept as the `hold` row, a failure writes nothing, `toBooks` drops what can't be added). The Hardcover queries already written: `etl/enrich_books.py` `API`, `SEARCH_QUERY` (title search, `per_page`), `EDITIONS_QUERY` (by `isbn_13` / `isbn_10`), `BOOK_FIELDS` (`id title subtitle slug pages release_year compilation users_count …`). The token is `HARDCOVER_API_TOKEN`, read server-side only; Metron's *isn't set up here* path is the model for no token (`src/lib/metron.ts`, `src/components/IssueSearch.tsx`'s *Metron isn't set up here, so only your catalog was searched*).
- The route: `src/app/api/books/search/route.ts` (`BookSearchAnswer.openLibrary`, `librarySearch` called with the API's ids, titles and authors so a held book lists as yours, D-61). The add: `POST /api/books` (`src/app/api/books/route.ts`, `AddBookItem`'s `{ openLibrary }` arm, validated by `/^OL\d+W$/`) into `addBook` in `src/db/writes.ts` (creates with the work id, cover, year, pages and *est* words = pages × your words per page). Both gain a Hardcover arm; `librarySearch` in `src/db/queries.ts` matches on `hardcover_id` as it does on `open_library_id`. Open Library's code stays until 6.19 (D-94): whether the Open Library arms are kept unused or removed now is the plan's to say, within "stays until 6.19".
- **To settle at the plan gate** (the entry leaves these open):
  - How Hardcover's `subtitle` reads in a result and what the add stores as `books.title` (the entry: "the plan proposes how it reads"). The ETL's line (D-89, D-92, D-99) is that the title is Hardcover's `title`, with `title: subtitle` treated as the same book.
  - Which of a book's authors is *the* author when Hardcover lists several (`author_names` in the ETL's search), and what a result with no author does (today an authorless Open Library work is not listed, D-61).
  - How ten results are ranked (Hardcover's order, or by `users_count` as the ETL ranks).
  - How the browser test's *recorded Hardcover answers* reach the server: Playwright's `page.route` sees only the browser's requests, not the route's server-side `fetch`. Candidates: seed `hardcover_cache` rows with the recorded bodies before the spec (a cached answer makes no request), or a base-URL override the e2e server points at a local stub. Either must leave production reading the real API.
- Copy (D-94): *From Hardcover* (group head, today *From Open Library* in `src/components/BookSearch.tsx`), *Hardcover · est 174k words* (the result's meta), *Matched against your library first, then Hardcover* (the hint, today *Your library first, then Open Library. Searches when you press Enter.*; 1.22 changes the *Enter* half later). The rate-limited and error states keep 1.4c's wording with the source renamed.
- Docs it changes (the entry): `.claude/rules/ui.md` (*Hardcover is backfill-only* goes; the live add-flow sentence names Hardcover in Open Library's place), `docs/03-data-model.md` § 2.15's add flows, `docs/02-architecture.md` § 10. Metadata sources. `docs/SERVICES.md` already lists `HARDCOVER_API_TOKEN` as *From 1.4f* for production: this PR moves it to in use, and the owner adds the token to Vercel (production and preview) before the preview walk (an Owner checklist item).
- Design: mockup `add` (`design/mockups.html`, lines in `design/mockups-index.md`; print it with `scripts/screen.ps1 add`): its *Search* results and the *From Open Library* head. Standing rule 6: the `add` frame's copy follows this task's in the same PR (`ui.redrawFiles`).
- Decisions: D-94 (Hardcover replaces Open Library; the cache table; a compilation is not listed), D-99 (how a Hardcover lookup decides; a compilation never matches), D-62 and D-53 (cached answers, 7 days, the hold row), D-61 (a book is its title and author; the id rule), D-37 (a new book lands at Someday), D-91.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): in the browser (0.11), with recorded Hardcover answers: searching
`piranesi` lists Hardcover's results under *From Hardcover*, and a compilation
in the recorded answer is not listed; adding one creates one `books` row with
`hardcover_id` and its cover, and adding it again reuses it and says so; the
same search again makes no request; a recorded 429 shows the rate-limited
state while your library's results still list; an ISBN-13 lists one result.
A vitest shows that with no token the route answers from the library with no
request, and that no response carries the token.
- [ ] AC-2: Against the TEST database with a stubbed `fetch` (as `test/add-book.test.ts` stubs Open Library's): a search writes one `hardcover_cache` row and the same query again within 7 days makes zero requests; with that row's `fetched_at` moved back 8 days, it asks once more. A 429 with `Retry-After: 30` writes the `hold` row and the next search within 30 s makes no request and answers `rate_limited` with `retryIn` ≤ 30. A request that throws or answers 500 writes no cache row and answers `error` with your library's books.
- [ ] AC-3: Given a library book with `hardcover_id` 123, a search whose answer holds book 123 lists it once, under *In your library*, and not under *From Hardcover*; given a library book with Hardcover's title and author but no `hardcover_id`, the same (D-61). Adding a Hardcover result creates a `books` row with `hardcover_id`, `cover_url`, `page_count`, `published_year` and a `word_count` of pages × your words per page, `estimated`, and a `book_status` of `to_read` (Someday) with no plan row.
- [ ] AC-4: A query that is an ISBN, 13 or 10 digits with hyphens allowed (`978-0-7475-3269-9`, `0747532699`), asks for that edition (one request) and lists only its book; a non-ISBN of digits (`2026`) is searched as text. No response body, header or client bundle contains the token's value (the vitest asserts on the route's response; `NEXT_PUBLIC_` names no Hardcover variable).
- [ ] AC-5: `.claude/rules/ui.md` no longer says *Hardcover is backfill-only*; `docs/03-data-model.md` § 2.15 and `docs/02-architecture.md` § 10. Metadata sources name Hardcover as Add books' source; the mockup's `add` frame reads *From Hardcover* and *Matched against your library first, then Hardcover*.
- [ ] AC-6: Add books' *Search* meets the UX floor (`docs/04-design.md` § 10. The UX floor): the searching, no-results, rate-limited, not-set-up and error states are drawn; each result's add button names the book (*Add: Piranesi*); the source text (*Hardcover · est …*) is text, not colour alone, at 4.5:1 in both themes; targets at least 24px; screenshots at every `ui.viewports` width, light and dark.

## Out of scope

- Search as you type and the per-row source tag (1.22, which follows this task).
- Removing Open Library: `src/lib/openlibrary.ts`, `open_library_cache`, `books.open_library_id` and their ETL paths go in 6.19 (D-94).
- Hardcover covers moved to R2, or any cover work beyond saving the URL (4.3).
- Asking Hardcover from *Paste a list*, *By hand* or the wishlist review: they check only your library.
- Changing the ETL's Hardcover lookup (`etl/enrich_books.py`, 1.14b) or sharing its code with the app.
- Hardcover's series becoming a `book_series` row on add: the add writes the four columns the entry names.

## Files likely touched

- `src/db/schema.ts`: `hardcoverCache`; `drizzle/<tag>.sql` and `drizzle/meta/*` from `npm run db:generate`.
- `src/db/export-tables.ts`: `hardcover_cache` in `NOT_EXPORTED`.
- `src/lib/hardcover.ts` (new): the search, the ISBN lookup, the cache and the hold, `toBooks` without compilations.
- `src/app/api/books/search/route.ts`: Hardcover in place of Open Library, the no-token answer.
- `src/app/api/books/route.ts`, `src/db/writes.ts` (`AddBookItem`, `addBook`), `src/lib/book-add.ts`: the Hardcover arm of the add.
- `src/db/queries.ts`: `librarySearch` matches `hardcover_id`; `LibraryHit` carries it.
- `src/components/BookSearch.tsx`: the group head, the meta, the hint, the not-set-up state.
- `test/add-book.test.ts` (or a new `test/hardcover-search.test.ts`), `test/fixtures/hardcover-piranesi.json` (new, the recorded answer with a compilation), `test/e2e/book-search.spec.ts` (new, with axe), `test/add-book-sheet.test.tsx`.
- `.claude/rules/ui.md`, `docs/03-data-model.md`, `docs/02-architecture.md`, `docs/SERVICES.md`, `docs/OWNER-CHECKLIST.md` (the Vercel token item).
- `design/mockups.html`, `design/mockups-index.md`: the `add` frame's copy.

## Verification

- Automated: the DB test covers AC-1's vitest half, AC-2, AC-3 and AC-4; `test/e2e/book-search.spec.ts` covers AC-1's browser half and AC-6 (axe, screenshots); `test/export-tables.test.ts` passes with the new table; `npm run test:db:reset` migrates from zero.
- Manual: with `HARDCOVER_API_TOKEN` in `.env`, on `npm run dev` open `/books/add`, *Search*, search `piranesi` → expected: Hardcover's books under *From Hardcover*, no omnibus, each with *Hardcover · est …*. Search it again → expected: the same list, and no new `hardcover_cache` row's `fetched_at`. Add one, then undo it, leaving the development data as found. Remove the token and restart → expected: *Hardcover isn't set up here*, and your library's books still list.

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
