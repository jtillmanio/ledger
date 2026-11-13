---
id: TASK-079
title: 3.5 Detail sheets (2 of 3) — the book sheet, a route over the list
status: Draft
depends_on: [TASK-078, TASK-074]
size: M
model: opus
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
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
- Decisions: D-33, D-34, D-63, D-85, D-101, D-144, R1-11, UX-N24. Hard rule 6.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves the book clauses: Back dismisses the sheet and restores list scroll, a direct visit to `/books/{id}` renders the full page, no summary renders without a layout shift, and the sheet and the inline editor write status through the same code path. TASK-080 proves the issue clauses): test that the back button dismisses the sheet and restores list
scroll position; that a direct visit to `/books/{id}` renders the full page;
that a book with no summary renders without a layout shift; and that the sheet
and the master list's inline editor write status through the same code path.
Test that an issue placed in three runs, read in one, lists three runs with one
read, and that marking a second from the sheet writes exactly one
`issue_progress` row. Opening *Why blocked?* from inside an issue sheet leaves
exactly one sheet in the DOM, and Back returns to the issue sheet. An issue
with a `cover_date` renders *Cover date* in `Mon YYYY`. An undated issue
renders no *Dates* group and no `—`.
- [ ] AC-2: From the Library scrolled past its 40th row, opening a book shows the sheet with the list still rendered behind it; Back closes it, the URL returns to the list's, the scroll position is where it was, and focus is on the row link that opened it.
- [ ] AC-3: Loading `/books/{id}` directly, or refreshing on it, renders the full page with the same content and no sheet chrome; an unknown or soft-deleted id renders the not-found page.
- [ ] AC-4: Given a book read twice and listened once, *History* lists three reads, newest first, each with its start, finish and days taken, the listen with the headphones glyph, and the header reads *Read 2× · Listened 1×*; a book never listened to and not listening shows no *Listened* line. *Read again* on a read book adds one `read_events` row whose `reread_of` is the latest read's id.
- [ ] AC-5: An estimated word count renders `~` and the dotted edge; a stated one renders neither; a book with no summary renders the same sheet height for its other sections as one with a summary loaded late (CLS 0 measured in the spec).
- [ ] AC-6: The book sheet and full page meet the UX floor (`docs/04-design.md` § 10. The UX floor): loading (skeleton in the loaded geometry) and error states drawn; the close and grab handle are real controls with names, close 44px; focus moves to the sheet's heading on open and returns to the opener on close by Esc, Back, the scrim or the close; the page behind is `inert` except the undo toast; text 4.5:1 in both themes; reduced motion gives an opacity-only change; axe reports no new violations; screenshots at 360px, 834px and 1280px, light and dark.

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
