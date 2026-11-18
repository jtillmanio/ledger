---
id: TASK-100
title: 5.7 Books coming out (2 of 2) — the add sheet's Coming out destination and the dashboard line
status: Done
depends_on: [TASK-099]
size: M
model: opus
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: 45ddc3d
---

# TASK-100 — 5.7 Books coming out (2 of 2) — the add sheet's Coming out destination and the dashboard line

## Goal

You can add a book you're waiting for straight to *Coming out*, with its release date or *no date yet*, and the books dashboard tells you how many are out now and coming this month.

## Context

- Roadmap: `docs/05-roadmap.md` § 5.7 Books coming out (M17; D-35). Pulled ahead of 1.26 by 1.25. Feature F-37. Its **Check:** is the contract.
- **Split, 2 of 2.** TASK-099 built the page, *Got it* and the nav item. This part adds the destination and the dashboard line, and **its merge ticks 5.7**.
- **Adding:** 1.4c's add sheet (`src/components/AddBooks.tsx`, *Add to*) gains a *Coming out* destination with a release-date field (a date, or *no date yet*). The book row is created or reused as usual, then the `releases` row (`book_id` primary key, so a book has one release; the plan says what re-adding a book that has one does). `Destination` and `writeDestination` in `src/db/writes.ts` gain the kind; `undoAddBooks` removes the `releases` row the add wrote and the book it created, as it does a shelf's row. A book the add creates gets no `book_status` row, as a shelf add leaves it (else it isn't wanted, TASK-099's rule); **ask at plan time** what *Coming out* does to a reused book that already has a status (it would not be listed).
- **Notify me is in the app, not a push:** the books dashboard's rollup slot (`src/app/books/page.tsx`, `data-slot="rollup"`, *2026 so far*) gains a line, *2 out now · 3 coming this month →*, linking to `/books/releases`, so the five slots keep their order (`.claude/rules/ui.md`). Its counts come from the same query as the page, so they cannot disagree. The line is grey text, never a state colour, and is absent when both counts are zero (the plan confirms against the redrawn frame). The digest email stays 7.6.
- **Not drawn yet:** the `add` frame gains the *Coming out* destination and its date field, and the `bdash` frames the rollup line, in this PR (`ui.redrawFiles`).
- Design: `design/mockups.html` § `add`, § `bdash`; `design/STYLE_GUIDE.md` § 14 (the five slots); `docs/04-design.md` § 10 The UX floor, § 12 The dashboards.
- Decisions: D-35, D-37, D-67.
- *From TASK-099 (5.7, PR #285):* extract loads no undated Coming Out row (`etl/extract.py`, `if not bid or pd.isna(date): continue`), so *No date yet* on `/books/releases` fills only from this task's add sheet (`release_date` NULL). TASK-099's `wantedReleases(userId, today)` in `src/db/queries.ts` is the page's one query (live book, a `releases` row, no `book_status` row; `grp` is `out`, a `YYYY-MM` month or `none`): the dashboard line's two counts should come from it, so they equal the list's.

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim; this part proves the dashboard line's counts equal the list's, on the test database and in the browser (0.11), and the add path that feeds both. TASK-099 proves the list, *Got it* and the screenshots):
a released-yesterday book with no status renders under *Out now*;
one due next month under that month; *Got it* writes one `to_read` row and
removes the row from the list, and Undo restores it; a book already `read`
never appears. The dashboard line's counts equal the list's. Screenshot at
360px, 834px and 1280px.
- [x] AC-2: Given the add sheet, adding a new book by hand to *Coming out* with a date next month writes one `books` row and one `releases` row with that date and no `book_status` row, and the book shows on `/books/releases` under that month; *Undo* removes both rows.
- [x] AC-3: Adding with *no date yet* writes a `releases` row with NULL `release_date`, listed under *No date yet*.
- [x] AC-4: Given two wanted books out now and three due this month (Eastern), the books dashboard's rollup slot shows `2 out now · 3 coming this month →` linking to `/books/releases`; with none of either, the line is absent; the slots keep their order.
- [x] AC-5: The `add` and `bdash` frames in `design/mockups.html` draw the destination with its date field and the rollup line, and `design/mockups-index.md` names them (task 5.7).
- [x] AC-6: The destination and the line meet the UX floor (`docs/04-design.md` § 10): the date field is labelled and keyboard-operable, *no date yet* is a real control with a name, a bad date is refused under the field, the line is a real link with a name; contrast in light and dark; nothing on the dashboard resolves to `--danger`; screenshots at 360px, 834px and 1280px.

## Out of scope

- The page, *Got it* and the nav item (TASK-099).
- Editing a release date after the add (3.5's sheet or 3.1).
- Comic releases (5.8) and the email (7.6).

## Files likely touched

- `src/db/writes.ts` — the *Coming out* destination, its write and undo.
- `src/app/api/books/route.ts`, `src/app/api/books/bulk/route.ts` — the destination and its date in the body.
- `src/components/AddBooks.tsx` — the destination chip and the date field.
- `src/app/books/page.tsx`, `src/db/queries.ts` — the rollup line and its counts.
- `design/mockups.html`, `design/mockups-index.md` — `add` and `bdash` (redraw).
- `test/add-book.test.ts`, `test/books-dashboard.test.ts`, `test/e2e/releases.spec.ts`.

## Verification

- Automated: `test/add-book.test.ts` (AC-2, AC-3 and the undo on `TEST_DATABASE_URL`), `test/books-dashboard.test.ts` (AC-4's counts against the list's query), `test/e2e/releases.spec.ts` (the add to *Coming out*, the line's counts equal the page's, axe).
- Manual: on the dev database, Books → Add → *By hand* → *Coming out*, a date next month → the page lists it under that month, the dashboard line counts it → *Undo* → gone. Leave the data as found.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- Candidate decision: the owner's plan-gate rulings on *Coming out* (Search and By hand only; a book with any status or a release gets nothing; the undo's refusals; the line drops a zero part), approved by the owner at close-out → docs/review/decisions.md § D-162
- `/books` query budget 12 → 13 (the line reads `wantedReleases` in the dashboard's one wave), which `test/query-budget.test.ts` requires to carry its reason → docs/02-architecture.md § Performance budget (fixed in this PR)
- Schema review R1's lost-update race (undo vs *Got it*) and missing Calibre-id guard, and ui-verifier's misplaced refusal at 1024px and up → not tracked: done in this PR (review rounds)
- The bulk add's refusal of `release` passes on the pre-task code too (`parseDestination`'s default refuses an unknown kind): a regression guard, not a discriminating test (test-auditor note) → not tracked: accepted as is; `bulk/route.ts` is untouched by design (Q3)
- ui-verifier saw Space on a focused *No date yet* do nothing twice, then never again in four tries (and the floor spec's keyboard check passes in every CI project) → not tracked: not reproduced

## Plan

Approved 2026-11-17 by the owner, with the four defaults below.

**Owner's answers at the gate:**

1. A reused book that already has a status (any: Someday, Read, Unlisted…) added to *Coming out*: nothing is written (it would never be listed); the toast says *Already in your library · read*.
2. A book that already has a `releases` row: its date is kept, nothing is written; the toast says *already on Coming out*. Editing a date stays 3.5's.
3. *Paste a list* does not offer *Coming out*: Search and By hand only (one book, one date), as the owned formats are Paste's alone. Switching to Paste with it chosen goes back to Someday.
4. The dashboard line drops a zero part (*3 coming this month →*), and is absent when both are zero.

**Steps**

1. `src/db/writes.ts`: `Destination` gains `{ kind: "release"; date: string | null }`. `writeDestination` inserts the `releases` row (`ON CONFLICT DO NOTHING`) for a book with no `book_status` row (Q1, Q2); a created book gets no status. `undoInside` deletes only the row it wrote (`release_date IS NOT DISTINCT FROM` the date), then soft-deletes a created book; it refuses, changing nothing, when a book it placed has a status since (*Got it*), or a created one has a shelf or plan row. `addBooks` (Paste) throws on `release`, as `addBook` does on `owned` (Q3).
2. `src/lib/book-add.ts`, `src/app/api/books/route.ts`: `Target` gains `{ kind: "release" }` (named *Coming out*); `parseDestination(…, { release: true })` accepts `date` as a real calendar `YYYY-MM-DD` or null; POST and DELETE `/api/books` pass it; `/api/books/bulk` still refuses it.
3. `src/components/AddBooks.tsx` + new `src/components/ReleaseDate.tsx`: the *Coming out* chip after *Shelf…* in Search and By hand; under *Add to* a labelled *Release date* `<input type="date">` and a real *No date yet* checkbox, choosing one clears the other; a send with neither is refused under the field (*Pick a release date, or No date yet*) and focus goes there. The reuse toast says why nothing was written.
4. `src/app/books/page.tsx` + new `src/components/ComingOutLine.tsx`: `wantedReleases(userId, day)` joins the one wave (`test/query-budget.test.ts`: `/books` 12 → 13, one wave). *Out now* = `grp === "out"`, *coming this month* = `grp === day.slice(0, 7)`. A grey link in the `rollup` slot after the `<dl>`, the `→` `aria-hidden`; Q4. Styles in `src/app/globals.css`.
5. `design/mockups.html`, `design/mockups-index.md`: `add` gains the chip in its Search frames, a phone frame of By hand with *Coming out* and the date field, and a note; `bdash` the line in its 390, 834 and desktop rollups, and a note.

**Files:** `src/db/writes.ts`, `src/lib/book-add.ts`, `src/app/api/books/route.ts`, `src/components/AddBooks.tsx`, `src/components/ReleaseDate.tsx` (new), `src/app/books/page.tsx`, `src/components/ComingOutLine.tsx` (new), `src/app/globals.css`, `design/mockups.html`, `design/mockups-index.md`; tests below. Not in "Files likely touched": the two new components, `globals.css`, `test/query-budget.test.ts`, `test/add-book-sheet.test.tsx`. `src/app/api/books/bulk/route.ts` stays untouched (Q3). `src/db/queries.ts` is untouched: the line reads `wantedReleases` as it is.

**Test strategy**

- AC-2, AC-3: `test/add-book.test.ts` (TEST database): by hand to *Coming out* next month → one `books`, one `releases` row with that date, no `book_status`, listed by `wantedReleases` under that month; Undo removes both; *No date yet* → NULL, grouped `none`; a reused book with a status or a release writes nothing; Undo refused after *Got it*; `/bulk` and a bad date refused (400).
- AC-4: `test/books-dashboard.test.ts`: 2 out, 3 this month, 1 next month → counts { 2, 3 } equal the list's groups; the rendered line reads `2 out now · 3 coming this month` with `href="/books/releases"`; absent at zero; one zero dropped.
- AC-6 (date field): `test/add-book-sheet.test.tsx`: the field and checkbox are named; an empty date is refused under the field and nothing is sent.
- AC-1, AC-6 (browser): `test/e2e/releases.spec.ts`: by hand to *Coming out* → listed on the page → Undo removes it; the dashboard line's counts equal the page's group counts; axe; screenshots at 360, 834 and 1280, light and dark.
- AC-5: checked in review (the frames and the index rows).

**Risks:** the dashboard's added read (budget 13, one wave). A date input's look differs by browser; the screenshots pin Chromium's.

**Size:** about 9 source files plus tests, no schema; the task is already the split's second half, so no further split.

## Review log

_Filled by /implement-task. One line per round._

- Verify R1 PASS | CI R1 PASS (every project, 025bff1)
- Spec R1 APPROVE (2 minor notes) | Schema R1 CHANGES (MAJOR: undo races Got it; MINOR: no Calibre-id guard) → fixed (38fe7ca)
- Verify R2 PASS | Spec R2 APPROVE | Schema R2 APPROVE | CI R2 PASS
- Audit R1 PASS (every AC test fails on 45ddc3d; tree restored)
- UI R1 PASS, 360–1280, light and dark (note: the refusal sat beside *No date yet* from 1024px) → fixed (9c7dab3), its position pinned by the floor spec at every width (w390, w1280 run locally; every project in CI); not re-walked by ui-verifier
- Verify R3 PASS | CI R3 PASS | Vercel preview pass | Lighthouse skipped (`LIGHTHOUSE_MODE` unset, D-158)
- Owner accepted, 2026-11-17

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 3
- Review rounds: 2 (spec, schema); UI 1 plus a fix
- First-pass AC FAILs: 0 (schema CHANGES on undo safety; one UI layout note at 1024px+)
- Plan revisions after approval: 0 (the review fixes stay inside steps 1 and 3)
