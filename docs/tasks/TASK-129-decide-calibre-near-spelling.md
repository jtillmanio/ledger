---
id: TASK-129
title: 4.6 Decide a waiting Calibre near spelling on the Calibre page
status: Ready
depends_on: []
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
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

- [ ] AC-1 (roadmap **Check:**, verbatim): with the test database, a run whose report has one waiting near
spelling and the Ledger book it is near: *Merge* writes one `calibre_decisions`
row, `merge`, with that book's id; *Separate* writes `separate` with none; a
second press changes nothing; the next sync (`POST /api/calibre/sync`) renames
the book or creates a new one to match, and logs it. In the browser the entry
reads *Merged* or *Kept separate* after the press, each button is named for its
book and 44px at 360px, and axe reports no violation.
- [ ] AC-2: The route answers 401 without a session, and 400, writing nothing, for an unknown decision, a non-integer Calibre id, a merge with no book id, or a merge into a missing or soft-deleted book.
- [ ] AC-3: Given a decided entry, it keeps both buttons, and pressing the other one replaces the decision (one `calibre_decisions` row for that Calibre id, the new value). The sync log row for the run is byte-for-byte unchanged by any press.
- [ ] AC-4: The buttons' accessible names are *Merge "<Calibre title>" into <Ledger title>* and *Keep "<Calibre title>" separate*, each a real `<button>`. A failed press shows the page's error treatment (grey, never red) and leaves the entry waiting.
- [ ] AC-5: The *Calibre* page's waiting entries meet the UX floor (`docs/04-design.md` § 10. The UX floor): 44px targets on the phone, real controls with names, text contrast 4.5:1 in both themes, focus visible, a pending state while a press is in flight, no horizontal scroll at 360px, and screenshots at each `ui.viewports` width, light and dark.

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
