---
id: TASK-073
title: 1.30 Bring the Library and Now back under their JS budgets
status: In progress
depends_on: [TASK-058, TASK-059]
size: M
model: opus
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: 9f0959f
---

# TASK-073 — 1.30 Bring the Library and Now back under their JS budgets

## Goal

The books dashboard (`/books`, with Now) and the Library (`/books/list`) load
less JavaScript up front, so they fit their original budgets again, and nothing
they do changes.

## Context

- Roadmap: `docs/05-roadmap.md` § 1.30 Bring the Library and Now back under
  their JS budgets (M9; owner, 2026-11-10, PR #222). The entry and its
  **Check:** are the contract. The Check is marked *proposed; the owner agrees
  it by merging or edits it first*. It is not a 1.26 gate. Feature F-04 (fast
  on a phone).
- **Where the budgets stand.** `scripts/perf/budget.json` route `books`
  (`/books`) is at 177,200 bytes of JS, and route `library` (`/books/list`) is at
  173,000 bytes and 65 requests. Two stopgap raises got them there: PR #222
  (1.17b, D-131) took the status control's date pickers onto every Library row
  and onto Now, and PR #224 (2.3) added the plan picker's entry points. The
  owner raised `/books` to 177,200 on 2026-11-10 and kept 1.30's target. The
  history is in `docs/02-architecture.md` § Performance budget (the paragraphs
  on task 1.17b and task 2.3). The targets are the earlier ones: `/books`
  175,000, `/books/list` 170,000 and 64 requests. PR #226 (2.10b) merged after
  #224, so the plan starts from main's latest Lighthouse comment, not from these
  figures. PR #232 (D-144, the sheet making room for the undo toast) then
  raised `/books` to 177,400, `/books/list` to 173,100 and `/books/status` to
  175,100 bytes of JS, a third stopgap with the same targets; its measuring
  code is in `src/components/Undo.tsx`, which every page loads.
- **Leads, to be checked by measuring, not trusted.**
  - `src/components/AddBooksButton.tsx` imports `AddBooks` statically, so
    every page with an Add books button ships Search, *Paste a list* and *By
    hand* before the sheet opens. `PlanShelf` (on `/books`), `/books/list` and
    `/books/status` all render one. The architecture doc calls loading it with
    the sheet *the likeliest large saving*.
  - `src/components/BookStatus.tsx` (478 lines) holds the control's two pickers,
    the refusal reasons and the start re-date, and it renders on every Library
    row, in `BooksNow`, in `PlanQuarter` and on `/books/status`. `FinishDate.tsx`
    and `AllReads.tsx` come with it.
  - There is a pattern to copy: `AddBooks.tsx` already loads `PlanPickerBody`
    with `next/dynamic` (`ssr: false`), and `BookRowMenu.tsx` loads
    `FollowSheet` and `PlanPickerSheet` the same way.
  - PR #222 tried making the read list a lazy chunk. It saved under 250 bytes
    and added a request, so a chunk split that adds a request on first load
    can cost `/books/list` its 64.
- **Measuring.** Lighthouse runs only on a Vercel preview
  (`.github/workflows/lighthouse.yml`, task 0.10): mobile, three runs, median.
  `jsBytes` is the transfer size of every script the load fetched, prefetches
  included (`scripts/perf/lib/perf.mjs` `summariseLhr`). `test/perf.test.ts`
  holds the architecture doc's table (between `<!-- perf-budget -->` markers) to
  `budget.json`. For a local read of what each route ships, `next build`'s
  output and the chunks a page requests in a browser are enough to plan with.
  The preview is the measurement the Check reads.
- **Browser tests (D-141).** Before pushing, run the specs this task adds or
  changes in one project (`node scripts/test-files.mjs <specs>`, `w390-light`).
  CI's run with `e2e:full` is the browser gate.
- **What comes after.** 0.13 (D-142, proposed in the same PR as this task)
  replaces the ceiling rule with a gate on what each PR adds, measured from the
  budgets this task restores. Don't build any of 0.13 here.
- Architecture: `docs/02-architecture.md` § Performance budget. Design:
  `docs/04-design.md` § 10. The UX floor (sheets keep focus handling and a
  drawn loading state). Decisions: D-131, D-80, D-141, D-142.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): on the
branch's Vercel preview, Lighthouse's median of three measures `/books` at no
more than 175,000 bytes of JS and `/books/list` at no more than 170,000 bytes
and 64 requests; the budget table and `scripts/perf/budget.json` show those
numbers again; the Lighthouse job passes; and the status control's tests
(`test/reading-log.test.tsx`, `test/e2e/start-dates.spec.ts`) pass unchanged.
- [ ] AC-2: The PR body has a before/after table for `/books` and
  `/books/list` (JS bytes and requests, with main's last Lighthouse run as
  *before* and the branch's preview as *after*). It also lists the scripts each
  route loaded before the change, each with its size, so the change can be read
  against where the bytes were.
- [ ] AC-3: A guard test (beside `test/no-prefetched-handlers.test.ts`) fails
  if any component this task made lazy is imported statically by a component
  that renders on `/books` or `/books/list` (at least `AddBooks` from
  `AddBooksButton.tsx`, if the plan makes it lazy). Run against `main`, it
  fails.
- [ ] AC-4: Behaviour is unchanged. Opening Add books from the Library, from
  the dashboard's plan shelf and from `/books/status` opens the sheet with its
  destination set, as before. Focus moves into the sheet, and on close returns
  to the button that opened it. Tapping *Read* in the status control still opens
  *Started* and *Finished* together. `test/add-book-sheet.test.tsx`,
  `test/e2e/book-search.spec.ts`, `test/e2e/paste-books.spec.ts`,
  `test/e2e/plan-picker.spec.ts`, `test/reading-log.test.tsx` and
  `test/e2e/start-dates.spec.ts` pass without their assertions being edited.
- [ ] AC-5: The sheets and the status control meet the UX floor
  (`docs/04-design.md` § 10) after the change. While a lazily loaded part's
  code is still loading, the sheet shows its drawn loading state, never an
  empty sheet. Opening it shifts nothing on the page behind (Lighthouse CLS on
  `/books` and `/books/list` stays under 0.1). Its controls keep their names
  and target sizes, and reduced motion is honoured. There are screenshots of
  the opened Add books sheet and the status control's date step at each
  `ui.viewports` width.

## Out of scope

- 0.13's gate (growth over main, shared JS budgeted once, other-origin requests
  not budgeted, the history moving out of the architecture doc). It is a task of
  its own, after this one.
- Cover sizes and *Show covers* (task 4.3), and the Open Library cover requests
  on `/books/list`.
- Any change to what the status control, Add books or the plan picker do or
  look like, including copy. Bytes only.
- Other routes' budgets. If they shrink as a side effect, leave their numbers
  alone.
- Raising any budget. If the targets can't be met, stop and report (see
  Verification).

## Files likely touched

- `src/components/AddBooksButton.tsx` — load `AddBooks` with the sheet, not
  with the page (the plan confirms by measuring).
- `src/components/BookStatus.tsx` — load the date pickers and their reasons
  when a status is chosen, or draw from the server until touched (the plan's
  choice).
- `src/components/FinishDate.tsx`, `src/components/AllReads.tsx` — only if the
  plan moves them behind the same lazy boundary.
- `test/lazy-imports.test.ts` (new; the name is the plan's) — the AC-3 guard.
- `scripts/perf/budget.json` — `books` 175,000 JS; `library` 170,000 JS and 64
  requests.
- `docs/02-architecture.md` § Performance budget — the table, and one line on
  why the numbers were raised and when they came back.

## Verification

- Automated: the AC-3 guard test, failing on `main` and passing on the branch.
  `test/perf.test.ts` (the table matches `budget.json`). The specs in AC-4,
  unchanged. CI `check` with `e2e:full`.
- Automated, on the preview: the Lighthouse job passes, and its comment shows
  `books` ≤ 175,000 JS and `library` ≤ 170,000 JS and ≤ 64 requests.
- Manual: on the preview at 390px, open Add books from the Library on a cold
  load → expected: the sheet shows its loading state, then Search, with no
  blank frame. Set a Library row to *Read* → expected: *Started* and *Finished*
  appear together, as on `main`.
- If the measured savings can't reach the targets without changing behaviour,
  stop at the plan gate (or as soon as it's known) and report the numbers. Never
  raise a budget in this task.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- After 1.30, `/books/status` measures about 11 KB under its 175,400 ceiling (it lost the Add books chunk too, and Out of scope leaves its number alone); 0.13 re-bases it (approved at plan)

## Plan

_Written by /plan-batch or /implement-task Phase 1. Approved by the user (plan_status: approved) before any code is written._

**Measured.** Main's last Lighthouse run (PR #216, `10e8dc5`): `/books` 177,050 B JS / 36 requests, `/books/list` 172,850 B / 65. A local build with browser source maps shows the 9.4 KB (brotli) chunk common to all three book routes is exactly the Add books tree (`AddBooks`, `BookSearch`, `PasteBooks`, `ByHand`, `book-review`, `book-parse`); `BookStatus` + `FinishDate` are about 3.5 KB. A throwaway build with `AddBooks` lazy took ~10.5 KB and one script off each books route (`/books` 23,321 → 12,761 br of route chunks, `/books/list` 19,975 → 9,441, `/books/status` 21,719 → 10,523), so the status control is left alone.

**Steps**
1. AC-3 guard test first; confirm it fails on main.
2. `AddBooksButton.tsx`: load `AddBooks` with `next/dynamic` (`ssr: false`, as `BookRowMenu` does), `loading` = a sheet skeleton (the segmented control, Add to chips, search box in `--sunk`; busy; one sr-only "Loading"). `Sheet` keeps heading focus, inert and focus return.
3. `budget.json` back to `books` 175,000, `library` 170,000 / 64; `docs/02-architecture.md` table and a paragraph on why raised, when back, what was measured.

**Files**
- `src/components/AddBooksButton.tsx` — the lazy import.
- `src/components/Skeleton.tsx` — `AddBooksSheetSkeleton`.
- `test/lazy-imports.test.ts` (new) — static import walk from `/books`, `/books/list`, `/books/status`; fails if it reaches `AddBooks`, `BookSearch`, `PasteBooks` or `ByHand`.
- `test/add-books-loading.test.tsx` (new) — held import: skeleton, never an empty body; released: body replaces it.
- `test/add-book-sheet.test.tsx` — only if needed: `open()` waits for the lazy body; no assertion edited.
- `scripts/perf/budget.json`, `docs/02-architecture.md`.
- No `design/mockups.html` redraw: the loaded sheet does not change.

**Test strategy**
- AC-1: preview Lighthouse; `test/perf.test.ts`; `test/reading-log.test.tsx`, `test/e2e/start-dates.spec.ts` unchanged (BookStatus untouched).
- AC-2: PR body tables (before = #216's reports).
- AC-3: `test/lazy-imports.test.ts`.
- AC-4: the six named suites; e2e in `w390-light` locally, CI `e2e:full`.
- AC-5: `test/add-books-loading.test.tsx`; ui-verifier screenshots at every `ui.viewports` width.

**Risks**: `/books/list` lands at exactly 64 requests (covers depend on preview data); first open fetches ~9 KB behind the skeleton; `/books/status` shrinks ~11 KB, its number left alone.

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
