---
id: TASK-111
title: 5.15 Parked (5 of 5) — the /parked review, the dashboard line and the Inbox row
status: Done
depends_on: [TASK-109, TASK-110, TASK-127]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: e591e5d
---

# TASK-111 — 5.15 Parked (5 of 5) — the /parked review, the dashboard line and the Inbox row

## Goal

A review page lists everything you've parked, oldest first, and lets you keep each one parked, plan it (or pick it back up), or let it go to Unlisted; when the review is due, the books dashboard and the Inbox say so, quietly.

## Context

- Roadmap: `docs/05-roadmap.md` § 5.15 Parked (M17), *The review* and *The reminder is in the app* bullets. D-105. Pulled ahead of 1.26 (D-139). Feature F-66. Its **Check (proposed):** is the contract.
- **Split, 5 of 5.** TASK-108 built the status, TASK-109 the verb and chip, TASK-110 the cadence and due rule, TASK-127 the unparking writes (split from this task at its plan gate, owner, 2026-11-20). This part draws the review and the reminders, and **its merge ticks 5.15**.
- **The review.** `/parked` lists every parked item, books first (then each medium's as it lands: 5.16's runs), oldest parked first, each with *Parked 4 months* (from `book_status.parked_on`, TASK-108). Each book row has three verbs, each one write with Undo: **Keep parked**; **Plan…** (2.3's picker, `src/components/PlanPicker.tsx`: a quarter, a year, On deck or Someday), or for a book parked mid-read **Pick it back up** (back to `reading`, keeping its start); and **Unlisted** (writes `unlisted`; its Undo puts back `parked`). *Done reviewing* records the review (TASK-110's write), whatever is left parked. What *Keep parked* writes is the plan's (nothing but a mark that the row was seen, or nothing at all: the Check doesn't need it stored).
- **The reminder is in the app** (owner, 2026-11-02). When the review is due (TASK-110's rule), the books dashboard's rollup slot (2.2; `src/app/books/page.tsx`, `data-slot="rollup"`) gains a grey line, *Review 9 parked →*, linking to `/parked`, with no nudge copy, and the Inbox (`src/app/inbox/page.tsx`, `src/lib/inbox.ts`) lists one *Parked review* row at its top until it is done. No push notification. The email is 7.6's. TASK-100 adds *Coming out*'s line to the same slot; whichever lands second sets their order against the frame.
- **Navigation:** `/parked` is reached from the line, the Inbox row and the Library's *Parked · N* chip (the plan says whether it gets a nav item; the entry names none). Add `/parked` to `docs/02-architecture.md` § 5.
- **Not drawn yet:** the mockup gains `/parked` and the dashboard line at phone, tablet and desktop widths, before they are built; `design/mockups-index.md` lists them (`ui.redrawFiles`).
- Design: `design/mockups.html` § `bdash`, § `capture` (the Inbox screen); `design/STYLE_GUIDE.md` § 14 (the five slots); `docs/04-design.md` § 10 The UX floor, § 12 The dashboards; `.claude/rules/ui.md` (nothing on a dashboard is red; *Remove* and *Drop* only may be red, and *Unlisted* is neither).
- Decisions: D-105, D-37, D-83.
- The two notes from TASK-109 (PR #299: an add unparks a Parked book, with the review's *Plan…* needing the same unparking; `queueListen` refuses a Parked book) moved to TASK-127 at the split, which builds them. The review's *Plan…* writes through that add (`POST /api/books/bulk` with `{ use }`), and its *Unlisted* through `saveBookStatus` from Parked (TASK-127).
- *From TASK-127 (5.15, PR #304; schema-reviewer's findings):* two places still let a Parked book into a table it shouldn't be in, outside TASK-127's plan. (1) The listen queue's refusal (`queueListen`, 400) leaks through three undos: `restoreListen` (a *Remove* from the queue undone after the book was parked) queues a Parked book; an add's undo (`undoInside`) and `undoBookStatus` with `prior.status = 'parked'` put a book back to Parked while a `listen_queue` row written since (it was `to_read`) stays. Decide whether each refuses or takes the book off the queue, and say so in `.claude/rules/schema.md`. (2) A plan move's undo (`undoMoveIn`, `src/db/writes.ts`) refuses only a book gone `unlisted`, so it can put a plan row back under a book parked since: refuse `parked` there too (the AC-3 invariant, a Parked book is in no plan). Neither is reachable from a screen before `/parked` lands, so this task's review verbs are where it would first show. Also in (1)'s undo paths: `undoBookStatus` reads the book's status and its plan rows without a lock, so an undo of a park racing an add that unparks and plans the same book can overwrite the add's `to_read` and leave the book in two periods (single user, two writes racing; lock the status row there as `saveBookStatus` now does). (Arrived after the plan was approved.)

## Acceptance criteria

- [x] AC-1 (roadmap **Check (proposed):**, verbatim; this part proves, in the browser (0.11) on the test database: the review's *Plan…* opens 2.3's picker, *Unlisted* writes `unlisted` and Undo puts back `parked`, the dashboard line shows only when the review is due, and nothing on the dashboard or the review resolves to `--danger`. TASK-108 to TASK-110 prove the rest): (proposed; the owner agrees it by merging or edits it first)
`npm test`: parking the 2nd of 3 books in 2027 Q1
writes `parked`, removes its plan row and leaves Q1 at ordinals 1–2, and
Undo restores `to_read` at position 2. A parked book is absent from
`to_read_level`, `plan_period`, the three status-screen tabs and 2.10b's
suggestions, and present under the master list's *Parked* chip and in
search tagged *Parked*; a series with one read and one parked book reads
`1 / 2`. With a monthly cadence, one parked book and a last review 40 days
ago, the review is due; with nothing parked it is not; *Done reviewing*
makes it not due. In the browser (0.11), the review's *Plan…* opens 2.3's
picker, *Unlisted* writes `unlisted` and Undo puts back `parked`, and the
dashboard line shows only when the review is due. Nothing on the
dashboard or the review resolves to `--danger`.
- [x] AC-2: Given two books parked 4 months and 2 weeks ago, `/parked` lists the older first, each with its *Parked …* age; a book parked from `reading` shows *Pick it back up* in place of *Plan…*, and pressing it returns it to In flight with its start date.
- [x] AC-3: *Plan…* → a quarter places the book at that quarter's end and takes it off the review; its Undo puts it back to `parked` and removes the plan row.
- [x] AC-4: With the review due, the books dashboard's rollup slot shows *Review N parked →* (N = the parked count) linking to `/parked`, and the Inbox's first row is *Parked review*; after *Done reviewing*, both are gone; the five slots keep their order.
- [x] AC-5: `design/mockups.html` draws `/parked` and the dashboard line at phone, tablet and desktop, and `design/mockups-index.md` lists them (task 5.15); `docs/02-architecture.md` § 5 lists `/parked`.
- [x] AC-6: The review and the line meet the UX floor (`docs/04-design.md` § 10): `/parked` with nothing parked draws a calm empty state, loading skeletons, an error state; every verb is a real button naming its book, ≥ 24px (44px on a phone row); contrast in light and dark; no computed colour on the dashboard or the review equals `--danger`; screenshots at each `ui.viewports` width.

## Out of scope

- The status, verb, chip and cadence (TASK-108 to TASK-110).
- Parked runs (5.16) and other media; the email (7.6); push notifications.

## Files likely touched

- `src/app/parked/page.tsx`, `src/app/parked/loading.tsx` (new).
- `src/components/ParkedRow.tsx` (new; the name is the plan's) — the three verbs through `useBookWrite` and `PlanPicker`.
- `src/app/books/page.tsx`, `src/db/queries.ts` — the dashboard line.
- `src/lib/inbox.ts`, `src/app/inbox/page.tsx` — the *Parked review* row.
- `src/app/books/list/page.tsx` — a grey *Review parked →* line under the *Parked* filter (plan).
- `design/mockups.html`, `design/mockups-index.md`, `docs/02-architecture.md`.
- `test/inbox.test.ts`, `test/books-dashboard.test.ts`, `test/e2e/parked-review.spec.ts` (new).

## Verification

- Automated: `test/books-dashboard.test.ts` and `test/inbox.test.ts` (the line and the row only when due), `test/e2e/parked-review.spec.ts` (AC-1's browser clauses, AC-2 to AC-4, the `--danger` sweep, axe; screenshots at each width).
- Manual: on the dev database with a parked book and a monthly cadence last reviewed long ago, Books → the rollup's *Review 1 parked →* → `/parked` → *Plan…* → a quarter → *Undo* → *Done reviewing* → the line is gone. Leave the data as found.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- The *From TASK-127* note's undo fixes (Context): `restoreListen`, `undoInside` and `undoBookStatus` back to `parked` leaving a `listen_queue` row; `undoMoveIn` refusing only `unlisted`, not `parked`; the unlocked status read in `undoBookStatus` (check first: it now takes `lockBook` on the book row), and the rule in `.claude/rules/schema.md`. Schema-reviewer (TASK-111, R1): `/parked` makes the listen-queue half reachable from a screen: a review verb (*Plan…* or *Unlisted*), then *Queue to listen* on that book, then the verb's Undo leaves a Parked book in `listen_queue` (`undoInside` and `undoBookStatus` back to `parked`; fix: take the book off the queue under `lockListen`, or refuse). Its own work, not this task's: a new phase-5 roadmap item with a proposed **Check:**, and its row in M17's table (`docs/06-tasklist.md`) → docs/05-roadmap.md § 5.18 (new) (approved at plan, owner 2026-11-20)
- Schema-reviewer (R1, minor): a `/parked` tab left open while the book is unparked elsewhere still offers *Plan…*, which then runs a plain add (no `unparked` in its entry) → not tracked: it is any Add books add of a To read book, its Undo is that add's, and the next refresh drops the row
- Schema-reviewer (R1, minor): *Pick it back up* on a book parked from Listening brings it back as Reading, its start kept → not tracked: accepted as is; both are In flight, and the format is the read's to say when it is finished
- Spec-reviewer (R2): the error state is tested as drawn (swapped into `<main>`), not by pressing *Try again* through a real failed render → not tracked: AC-6 asks for the state drawn; every other route's error state is tested the same way
- Test-auditor: `expectNoDanger` compares against `--danger` in the page's current theme only, while axe and contrast run in both → not tracked: the same helper and limit as `books-dashboard.spec.ts` and `dashboard-covers.spec.ts`; a suite-wide change, not this task's
- `design/mockups-index.md`'s line ranges had drifted before this task (`releases` read 5451–5554, it is at 5542); the rows this task touched carry true ranges → not tracked: the ranges are a reading aid, and `scripts/screen.ps1` finds a screen by its `data-id`
- UI walk: under `/books/list?status=parked` the Library's series section still lists every series, and did before anything was parked → not tracked: the Library's series section, which this task doesn't touch; the walk saw it the same with the filter showing 0 books

## Plan

Approved by the owner 2026-11-20, with the plan gate's answers: split in two (the writes are TASK-127, which this depends on); the Library's *Parked · N* chip stays a filter, and with it on a grey *Review parked →* line links to `/parked` (no nav item); the dashboards' inbox chip counts notes only.

**Steps**
1. `src/db/queries.ts` `parkedBooks(userId)`: every live Parked book, oldest `parked_on` first (then title): id, title, author, `universe`, `series`, `series_position` (the row's line and the picker's header, `bookSub`, as 2.2l's `PlanBook` carries them: D-134, revision 1), `parked_on`, `started_on_precision`. `src/lib/parked.ts` `parkedAge(parkedOn, today)`: *Parked today*, *Parked 3 days*, *Parked 2 weeks*, *Parked 4 months*, *Parked 1 year* (calendar months, `addMonths`).
2. `/parked` (`src/app/parked/page.tsx`): `parkedBooks` and `parkedReview` together; the heading, a grey *Last reviewed …* line (or *Not reviewed yet*), a *Books* group of `ParkedRow`s, and *Done reviewing* (`src/components/ParkedDone.tsx`: `POST /api/parked/review`, its Undo `DELETE` with the change, a failed save's neutral line with Retry). Nothing parked: a calm slate, *Nothing parked.* with one action, **Open the Library**. `loading.tsx`: skeleton rows at the loaded size. `error.tsx` if the app's shared error boundary doesn't cover the route.
3. `src/components/ParkedRow.tsx`: the title, author and *Parked 4 months*; three real buttons, each naming its book (`aria-label`), ≥ 44px on a phone row:
   - **Keep parked**: writes nothing (the Check needs nothing stored); the row folds to *Kept parked*, and the Undo toast unfolds it.
   - **Plan…**: a `Sheet` over `PlanPickerBody` (verb *Add*, the book's words, no `from`); confirming posts `{ items: [{ use }], destination }` to `/api/books/bulk` (Someday, On deck, a year or a quarter), pushes the Undo (`DELETE /api/books` with the entry: back to `parked` and its day, TASK-127), refreshes and closes. For a book parked mid-read (`isParkedMidRead`), **Pick it back up** in its place: `useBookWrite` with `reading` (the start is kept; Undo back to `parked`).
   - **Unlisted**: `useBookWrite` with `unlisted` (TASK-127); Undo puts back `parked`. Grey, never `--danger`.
4. `src/components/ParkedReviewLine.tsx`: *Review N parked →*, grey, a link to `/parked`, only when `due`; in `/books`'s rollup slot after *Coming out*'s line, before the progress link (the order drawn in the mockup). `/books` adds `parkedReview()` to its one wave.
5. Inbox: `/inbox` reads `parkedReview()` with its two queries; when due, a *Parked review* row (*N parked · due since …* or *N parked*) with **Review** (a link to `/parked`) is the first row of *Unresolved*, and the heading's count includes it; the *Nothing waiting* slate shows only when there is neither. `src/lib/inbox.ts` gets the row's copy helper. The dashboards' inbox chip (`inboxCount`) is unchanged.
6. `src/app/books/list/page.tsx`: with `?status=parked`, a grey *Review parked →* line to `/parked` under the chips.
7. `src/app/globals.css`: the review's rows, the folded *Kept parked* row and the line, from existing tokens only.
8. Design and docs: `design/mockups.html` draws `/parked` (phone 360 with rows, one mid-read, one folded *Kept parked*; phone empty; 834px; desktop) and the dashboard line on `bdash`'s reading frames at 390, 834 and desktop; `design/mockups-index.md` lists them (a `parked` row; `bdash` and `capture` gain their lines). `docs/02-architecture.md` § 5 lists `/parked`; § 7's budgets: `/books` 14, `/inbox` 3, `/parked` 2.

**Files**: `src/db/queries.ts`, `src/lib/parked.ts`, `src/app/parked/page.tsx`, `src/app/parked/loading.tsx` (new), `src/components/ParkedRow.tsx` (new), `src/components/ParkedDone.tsx` (new), `src/components/ParkedReviewLine.tsx` (new), `src/app/books/page.tsx`, `src/app/inbox/page.tsx`, `src/lib/inbox.ts`, `src/app/books/list/page.tsx` (not in Files likely touched before the gate), `src/app/globals.css`, `design/mockups.html`, `design/mockups-index.md`, `docs/02-architecture.md`, `test/query-budget.test.ts`, `test/books-dashboard.test.ts`, `test/inbox.test.ts`, `test/parked-review.test.ts`, `test/e2e/parked-review.spec.ts` (new).

**Test strategy**
- AC-1 (its browser clauses), AC-2, AC-3, AC-4: `test/e2e/parked-review.spec.ts` on the test database: two books parked 4 months and 2 weeks ago (the older first, each age); one parked from `reading` shows *Pick it back up*, which puts it in In flight with its start; *Plan…* opens the picker, a quarter puts the book at its end and off the review, Undo back to Parked with no plan row; *Unlisted* writes `unlisted`, Undo back to `parked`; with a monthly cadence and a review 40 days ago, the dashboard line and the Inbox's first row show, *Done reviewing* takes both away, and not due neither shows; the five slots keep their order.
- AC-1's *nothing resolves to `--danger`*, AC-6: the same spec walks every element on `/books` and `/parked` comparing computed colours with `--danger`; axe; the empty state; real buttons naming their book, ≥ 24px (44px at phone width); screenshots at each `ui.viewports` width; loading skeleton at the loaded size; the error state.
- AC-4 server side: `test/books-dashboard.test.ts` and `test/inbox.test.ts` (the line and the row only when due); `test/parked-review.test.ts` › `parkedBooks` order and `parkedAge`; `test/query-budget.test.ts` (the new budgets).
- AC-5: by eye (the redraw), and `docs/02-architecture.md` read by the spec-reviewer.

**Files added while implementing** (each inside a step, none widening it): `src/app/parked/error.tsx` (step 2: the app has no shared error boundary); `test/inbox.test.tsx` (its `@/db/queries` mock gains a not-due `parkedReview`, which `/inbox` now reads); `test/loading-states.test.tsx` (`/parked`'s skeleton joins the route list); `scripts/perf/routes.mjs` and `scripts/perf/budget.json` (`test/perf.test.ts` wants every top-level screen measured: `/parked` at `/books/status`'s budget, its tap from the Library's *Parked* filter, and `docs/02-architecture.md`'s budget table with it); `test/e2e/shard-times.json` (the new spec's time in `w390-light`, its one project, so the committed shard plan stays balanced). `src/lib/parked.ts` also gains `reviewDueOn`, the Inbox row's *due since …*, beside `reviewDue` and sharing its months.

**Re-checked 2026-11-20 at `e591e5d` (owner):** the plan was stale against 2.2l (#305: `PlanBook` and the picker's header gained the book's universe and series; step 1 now carries them) and the *From TASK-127* note, which goes to its own roadmap item (Follow-ups) and changes nothing here.

**Risks**: the `/books` budget test and the Lighthouse budget for `/books` (one more query, a few hundred bytes); e2e fixtures must set `reading_settings` and `parked_on` on the test database only. TASK-100's *Coming out* line is already in the slot: the parked line goes after it, as drawn.

## Review log

_Filled by /implement-task. One line per round._

- Verify R1 FAIL(3) (issue-search.test.tsx: a CSS comment naming --danger; perf.test.ts: /parked not in the route list; e2e-shards.test.ts: the new spec unrecorded) → fixed | Verify R2 PASS (129 files, 2439 tests; parked-review.spec.ts 7/7 in w390-light; mockup-tablet.spec.ts 20/20 in w1280-light) | CI R1 PASS (d08dc40: 10/10 shards, tests, check; Vercel preview deployed)
- Schema R1 APPROVE (one MAJOR outside the diff: the listen-queue undo gap is now reachable from /parked → added to the approved follow-up) | Spec R1 CHANGES (AC-6 UNTESTED: the error state, the skeleton at its loaded size, the line's floor; optional: *due since*) → tests added | Verify R3 PASS (129 files, 2440 tests; parked-review.spec.ts 9/9) | CI R2 PASS (acce607: 10/10 shards)
- Spec R2 APPROVE (findings 1–4 closed; 5 is close-out's) | Schema not re-run (no data-layer file changed since its APPROVE) | Audit R1 PASS (every AC's test fails at e591e5d; restoration OK) | UI R1 PASS (AC-2 partly walked on the dev data: one parked book, no mid-read one; the spec proves the rest; the dev database's last review was left at 20 Nov, its Undo toast expired; the owner chose to leave it) | Close-out check APPROVE (1 placed, 5 not tracked; 5.15 ticked in both docs)

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 3 (R1 FAIL(3): three existing tests pinned lists the new route and spec join; R2, R3 PASS); CI rounds: 2, both PASS
- Review rounds: 2 (spec R1 CHANGES → R2 APPROVE; schema R1 APPROVE; audit R1 PASS; UI R1 PASS)
- First-pass AC FAILs: 0 (AC-6 had three clauses UNTESTED at spec R1, not failing)
- Plan revisions after approval: 1 (step 1's `bookSub` fields, after 2.2l; owner 2026-11-20)
