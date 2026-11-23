---
id: TASK-129
title: 4.6 Decide a waiting Calibre near spelling on the Calibre page
status: Done
depends_on: []
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: 78c28a3
---

# TASK-129 — 4.6 Decide a waiting Calibre near spelling on the Calibre page

## Goal

A near spelling the Calibre sync holds can be settled from the *Calibre* page: one button merges Calibre's book into the Ledger's, another keeps it separate, and the next sync carries out the answer.

## Context

- Roadmap: `docs/05-roadmap.md` § 4.6 (from task 4.4 part 3, TASK-083, PR #270). Its **Check:** is AC-1, verbatim; proposed, and agreed when merged. Listed in `docs/06-tasklist.md` M16 beside 4.4 (added 2026-11-23). A books-cutover gate since 2026-11-23 (D-172): from 1.26 the sync is the only way Calibre's changes reach the Ledger (D-133), and today nothing in the app decides a held book.
- **The write exists.** `decideCalibrePair(calibreId, decision, bookId)` (`src/db/writes.ts`, around line 3246) upserts one `calibre_decisions` row keyed on the Calibre id: `merge` with a live book's id, `separate` with none; false, writing nothing, for a merge into a missing or soft-deleted book. `test/calibre-sync.test.ts` covers it and shows the next sync applying it (rename for a merge, D-87; a new book for separate). No new table (`calibre_decisions` exists, task 4.4).
- **What waits.** `Waiting` in `src/db/calibre-sync.ts` (around line 116): `kind` is `near spelling`, `same title` or `two calibre books`, with `calibreId`, `title`, `author`, `bookId`, `bookTitle`. The page (`src/app/settings/calibre/page.tsx`, the `Waiting` section around line 70) lists the newest run's `report.waiting` and says *A near spelling waits for a merge or separate decision*. The plan says which kinds get the two buttons: `two calibre books` (one Ledger book claimed by two Calibre books) may need a different answer.
- **Derived, never stored on the log.** An entry reads *Merged* or *Kept separate* from `calibre_decisions`, read beside `calibreReports` in `src/db/queries.ts`; the sync log (`calibre_syncs.report`) is never edited.
- **Patterns to copy.** A POST route inside the gate: `src/app/api/follows/route.ts` (`apiUserId`, `unauthorized`, a 400 helper, `export const runtime = "nodejs"`). `src/proxy.ts` gates every `/api/` route except `/api/health`; nothing joins that exception.
- Design: `design/mockups.html` § `calibre` (`design/mockups-index.md`: Settings → Calibre, phone and desktop frames). The frame draws the waiting list with no buttons: the PR redraws it with the two buttons and a decided entry (`ui.redrawFiles`). Neither button is red (D-87: a merge renames, and deciding again undoes it).
- Rules: `.claude/rules/schema.md` § *Calibre is the source of truth for a book's data and its reads*; `.claude/rules/ui.md`. Decisions: D-87, D-89, D-133. UX floor: `docs/04-design.md` § 10. The UX floor.
- *Noted with it (task 4.4 part 3, TASK-083, PR #270):* a created book's new author flag (`newAuthor`) has its own Check in the entry, "when it is done". TASK-083 already shows a created book's author from `createdBookAuthors` (`src/db/queries.ts`); the plan says whether anything of that note is left and, if so, leaves it as a follow-up.

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim): with the test database, a run whose report has one waiting near
spelling and the Ledger book it is near: *Merge* writes one `calibre_decisions`
row, `merge`, with that book's id; *Separate* writes `separate` with none; a
second press changes nothing; the next sync (`POST /api/calibre/sync`) renames
the book or creates a new one to match, and logs it. In the browser the entry
reads *Merged* or *Kept separate* after the press, each button is named for its
book and 44px at 360px, and axe reports no violation.
- [x] AC-2: The route answers 401 without a session, and 400, writing nothing, for an unknown decision, a non-integer Calibre id, a merge with no book id, or a merge into a missing or soft-deleted book.
- [x] AC-3: Given a decided entry, it keeps both buttons, and pressing the other one replaces the decision (one `calibre_decisions` row for that Calibre id, the new value). The sync log row for the run is byte-for-byte unchanged by any press.
- [x] AC-4: The buttons' accessible names are *Merge "<Calibre title>" into <Ledger title>* and *Keep "<Calibre title>" separate*, each a real `<button>`. A failed press shows the page's error treatment (grey, never red) and leaves the entry waiting.
- [x] AC-5: The *Calibre* page's waiting entries meet the UX floor (`docs/04-design.md` § 10. The UX floor): 44px targets on the phone, real controls with names, text contrast 4.5:1 in both themes, focus visible, a pending state while a press is in flight, no horizontal scroll at 360px, and screenshots at each `ui.viewports` width, light and dark.

## Out of scope

- The created book's new-author flag (the entry's *Noted with it* paragraph), unless the plan finds it needs only this page.
- Deciding anything in the sync command, `book_review.csv`, or extract.
- The sync's date comparison (4.4b, TASK-128).
- Any new table or column.

## Files likely touched

- `src/app/api/calibre/decide/route.ts` (new; the plan names it) — the POST around `decideCalibrePair`.
- `src/components/CalibreDecide.tsx` (new; the plan names it) — the two buttons, pending and error states.
- `src/app/settings/calibre/page.tsx` — the waiting entries use it, decided entries read their answer.
- `src/db/queries.ts` — the decisions for the newest run's waiting Calibre ids.
- `src/app/globals.css` — the buttons, from tokens only.
- `test/calibre-sync.test.ts` or a new `test/calibre-decide.test.ts` — AC-1's write and next-sync clauses, AC-2, AC-3.
- `test/e2e/calibre-page.spec.ts` — AC-1's browser clauses, AC-4, AC-5.
- `design/mockups.html`, `design/mockups-index.md` — the `calibre` frame redrawn with the buttons.

## Verification

- Automated: the route and write tests on `TEST_DATABASE_URL` (AC-1, AC-2, AC-3); `test/e2e/calibre-page.spec.ts` with axe (AC-1, AC-4, AC-5).
- Manual: on the dev server, Settings → Calibre with a run holding a near spelling → press *Keep … separate* → expected: the entry reads *Kept separate*, both buttons stay; press *Merge …* → expected: it reads *Merged*. Put the decision back as found afterwards (CLAUDE.md: the dev database is left as found).

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- The created book's `newAuthor` flag (4.6's *Noted with it*) is still undone: TASK-083 shows a created book's author today, but no run records whether it brought a new author. A new phase-4 roadmap item carrying the note's own Check → `docs/05-roadmap.md` § 4.6b (new, Check proposed), with its stub in `docs/06-tasklist.md` M16 (approved at plan)
- The test audit found the AC-2 401 case mocks `apiUserId` (the repo's pattern in every API test: the route's part is `unauthorized()` on a null user; the gate itself is `src/proxy.ts`) → not tracked: accepted as the repo's pattern
- *Two calibre books* gets no buttons: neither answer clears it (an exact title-and-author match ignores *separate*; a *merge* into a claimed book waits again). It is fixed in Calibre by removing or retitling the copy → not tracked: no Ledger decision applies (approved at plan)

## Plan

_Approved 2026-11-23 at 78c28a3._

**Steps**

1. `decideCalibrePair` (`src/db/writes.ts`): the upsert's `onConflictDoUpdate` gets a `setWhere` (decision or book id differs), so a second press of the same answer leaves the row, `decided_at` included, as it was (the Check's "a second press changes nothing").
2. `waitingDecisions()` (`src/db/queries.ts`): `Map<calibreId, "merge" | "separate">` for the newest run's waiting Calibre ids, read from `calibre_syncs.report` in SQL as `createdBookAuthors` does, in the page's one wave. Derived; the log is never written.
3. `POST /api/calibre/decide` (`src/app/api/calibre/decide/route.ts`, the `follows/route.ts` pattern: `apiUserId`, `unauthorized`, a `bad` 400 helper, `runtime = "nodejs"`): `{ calibreId, decision, bookId }`. 401 without a session; 400, writing nothing, for an unknown decision, a calibreId that isn't a positive integer, a merge with no book id, or `decideCalibrePair` false (a missing or soft-deleted book). 200 `{ ok: true, decision }`.
4. `src/components/CalibreDecide.tsx` (client): two real `<button>`s, `.btn.sec` (grey), visible *Merge* and *Keep separate*, completed by `.sr-only` text into *Merge "<Calibre title>" into <Ledger title>* and *Keep "<Calibre title>" separate*. The chosen one `aria-pressed="true"`; a `role="status"` line reads *Merged* or *Kept separate*. In flight: the pressed button `aria-busy`, both `aria-disabled`. A failure: the grey `neutral-error` × line (`role="alert"`), the entry left as it was.
5. `src/app/settings/calibre/page.tsx`: the newest run's *near spelling* and *same title* entries carry `CalibreDecide`, seeded from `waitingDecisions()`; older runs and *two calibre books* stay text.
6. `src/app/globals.css`: the button row from tokens only; 44px under 768px, ≥24px above; wraps at 360px.
7. `design/mockups.html` § `calibre` (phone and desktop): one waiting entry with the two buttons and one decided (*Kept separate*); the note no longer says nothing decides one. `design/mockups-index.md`: the `calibre` row says so.

**Files**

- `src/app/api/calibre/decide/route.ts` (new): the POST.
- `src/components/CalibreDecide.tsx` (new): the buttons, pending and error states.
- `src/app/settings/calibre/page.tsx`: the waiting entries use it.
- `src/db/queries.ts`: `waitingDecisions()`.
- `src/db/writes.ts` (not in *Files likely touched*): the no-op second press.
- `src/app/globals.css`: the buttons.
- `test/calibre-decide.test.ts` (new): AC-1 write and next-sync clauses, AC-2, AC-3.
- `test/e2e/calibre-page.spec.ts`: AC-1 browser clauses, AC-4, AC-5.
- `design/mockups.html`, `design/mockups-index.md`: the frame redrawn (`ui.redrawFiles`).

**Test strategy**

- AC-1 (DB): `test/calibre-decide.test.ts` › *Merge* writes one `merge` row with the book's id; *Separate* writes `separate` with none; a second identical press leaves the row byte-identical (`decided_at` too); the next `POST /api/calibre/sync` renames the book (merge) or creates one (separate) and logs it in `report.in`.
- AC-2: same file › 401 without a session; each 400 case leaves `calibre_decisions` empty.
- AC-3: same file › the other answer replaces the decision (one row, new value); the run's `calibre_syncs.report::text` is identical before and after every press.
- AC-1 (browser), AC-4: `test/e2e/calibre-page.spec.ts` › pressing each button makes the entry read *Merged* / *Kept separate*, both buttons stay with the names above, each `<button>` 44px at 360px, axe clean; a route answering 400 (`page.route`) shows the grey error, nothing `--danger`, the entry still waiting.
- AC-5: same spec › the pending state while the request is held, focus visible, contrast in both themes, no sideways scroll at 360px; the screenshot loop (360, 834, 1280 light and dark) shows the buttons, and a FLOOR test runs in every project (every `ui.viewports` width in CI).
- Manual: the task's Verification step on the dev server, the decision put back as found.

**Risks / open questions**

- Size: 10 files (2 tests, 2 the required redraw); kept whole, approved at plan.
- `same title` merge renames onto the Ledger book under Calibre's author (the sync's own rule, 4.4); nothing new here.

## Review log

_Filled by /implement-task. One line per round._

- Verify R1 FAIL(1: query-budget.test.ts, /settings/calibre 5 queries over 4) → ceiling raised to 5 for the one decisions read → R2 PASS | Touched specs: calibre-page.spec.ts w390-light R1 FAIL(1: a curly vs straight apostrophe in the test) → R2 PASS 20/20 | CI R1 PASS (b0a6d13, every project)
- Schema R1 CHANGES (queries.ts: a merge whose Ledger book was soft-deleted read as Merged; an unguarded `::int` cast; no odd-report tests) → fixed in 912c8c9 → Verify R3 PASS (130 files, 2581 tests; calibre-page.spec.ts 20/20); not re-run: its files were fixed as it asked
- Spec R1 APPROVE (note: the *Merge or keep separate* line showed with only a second-Calibre-book entry → fixed in 912c8c9, with a test)
- Audit R1 CHANGES (AC-2's 401 case mocks `apiUserId`) → accepted as the repo's pattern (every API test mocks it; the gate is `src/proxy.ts`); every other AC PROVEN or DISCRIMINATING, `setWhere` pinned by the second-press test
- UI: not yet run (needs a dev database run holding a waiting near spelling; see the PR)

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 3
- Review rounds: 1 (schema CHANGES fixed; spec APPROVE); audit 1
- First-pass AC FAILs: 0
- Plan revisions after approval: 0 (two additions outside the plan's list, both reported: `test/query-budget.test.ts` and the test file's `.tsx` extension)
