---
id: TASK-055
title: 2.2h Finishing a book follows it
status: Ready
depends_on: [TASK-048]
size: L
model: opus
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-055 — 2.2h Finishing a book follows it

## Goal

Finishing a book follows its series, subseries and universe for you, the toast says so, and you can opt out of any of them for good. Something you've set aside while part-way through reads as *On hold*.

## Context

- Roadmap: `docs/05-roadmap.md` § 2.2h Finishing a book follows it (M10, after 2.2f and before 2.2, so `follow_next` has followed subseries to read; owner intake 2026-11-05, D-117, D-118; **amends D-108 and 2.2c**). The roadmap entry and its **Check:** are the contract; its Check was proposed at the intake and agreed by the owner on 2026-11-06, when these task files were written. Features: F-68. "In the browser (0.11)" is the Playwright harness, `test/e2e/` (TASK-013). Depends on 2.2c (TASK-048). Not one of the entries 1.25 pulls ahead of cutover.
- **Why this is one large task** (`workflow.splitPolicy: never-split`): a new table, a CHECK change, a view, the finish's transaction and its undo, the follow route, the toast, the sheet's control and the mockup redraw land together, schema and UI at once.
- **Stop and ask at the plan gate** (the entry; CLAUDE.md, a schema change):
  1. *A Tracking follow is raised.* Proposed: finishing a book of something at `tracking` sets it to `reading`, because you've just read it. Otherwise the series loaded from the sheet, all `tracking` (1.15), never follow themselves.
  2. *Opting out sticks.* 2.2c's *Not following* deletes the row, so the next finish would follow it again. Proposed: on `series_follows`, `subseries_follows` and `universe_follows`, *Not following* keeps the row at a new `state` value, `off`, which every reader treats as no follow. Author and shelf follows, never automatic, keep deleting theirs. A CHECK change on two tables and a change to 2.2c's write; the plan says whether it ships a `drizzle/down/` file (it drops and retypes nothing).
  3. *Subseries are followable.* Proposed: `subseries_follows(subseries_id, state)`, as `shelf_follows`, no `user_id` (D-91), added to `src/db/export-tables.ts` (Hard rule 7), and a `subseries_progress` view (books listed and read per subseries, live books only, with `follow_state`). `docs/03-data-model.md` § 4 holds the row.
- **Two more for the plan gate, which the entry doesn't settle.**
  - *To read → Read.* The entry limits a finish to one from *Reading* or *Listening*, D-117 says only *a finish*, and the Library's *Read* from *To read*, how a past read gets logged, appends a read as well. As written it follows nothing; the plan confirms that, and says whether that toast keeps 2.2c's series and universe chips, since nothing else would offer them.
  - *What "unread" means.* 2.2c's `unread` is `books_listed − books_read`, so a book you DNF'd counts as one left, while 2.2d's `follow_next` skips it. A series whose only book left is a DNF would be followed with no next book.
- **Where it goes.** `saveBookStatus` (`src/db/writes.ts`) is the only writer, and the route is its only caller outside tests, so a finish it sees from `reading` or `listening` is an app finish; an extract and a load never call it. The follows join its transaction, and `BookStatusChange` gains the state each one had, so `undoBookStatus` restores them with the finish. `FOLLOW_KINDS` gains `subseries`, and `followRow`, `followable` and `bookGroupings` gain it too.
- **`off` reaches every reader.** `series_progress` and `universe_progress` give `follow_state` NULL for it, as `subseries_progress` does from the start, so `bookGroupings`, `finishOffer` and TASK-050's `follow_next` need no case of their own. An undo has to tell two states apart: `prior` `null` is no row, `off` is a row. `POST /api/follows`, `postFollow`, `followEntry`'s *was …* and the radiogroup all change. `FOLLOW_STATES` stays what a person can choose.
- **This changes more of 2.2c's Check than the entry says.** Its last line replaces the part where a finish only offers the series and the universe. *Not following deletes it* also stops being true for a series and a universe, so `test/follows.test.ts`' cases for those move to `off`. Author and shelf cases stand.
- **The toast.** *Now reading Mistborn · Cosmere*, one chip each, and a chip turns that one to *Not following* with its own undo. *Keep going?* keeps the author and shelf chips. The finish's Undo undoes the finish and restores each follow it changed. *Done with Mistborn* on a last unread book is unchanged (D-43). There is one toast at a time, so taking any chip commits the finish, as today (`src/components/Undo.tsx`), and keyboard reach is F6, D-116. `finishOffer` stops offering series and universes: anything it would now offer is already followed, or `off`, which stays off.
- **On hold is a label, not a state** (D-118). The control's middle choice still stores `tracking`, and reads *On hold* with at least one read and at least one unread, *Tracking* otherwise. It is derived at display, for every kind (Hard rule 2). 5.12 lists it later.
- **By hand still works.** The *Follow…* sheet (`src/components/FollowSheet.tsx`) stays for every level and gains the subseries, with its control and `read / total`.
- **2.2f** (TASK-054) lands first and reuses the Library's finish, so its toast gets all of this; test it from there too.
- **Not drawn yet.** The mockup's `follow` and `finishoffer` frames change at phone, tablet and desktop widths before they are built: the plan draws them first and the owner sees them at the plan gate (standing rule 6, `ui.redrawFiles`).
- Rules: read `.claude/rules/schema.md` when planning. Decisions: D-117, D-118, D-108, D-43, D-91, D-90 (subseries), D-116, D-63. Data model § 4.1, 2.5e. Roadmap 5.12 and 2.2d's *From the 2026-11-05 intake* note read what this builds.
- *From TASK-054 (2.2f, PR #203):* the finish toast's copy (`NAMES`, the label and the *Finished <date>* detail) now lives in `useBookWrite` (`src/components/useBookWrite.ts`), one place for the Library's finish and In flight's **Finished**; change it there.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): `npm test`: finishing book 2 of 4 of an unfollowed series, in a
subseries and a universe with books left, writes `reading` for all three and no
author or shelf follow; the finish's Undo restores the book and leaves no follow
row; finishing book 4 of 4 writes no series follow; a series at `tracking` is
raised to `reading`, and Undo restores `tracking`; a series set to *Not
following* stays out at the next finish; a chip turns one follow off and leaves
the others; a DNF writes no follow; a read loaded through the ETL writes no
follow. The subseries control writes a row at each state, and the export test
passes with `subseries_follows`. `subseries_progress` counts read and listed
books and skips a soft-deleted book. The control reads *On hold* at 1 of 4 read
and *Tracking* at 0 of 4 and 4 of 4, with the same stored value. In the browser
(0.11), the toast's chips are reachable by keyboard and axe passes. Screenshots
at 360px and 1280px. This replaces the part of 2.2c's Check where a finish only
offers the series and the universe.
- [ ] AC-2: The same finish from *Listening* writes the same follows. A finish where the subseries or the universe has no unread live book left writes none for that level and still writes the others. A re-date of a book already read and a status change to *Reading* write no follow. A finish in one transaction: when the follow write fails, the book stays as it was and no `read_events` row exists.
- [ ] AC-3: After a finish that follows a series and a universe, the toast reads *Now reading <series> · <universe>* with one chip each, and *Keep going?* lists the author and shelves only. A chip sets that one `off` and leaves the other; its Undo restores `reading`. The finish's Undo, taken instead, restores every follow to its earlier state. A finish that follows nothing has no *Now reading* line. On a book with no live book left in a *Reading* series, *Done with <series>* still shows and still writes `tracking`.
- [ ] AC-4: `off` is no follow: `series_progress.follow_state`, `universe_progress.follow_state` and `subseries_progress.follow_state` are NULL at `off`, the sheet shows *Not following*, and a later finish leaves it `off` and offers no chip for it. Undoing a first *Not following* on an unfollowed series leaves no row. *Not following* on an author or a shelf still deletes the row. `POST /api/follows` refuses an unknown subseries, or one with no live book, with 400 and writes nothing; `off` isn't accepted for an author or a shelf.
- [ ] AC-5: The *Follow…* sheet lists a book's subseries with its radiogroup and a `read / total` equal to `subseries_progress`; a book with no subseries lists none. For every kind, the middle option reads *On hold* with at least one read and one unread and *Tracking* otherwise, with `tracking` stored both ways.
- [ ] AC-6: The toast and the sheet meet the UX floor (`docs/04-design.md` § 10. The UX floor): each chip and option has an accessible name; chips are 44px in the toast's row and options at least 24px; the *Now reading* line is 4.5:1 in both themes and the toast still fits at 360px with a long series name and four chips; nothing is red; axe reports no new violations; screenshots at every `ui.viewports` width, light and dark.

## Out of scope

- Following at the start of a book, backfilling past reads, or following from an extract, a load or 4.4's sync (D-117).
- Automatic author or shelf follows.
- A fourth stored *on hold* state (D-118), and 5.12's page.
- 2.2d's `follow_next` (TASK-050) and 2.2g's meters (TASK-056).
- Dropping `user_id` from the follow tables (6.18).

## Files likely touched

- `src/db/schema.ts` — `subseries_follows`, the two CHECKs; `drizzle/<tag>.sql` and `drizzle/meta/*` from `npm run db:generate`.
- `src/db/export-tables.ts` — `subseries_follows`.
- `etl/views.sql`, `etl/test_views.sql` — `subseries_progress`; `off` reads as NULL.
- `src/db/writes.ts`, `src/db/queries.ts` — the finish's follows and their undo, `off`, subseries in `followRow`, `followable`, `bookGroupings`, `finishOffer`.
- `src/app/api/progress/book/route.ts`, `src/app/api/follows/route.ts` — what's answered, `off`, subseries.
- `src/lib/follow-offer.ts`, `src/components/Undo.tsx`, `src/components/ToastOffer.tsx`, `src/components/BookStatus.tsx`, `src/components/FollowSheet.tsx` — the toast's line and chips, *On hold*.
- `design/mockups.html`, `design/mockups-index.md` — `follow`, `finishoffer` (drawn first).
- `docs/03-data-model.md` — § 3 and § 4, what is now built.
- `test/follows.test.ts`, `test/export-tables.test.ts`, `test/e2e/follows.spec.ts`.

## Verification

- Automated: `test/follows.test.ts` (AC-1's `npm test` half, AC-2, AC-4's writes and route); `etl/test_views.sql` via `npm run test:views` (`subseries_progress`, `off` as NULL); `test/export-tables.test.ts`; `test/e2e/follows.spec.ts` (AC-1's browser half, AC-3's toast, AC-5's sheet, AC-6). The migration runs up on the TEST database; a down file, if the plan ships one, gets the up → down → up test.
- Manual: `npm run dev`. From the Books screen tap *Status* → *In flight*, and **Finished** on a book in a series with books left → the toast says *Now reading …*. Tap the series' chip, then Undo → it reads *Reading* again. Tap *Library*, find the book, then ⋯ → *Follow…* → the series is at *Reading* and the subseries is listed. Set each follow back as it was and return the book to *Reading* from its row, so the dev database is left as found.

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
