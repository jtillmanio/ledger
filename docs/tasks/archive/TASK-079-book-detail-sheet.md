---
id: TASK-079
title: 3.5 Detail sheets (2 of 3) — the book sheet, a route over the list
status: Done
depends_on: [TASK-078, TASK-074]
size: M
model: opus
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: ebbe799
---

# TASK-079 — 3.5 Detail sheets (2 of 3) — the book sheet, a route over the list

## Goal

Tapping a book opens everything about it as a sheet over the list (summary, counts, your record, every read), which Back dismisses with the list where you left it; a direct link opens the same book as a full page.

## Context

- Roadmap: `docs/05-roadmap.md` § 3.5 Detail sheets — books and issues (M14). The entry and its **Check:** are the contract, with its *From 1.23*, *From 2.10* and 2026-10-20 intake notes (copied below). Feature F-29.
- **Split, 2 of 3.** TASK-078 stored the summary and subjects. This part builds the sheet frame, the intercepted route and the book's content; TASK-080 reuses the frame for the issue sheet.
- **An intercepted route, not a modal** (`docs/04-design.md` § 13 → *What to build instead: an intercepted route*): `/books/[id]` renders as a sheet when arrived at from a list (`src/app/@modal/(.)books/[id]/page.tsx`, a `@modal` slot in `src/app/layout.tsx`) and as a full page on a direct load or refresh (`src/app/books/[id]/page.tsx`). This is Next.js 16: read `node_modules/next/dist/docs/` on intercepting and parallel routes before writing it, and `params` is async. Nothing like it exists in the app yet.
- **How it moves and stacks** (UX-N10, N12, N25; `design/STYLE_GUIDE.md` § 7): `--overlay`, radius 16 at the top, a 36×4 grab handle, a 44px close, over `--scrim` (may blur 2px), never glass. Phone: enters `translate-y-full → 0` over `--dur-4` `--ease-out`, scrim over `--dur-3`; follows a drag 1:1, dismisses past 30% of its height or a flick over 0.5px/ms, else springs back; exits `--dur-3` `--ease-in`. Tablet (768–1023px): the same bottom sheet, centred, at most 640px wide (D-33). Desktop (1024px+): a centred modal, opacity and `scale(.98 → 1)` over `--dur-2`. Reduced motion: opacity only. One sheet at a time (D-34): a sheet opened from inside a sheet replaces it with a back chevron naming where you came from, and Back unwinds one level. The cover morphs into the hero through the View Transitions API (`view-transition-name: cover-{id}`) where supported.
- The existing `src/components/Sheet.tsx` gives focus, `inert`, the toast kept live (D-63, D-144) and Esc; the plan says whether the route sheet extends it or wraps it, so the focus rules stay one behaviour (R1-11: *an intercepted route returns focus to the row link that led to it*).
- **Content** (design § 13 → *What each detail view shows*, Book; mockup `bookdetail`, `powershell -NoProfile -File scripts/screen.ps1 bookdetail`): the shared layout, hero, About, Details, *Your record*, History. Cover, summary, author, series and position, genre (`book_genre_tree`, as 4.5 directs for 3.5), year, page and word count with the `stated` / `estimated` flag, status, start and finish date (1.17), the rank and notes (TASK-074; and rating, as its plan gate settled), shelves, plan placement, reread history.
  - *From 1.23*: the reread history counts reads and listens apart (*Read 2× · Listened 1×*), each listen marked with the headphones glyph; the *Listened* line appears only when there is a listen or the book is being listened to.
  - *From 2.10 (TASK-069, PR #237)*: the Words field takes the estimated-count treatment from 2.2 (`~65k` and the dotted edge, `docs/04-design.md` § 14 → Plan).
  - *From the 2026-10-20 intake*: *Your record* shows the start date beside the finish (1.17), and each read in *History* shows both, with the days taken derived. The series name links to its series page (5.9) once 5.9 exists; until then it is plain text.
  - **Read again** (UX-N24): a read book's *History* offers *Read again*, which starts a `read_events` row with `reread_of` set (1.5).
- **The status control is the Library's** (`src/components/BookStatus.tsx`, `saveBookStatus` in `src/db/writes.ts`): the sheet and the master list's inline editor write status through the same code path (design § 13 → *What this changes*, 2: both exist and don't compete).
- Which rows link to the sheet (the Library's rows, Status, the dashboard's) is the plan's; the Library at least.
- *From 5.17 (TASK-092, TASK-093, TASK-094; D-121, D-132):* the sheet says what you own, *Physical*, *Audiobook* and *Ebook* as they apply (*Ebook* is `books.calibre_id` being set, D-90), or nothing, and carries the row menu's two toggles, *I own it on paper* and *I own the audiobook*, each one write with an undo through TASK-092's route, as the Library's `⋯` does (TASK-093). Whichever of this task and 5.17 lands second draws it: if this one merges before TASK-093, the sheet leaves ownership out and TASK-093's plan adds it.
- Decisions: D-33, D-34, D-63, D-85, D-101, D-144, R1-11, UX-N24. Hard rule 6.

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim; this part proves the book clauses: Back dismisses the sheet and restores list scroll, a direct visit to `/books/{id}` renders the full page, no summary renders without a layout shift, and the sheet and the inline editor write status through the same code path. TASK-080 proves the issue clauses): test that the back button dismisses the sheet and restores list
scroll position; that a direct visit to `/books/{id}` renders the full page;
that a book with no summary renders without a layout shift; and that the sheet
and the master list's inline editor write status through the same code path.
Test that an issue placed in three runs, read in one, lists three runs with one
read, and that marking a second from the sheet writes exactly one
`issue_progress` row. Opening *Why blocked?* from inside an issue sheet leaves
exactly one sheet in the DOM, and Back returns to the issue sheet. An issue
with a `cover_date` renders *Cover date* in `Mon YYYY`. An undated issue
renders no *Dates* group and no `—`.
- [x] AC-2: From the Library scrolled past its 40th row, opening a book shows the sheet with the list still rendered behind it; Back closes it, the URL returns to the list's, the scroll position is where it was, and focus is on the row link that opened it.
- [x] AC-3: Loading `/books/{id}` directly, or refreshing on it, renders the full page with the same content and no sheet chrome; an unknown or soft-deleted id renders the not-found page.
- [x] AC-4: Given a book read twice and listened once, *History* lists three reads, newest first, each with its start, finish and days taken, the listen with the headphones glyph, and the header reads *Read 2× · Listened 1×*; a book never listened to and not listening shows no *Listened* line. *Read again* on a read book adds one `read_events` row whose `reread_of` is the latest read's id.
- [x] AC-5: An estimated word count renders `~` and the dotted edge; a stated one renders neither; a book with no summary renders the same sheet height for its other sections as one with a summary loaded late (CLS 0 measured in the spec).
- [x] AC-6: The book sheet and full page meet the UX floor (`docs/04-design.md` § 10. The UX floor): loading (skeleton in the loaded geometry) and error states drawn; the close and grab handle are real controls with names, close 44px; focus moves to the sheet's heading on open and returns to the opener on close by Esc, Back, the scrim or the close; the page behind is `inert` except the undo toast; text 4.5:1 in both themes; reduced motion gives an opacity-only change; axe reports no new violations; screenshots at 360px, 834px and 1280px, light and dark.

## Out of scope

- The issue sheet and `/comics/[runId]/[issueId]` (TASK-080).
- Film, show and season sheets (8.4).
- The series page (5.9) and the author page.
- Editing a book's catalog data (title, author, series) from the sheet.

## Files likely touched

- `src/app/layout.tsx`, `src/app/@modal/default.tsx`, `src/app/@modal/(.)books/[id]/page.tsx` (new) — the slot and the sheet.
- `src/app/books/[id]/page.tsx` (new) — the full page.
- `src/components/BookDetail.tsx` (new) — the shared content.
- `src/components/RouteSheet.tsx` (new, or an extension of `src/components/Sheet.tsx`) — drag, motion, Back.
- `src/db/queries.ts` — one book's detail and its reads.
- `src/app/books/list/page.tsx` — rows link to the sheet.
- `test/book-detail.test.tsx` (new), `test/e2e/book-detail.spec.ts` (new).

## Verification

- Automated: `test/book-detail.test.tsx` (AC-4, AC-5's rendering), `test/e2e/book-detail.spec.ts` (AC-1's book clauses, AC-2, AC-3, AC-5's CLS, focus, axe).
- Manual: on a phone-width preview, open a book from the Library, drag the sheet down past a third → it dismisses; a short drag springs back; the hardware Back closes it.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- The book sheet's own writes (split at the plan gate): a notes editor (TASK-074's route), 5.17's *I own it on paper* / *I own the audiobook* toggles, plan *Move* and shelves *Edit*, and the dashboards' book rows opening the sheet → docs/05-roadmap.md § 3.5b (new; approved at plan; its Check is proposed) and docs/06-tasklist.md § M14
- The cover → hero morph through the View Transitions API (`view-transition-name: cover-{id}`) → docs/tasks/TASK-080-issue-detail-sheet.md § Context (approved at plan)
- *Read again* is a status change to Reading; its `read_events` row arrives with the finish → not tracked: the owner's plan-gate answer, recorded in this task's Plan (within data model 2.17 and 1.5's log rule, no new decision)
- Decision (approved by the owner 2026-11-16): a detail route never shares a dynamic segment with static siblings, because Next 16 applies the interception rewrite ahead of them; the book's route is `/book/[id]`. The roadmap's 3.5 Check is read as `/book/{id}`, not edited → docs/review/decisions.md § D-157, with docs/04-design.md § 13 (*What to build instead: an intercepted route*) updated to match
- TASK-080: `/comics/[runId]/[issueId]` collides with `/comics/[runId]/add` the same way (an intercepted `[issueId]` catches `add`); its plan picks a route that doesn't → docs/tasks/TASK-080-issue-detail-sheet.md § Context
- The loading skeleton draws three summary lines, taller than a book with no summary, so Details moves up when such a book arrives → not tracked: most books carry Calibre's comments, so three lines is the commoner geometry, and CLS stays 0 (the skeleton is replaced, not moved)
- The mockup's hero *Start reading* button is not drawn → not tracked: the sheet's status control is drawn open, so *Reading* is one tap in *Your record*, which design § 13 *What this changes* 2 makes the one write path
- Schema review R2 (MINOR): the cross-user test doesn't cover the `to_read_level` and latest-read joins' user filters → not tracked: the four filters it does cover are the ones a leak would show; optional hardening, no rule asks for it
- `/books/list` (76,462) and `/settings` (16,077) still over their byte budgets after the trim (revision 3), raised to the median plus about 5%, 80,000 and 16,800, by the owner's trim-then-raise call → docs/02-architecture.md § Performance budget and scripts/perf/budget.json (in this PR)

## Plan

Approved by the owner 2026-11-16. Plan-gate answers: **Read again** sets the status to Reading through `saveBookStatus` (the status control's path, today's start stamped); the `read_events` row with `reread_of` = the latest read's id is appended when that read is finished, never on the press (an unfinished row would count as a read in `book_reads`), and AC-4's clause is proven by Read again → finish → exactly one new row with that `reread_of`. **Split**: the sheet's writes beyond status and Read again (a notes editor, 5.17's ownership toggles, plan *Move*, shelves *Edit*) go to a new roadmap item; here notes, ownership, plan placement and shelves are read-only text. **The cover morph** (View Transitions) is TASK-080's. **Links**: the Library's rows and the books Status rows; the dashboards' rows are the new item's.

**Steps**

1. Route frame: `src/app/layout.tsx` takes a `modal` slot, rendered after `<Shell>` inside the providers; `src/app/@modal/default.tsx` and `src/app/@modal/[...catchAll]/page.tsx` render null (a soft navigation out of the sheet must clear the slot).
2. `src/app/@modal/(.)books/[id]/page.tsx`: `<RouteSheet heading=…><BookDetail …/></RouteSheet>`; `src/app/@modal/(.)books/[id]/loading.tsx`: the sheet chrome with a skeleton in the loaded geometry. `src/app/books/[id]/page.tsx`: the full page, `<main>` with the same `BookDetail`, no sheet chrome; `loading.tsx` and `error.tsx` beside it. Both pages `await params` and call `notFound()` when `bookDetail` answers null (unknown or soft-deleted).
3. One focus behaviour: the focus core of `src/components/Sheet.tsx` (inert outside but the toast, heading focus, Tab trap, Esc, focus back to the opener) moves into an exported `useSheetFocus` hook in the same file; `Sheet` keeps its own `pushState`/popstate, `RouteSheet` uses the route's history entry: every close (×, scrim, Esc, drag) is `router.back()`, and the opener is the element focused when it mounted (the row link, R1-11).
4. `src/components/RouteSheet.tsx` (client): `--overlay` over `--scrim`, a 36×4 grab handle that is a named button, a 44px close. Below 1024px a bottom sheet (tablet: centred, at most 640px, D-33) that follows a drag 1:1 and dismisses past 30% of its height or a flick over 0.5px/ms, else springs back; enter `translate-y-full → 0` over `--dur-4` `--ease-out`, scrim over `--dur-3`, exit `--dur-3` `--ease-in` before `router.back()`. 1024px and up: a centred modal, opacity and `scale(.98 → 1)` over `--dur-2`. Reduced motion: opacity only. Page scroll is locked while open.
5. `src/components/BookDetail.tsx` (server): the shared layout from design § 13 and mockup `bookdetail`. Hero (cover, title, author, series #n · year, plan badge, genre chip); About (the summary; with none, a one-line *No summary yet* placeholder at a fixed block size so later content does not move); Details (Published, Pages, Words: `~` and the dotted edge when estimated, a `stated` badge when stated; Series as plain text until 5.9; Subjects); Your record (the Library's `BookStatus`, the same component and `saveBookStatus` path, with a new `expanded` prop so it starts open and the title passed in; the start and finish; Notes, Shelves, Planned for and Owned as read-only text); Reading history (newest first: each read's start, finish and days taken, its rank in its year where ranked, the headphones glyph on a listen; the header *Read 2× · Listened 1×*, the *Listened* part only with a listen or while listening; *Read again* on a read book, a small client button that posts `status: reading` through `useBookWrite`).
6. `src/db/queries.ts`: `bookDetail(userId, bookId)`: one live book's facts (summary, subjects, pages, words and source, published year, cover, series and position, universe, genre via `book_genre_levels`), status, start/finish, notes, plan level and period (`to_read_level`), shelves, owned, read and listen counts; and its reads newest first with `year_rank` and days taken (exact days only). Null for an unknown or removed book.
7. Links: `src/app/books/list/page.tsx` row titles and `src/components/StatusBookRow.tsx` titles become `<Link href=/books/{id} scroll={false}>`.
8. `src/app/globals.css`: the sheet, modal, drag and detail classes, tokens only (hard rule 6).

**Files**: `src/app/layout.tsx`; `src/app/@modal/default.tsx`, `src/app/@modal/[...catchAll]/page.tsx`, `src/app/@modal/(.)books/[id]/page.tsx`, `…/loading.tsx` (new); `src/app/books/[id]/page.tsx`, `loading.tsx`, `error.tsx` (new); `src/components/BookDetail.tsx`, `src/components/RouteSheet.tsx`, `src/components/ReadAgain.tsx` (new); `src/components/Sheet.tsx` (hook extracted); `src/components/BookStatus.tsx` (`open` prop); `src/db/queries.ts`; `src/app/books/list/page.tsx`; `src/components/StatusBookRow.tsx` (not in Files likely touched); `src/app/globals.css`; tests below.

**Test strategy**

- AC-1 (book clauses), AC-2: `test/e2e/book-detail.spec.ts` › *opens over the Library and Back restores scroll and focus* (scroll past row 40, open, list still rendered, Back: URL, scrollY, focused link) and › *the sheet and the row write status through one route* (both POST `/api/progress/book`).
- AC-3: › *a direct visit renders the full page* (no `role=dialog`, same headings; reload too) and › *an unknown id is not found*; › *static siblings are not intercepted* (`/books/plan` from the Library).
- AC-4: `test/book-detail.test.tsx` (render: three reads newest first, dates and days, glyph, header, no *Listened* line) and `test/book-detail-query.test.ts` (`bookDetail` against the TEST database; Read again → finish → one new `read_events` row with `reread_of` = the previous latest).
- AC-5: `test/book-detail.test.tsx` (`~`/dotted edge vs `stated`); e2e › *no summary, no layout shift* (CLS 0 with a PerformanceObserver).
- AC-6: e2e › focus on open and on close by Esc, scrim, close and Back; `inert` behind; reduced motion opacity only; axe; screenshots 360/834/1280 light and dark.

**Risks**: `(.)books/[id]` could intercept static siblings (`/books/plan`), covered by a test; the hardware Back unmounts the sheet without the exit motion (the route is gone); the size (about 17 files, UI only) is over the threshold, reduced by the split above.

**Follow-ups**: see `## Follow-ups` (approved at plan).

**Revisions after approval**

1. *The route is `/book/[id]`, not `/books/[id]`* (owner, 2026-11-16, after the e2e run). Next 16 applies an intercepting route's rewrite ahead of the static routes beside it: with `@modal/(.)books/[id]`, a tap from the Library to `/books/plan` (or Status, Top, Add, the Library itself) was intercepted as `id = "plan"` and rendered a 404, and a save inside the sheet (`router.refresh()`) fell back to a full page load. Both reproduced on a production build (`npm run test:e2e:build`) and both went away with the route at `/book/[id]`, a segment nothing else uses. The files are `src/app/book/[id]/…` and `src/app/@modal/(.)book/[id]/…`; AC-1's and AC-3's `/books/{id}` is read as `/book/{id}`.
2. *No `@modal/[...catchAll]` page.* It made `@next/next/no-html-link-for-pages` treat every URL as a page (the settings page's deliberate `<a href="/api/export">`, two test fixtures). `RouteSheet` remembers the path it opened on instead and unmounts on any other (its page back from `inert`, focus returned), which is the job the catch-all did. Two fixtures in `test/paste-books.test.tsx` became the `<button>` the same file already uses, as the new `/book/[id]` page made the rule flag their `<a href="/books">`.
3. *The Library's rows carry a plain `<a>`, opened as the sheet by one wrapper* (owner, 2026-11-16, after Lighthouse on PR #275: `/books/list` measured 76,775 bytes against its 74,000 budget with a `<Link>` per row, and `/settings` 16,037 against 16,000 from the `@modal` slot every route now carries). `src/components/SheetLinks.tsx` (new) wraps the rows and turns a plain click on a title into `router.push(href, { scroll: false })`. The owner's call: trim first, remeasure on the preview, then raise only what is still over, in `scripts/perf/budget.json` and `docs/02-architecture.md` § Performance budget. The books Status rows keep their `<Link>` (that route has room). Three existing specs that pinned "no link" on a book row (`test/e2e/markup.spec.ts`, two in `test/e2e/status.spec.ts`) now pin the one title link and still no handle.
4. *Reduced motion is no movement at all.* `globals.css` already stops every animation and transition under `prefers-reduced-motion` (UX-N01, `animation:none!important`), so the sheet's own opacity-only keyframes never ran on a build (dev loaded them after the rule). They are gone: under reduced motion the sheet simply appears and goes, which the spec checks.
5. Two files beside the planned ones in the same steps: `src/app/@modal/(.)book/[id]/layout.tsx` (the sheet is the segment's layout, so it stays put while the skeleton gives way to the book and its focus and motion run once) and `…/error.tsx` (the UX floor's error state in the sheet).

## Review log

_Filled by /implement-task. One line per round._

- Verify R1 PASS (vitest 1963, py 411, views.sql; a first attempt from a lowercase `c:` drive could not find the runner and was rerun) | e2e local R1 FAIL(6) → R2 FAIL(2) → R3 PASS 12/12 (route moved to `/book/[id]`; title link overlap; drag velocity)
- CI R1 FAIL (`markup.spec.ts:79`, `status.spec.ts:337` and `:709` pinned "no link"; `book-detail.spec.ts:162` at 768 and 1280; reduced motion on a build) → fixed | Lighthouse R1 FAIL (library 76,775 / 74,000; settings 16,037 / 16,000) → trimmed (revision 3)
- Spec R1 CHANGES (sheet title CSS, Read again untested, full page dark only) → R2 APPROVE | Schema R1 APPROVE (3 MINOR) → R2 APPROVE
- Verify R2 PASS (vitest 1965) | build e2e (book-detail, markup, status × w390-light, w768-light, w390-reduced-motion) PASS 177
- Merged `main` (task 4.3's Show covers) → Verify R3 PASS (vitest 1985) | Lighthouse R2 FAIL (library 76,462; settings 16,077) → budgets raised (revision 3, the owner's call)
- Test audit and ui-verifier not run: the owner accepted the task before they were reached (2026-11-16)

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 3 (local), CI 2+
- Review rounds: 2 (spec), 2 (schema)
- First-pass AC FAILs: 2 (AC-2 and AC-3 under the `/books/[id]` route, from the interception clash; AC-6's sheet title font)
- Plan revisions after approval: 5 (route `/book/[id]`; no catch-all; two files in step; the Library's plain links; reduced motion; the extra layout and error files)
