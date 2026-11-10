---
id: TASK-059
title: 1.17b Dates when you start and finish (2 of 2) — the status control asks the dates and lists every read
status: Done
depends_on: [TASK-058]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: c6f1ec4
---

# TASK-059 — 1.17b Dates when you start and finish (2 of 2) — the status control asks the dates and lists every read

## Goal

Setting a book to *Reading* asks when you started, setting it to *Read* asks both dates, and a book read more than once lists every read, each one editable, on the Library row, Now and the status screens.

## Context

- Roadmap: `docs/05-roadmap.md` § 1.17b Dates when you start and finish, and on every read (M9; owner, 2026-11-08, D-131). The entry and its **Check:** are the contract; the Check is marked *proposed; the owner agrees it by merging or edits it first*. **Before 1.26.** Feature F-17.
- **Split, 2 of 2.** TASK-058 builds the writes and the API (re-dating any read, the joint undo, a book's reads). This part is the control. Its merge ticks the roadmap entry, and the tasklist row's Done cell once both are Done.
- **Reading asks the start.** Setting *Reading* or *Listening* writes the status and today's Eastern start at once, as now, and opens the *Started* picker on *Today*: *Today* or Esc keeps it, another day re-dates it. One Undo restores what was there before.
- **Read asks both.** Setting *Read* opens *Started* (the stored start, else *No date*) and *Finished* (*Today*) together; confirming writes both, and a start after the finish is refused with 1.17's reason.
- **Every read.** The date line gains *All reads (n)* when a book has more than one read: each read with its format glyph (1.23: `listenGlyph` in `src/lib/format.ts`, the `Headphones` icon), its *Started* and *Finished*, each editable with 1.5's picker (`src/components/FinishDate.tsx`).
- **Where.** The control is `src/components/BookStatus.tsx`, today drawn only on the Library row (`src/app/books/list/page.tsx`). It comes to the books dashboard's *Now* (`src/components/BooksNow.tsx`) and the status screens (`src/app/books/status/page.tsx`: In flight, whose rows carry 2.2f's **Finished** (`FinishBook`), Up next and Done, drawn with `StatusBookRow`). Not search results (D-131).
- **Not drawn yet.** The status control's frames in `design/mockups.html` (`blist`: the date line and *Started* refusing a start after the finish, task 1.17) gain the two pickers and the read list before they are built, at the plan gate (`ui.redrawFiles`: `design/mockups.html`, `design/mockups-index.md`). Figures in the frames are sample data (D-7).
- Now and the status screens are feel-pass surfaces (`docs/04-design.md` § 10), so their new states are screenshotted at every feel-pass width, light and dark, reduced motion and reduced transparency. The pickers open in the shared sheet or popover and return focus where they came from (R1-11).
- `BookRowMenu.tsx` notes that a row's menu costs no more RSC because `BookStatus` draws it: the plan says how the read list loads (on open, from TASK-058's query) without growing every row's payload.
- Design: `docs/04-design.md` § 11.2 Status screens, § 12. The dashboards → Books dashboard.
- Decisions: D-131, D-40, D-63 (the undo toast stays live above a sheet), D-7.
- *From TASK-058 (1.17b, PR #218):* the API is `src/app/api/progress/book/read/route.ts`. `GET ?bookId=` answers `{ reads }` (`bookReads` in `src/db/queries.ts`: `id, format, started_on, started_on_precision, finished_on, finished_on_precision`, oldest first in the log's order), for *All reads* to load when it opens. `POST { bookId, readId, start?, finish? }` re-dates one read with the picker's choices (a date left out is kept); `readId: null` is the read in progress, start only, while Reading or Listening. It answers 400 with 1.17's reason (start after finish, or a day after today) and `{ redate }` on success; `DELETE { redate }` undoes that re-date alone (409 if re-dated since). **The one Undo:** after *Reading*, keep the status change's `change` for the toast and re-date the start with `readId: null`; don't push a second toast, because the status change's `DELETE /api/progress/book` restores the whole row it found. The latest read keeps `book_status`'s finish in step; `book_status`'s start is never a finished read's (owner, 2026-11-09).

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim): in the
browser (0.11): setting a book to *Reading* opens *Started* on *Today*; picking
an earlier day writes that `started_on`, `exact`, and Undo restores the status
and start before. Setting it to *Read* opens both; confirming writes one
`read_events` row carrying both dates; a start after the finish is refused and
writes nothing. A book with two reads lists both under *All reads (2)*;
re-dating the first changes only its `read_events` row, and re-dating the
second changes it and `book_status`. The same control works from *Now* on
`/books` and from `/books/status`; a search result has none. axe passes at
every width.
- [x] AC-2: Given a `to_read` book on the Library row, choosing *Reading* saves at once and opens *Started* with *Today* selected; pressing Esc, or choosing *Today*, closes it with today's start kept; the toast's single Undo puts the book back at `to_read` with no start.
- [x] AC-3: Choosing *Read* opens *Started* (showing the stored start, else *No date*) and *Finished* (on *Today*) together; with a start after the finish, 1.17's reason shows under *Started*, the confirm is `aria-disabled` with that reason, and no request is sent.
- [x] AC-4: A book with one read shows no *All reads* line; a book with two reads shows *All reads (2)*, each read with its *Started* and *Finished* and, for a listen, the headphones glyph named *Listened*; each date opens 1.5's picker.
- [x] AC-5: The control appears on *Now* on `/books` and on the rows of each `/books/status` tab, and an Add books search result row has none.
- [x] AC-6: The control, its pickers and the read list meet the UX floor (`docs/04-design.md` § 10. The UX floor), on feel-pass surfaces: every control a real button with a name, nothing interactive under 24px and the pickers' options 44px on the phone, focus returns to the control that opened a picker, text 4.5:1 in both themes, nothing resolves to `--danger` but the refusal, axe reports no new violations, no horizontal scroll at 360px, and screenshots at 360, 390, 412, 768, 1024 and 1280px, light and dark, with reduced motion and reduced transparency.

## Out of scope

- The writes and the API (TASK-058).
- Search results (D-131).
- Deleting a read; editing a rating or a note from the read list.
- 2.1b's reading sessions.

## Files likely touched

- `src/components/BookStatus.tsx` — asks the dates; the *All reads* line.
- `src/components/FinishDate.tsx` — opened on *Today*, two at once.
- `src/components/AllReads.tsx` (new; the plan's name) — the read list.
- `src/components/BooksNow.tsx` — the control on Now.
- `src/components/StatusBookRow.tsx` and `src/app/books/status/page.tsx` — the control on the status tabs.
- `src/app/books/list/page.tsx` — the Library row, if its props change.
- `src/app/globals.css` — the read list, from tokens only.
- `design/mockups.html`, `design/mockups-index.md` — `blist` gains the pickers and the read list (drawn first).
- `test/e2e/start-dates.spec.ts`, `test/e2e/status.spec.ts`, `test/e2e/books-dashboard.spec.ts`, `test/reading-log.test.tsx`.

## Verification

- Automated: `test/e2e/start-dates.spec.ts` (AC-1's browser clauses, AC-2, AC-3, AC-4, axe at every width); `test/e2e/status.spec.ts` and `test/e2e/books-dashboard.spec.ts` (AC-5, the feel-pass screenshots); `test/reading-log.test.tsx` (the read list's markup).
- Manual: `npm run dev`. On the Library, set a To-read book to *Reading* → *Started* opens on *Today*; pick yesterday → the row reads *Started* yesterday; Undo → back to To read. Find a book read twice → *All reads (2)*; re-date the first → only it changes. Do the same from Now and from In flight. Put everything back, as found.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- The UI verifier's walk on the development database saved *A Court of Wings and Ruin* as Read by accident (a forced click in its script; not reproduced with a normal Cancel). It was undone, but a series follow it had set was put back to `tracking` by guess → docs/OWNER-CHECKLIST.md § Actions from follow-ups
- The control's client code took `/books` to 175,918 bytes of JS and `/books/list` to 171,581 bytes and 65 requests, over budgets of 175,000, 170,000 and 64; a lazy read list saved under 250 bytes. The owner chose, 2026-11-10, to raise the three budgets (177,000, 173,000, 65; `scripts/perf/budget.json`, `docs/02-architecture.md` § Performance budget) and to add a task to bring them back → docs/05-roadmap.md § 1.30 (new; its Check is a proposal)
- Skeleton.tsx and `.sk-now-status`: Now's loading skeleton gains the control's row so it keeps the loaded height (`books-dashboard.spec.ts` "the loading state is the loaded geometry"); `useBookWrite`'s optional `refresh` argument holds the page refresh back while *Started* is offered after *Reading*, so the row (Up next, a filtered Library) is still there to answer it → not tracked: done in this PR (plan revisions, written into ## Plan)
- Once, on a To-read filtered Library, focus fell to the body after saving a changed date because the row had left the filter; not seen in the browser suite → not tracked: seen once by the UI verifier, not reproduced; the row's own refresh moved it (R1-11 is the rule to read if it recurs)
- A held start is kept across To read, so a later *Reading* opens *Started* on that day rather than *Today* → not tracked: 1.17's documented held-start rule, working as designed
- The manual step says the row reads *Started yesterday*; it reads the date (*Started 9 November 2026*) → not tracked: wording of the manual step only, the date is the control's
- One `CONNECTION_CLOSED` from the Neon pooler during the verifier's first load of Now → not tracked: a dropped development-database connection, not this task's code
- Development data has no book read twice and an empty Up next, so *All reads* and a quarter row were not walked there → not tracked: both are covered by the test-database specs (`start-dates.spec.ts`, `status.spec.ts`)

## Plan

Approved by the owner 2026-11-10. **Revisions after approval (2):** (1) `src/components/Skeleton.tsx` and `.sk-now-status` in `globals.css`: the control adds a row to Now, and the loading skeleton must hold the loaded height (ui.md; `books-dashboard.spec.ts` checks it within 2px). (2) `useBookWrite` takes an optional `refresh` (default true) so the page refresh waits while *Started* is offered after *Reading*: on Up next and a filtered Library, *Reading* takes the row off the tab, and the picker would vanish before it was answered; `BookStatus` refreshes when the picker closes. Also written: `StatusBookRow`'s `.row-text` is a `div`, not a `span`, because the control nests block content. **Decisions at the gate:**

- **Kept whole**, though it is past the size check (about 11 source files, two
  more than "Files likely touched": `src/db/queries.ts` and
  `src/components/PlanQuarter.tsx`). Autonomy stays attended.
- **The pickers stay inline** in the expanded control, as `blist` draws them and
  as 1.17's control works. They are not in the shared `Sheet`, because the mockup
  outranks Context's "shared sheet or popover". Focus returns to the opener on
  Save, Cancel and Esc, as it does now.
- ***Read* on a book already Read** opens both pickers on the latest read's
  stored start and finish: a correction, as 1.5 and 1.17 do now. *Finished on
  Today* is for a book entering Read.

**Steps**

1. **Draw first.** `design/mockups.html` `blist` gains three phone frames,
   inline in the expanded row:
   - (a) *Reading* just set, *Started* open on *Today*, with the toast.
   - (b) *Read* with *Started* and *Finished* open together, Save
     `aria-disabled` and 1.17's reason under *Started*.
   - (c) *All reads (2)* open, a listen carrying the headphones glyph, and one
     read's date picker open.

   A notes bullet (1.17b, D-131) also says where the control sits on Now and on
   the status rows. `design/mockups-index.md`'s `blist` line follows.
2. **`src/components/useBookWrite.ts`** gains `useRedate()`: `POST
   /api/progress/book/read` (`{ bookId, readId, start?, finish? }`), answering
   `{ refused }` on a 400 as `useBookWrite` does, then a page refresh and a toast
   whose Undo is `DELETE { redate }`. With `silent`, no toast is pushed: used for
   the start re-dated just after *Reading*, whose one Undo is the status change's
   (TASK-058's note in Context).
3. **`src/components/BookStatus.tsx`**:
   - **Reading.** *Reading* or *Listening*, entered from any other status, saves
     at once (as now), then opens *Started* on the start the server stored. That
     is `written.start`: *Today*, unless a start was already held (1.17's rule).
     Switching between Reading and Listening opens nothing, since the start is
     kept. Save on an unchanged value, Cancel or Esc closes the picker and the
     start is kept. Another day is a silent `useRedate` with `readId: null`. An
     Undo while the picker is open closes it.
   - **Read.** *Read* opens *Started* and *Finished* together with one Save and
     one Cancel. *Started* opens on the stored start, else *No date*; *Finished*
     opens on *Today*, or on a Read book on the stored dates (see the gate
     decisions). Save is one `write("read", { finish, start? })`. The start is
     sent only when it was changed, so a held approximate start is never
     rewritten as `exact`. A start after the finish puts 1.17's reason under
     *Started*, makes Save `aria-disabled` with `aria-describedby`, and sends no
     request.
   - **New optional props.** `title`: Now and the status rows have no
     `.book-row` to read the title from. `menu`: the `⋯` (`BookRowMenu`) is drawn
     on the Library row only, which is the default.
4. **`src/components/AllReads.tsx`** (new):
   - **Loading.** The reads load from `GET /api/progress/book/read?bookId=` when
     the row's control opens (never in the RSC payload), and again after any
     save or undo in the control.
   - **The list.** With more than one read, the date line gains a disclosure
     button, *All reads (n)*, with `aria-expanded`. Its list holds each read,
     oldest first: the headphones glyph named *Listened* for an `audio` read, and
     *Started …* and *Finished …* buttons named with their dates.
   - **Editing.** Each date opens 1.5's `FinishDate` inline with Save and Cancel.
     A start after the finish shows 1.17's reason the same way. Save calls
     `useRedate` with the read's id; Save, Cancel and Esc return focus to the
     button that opened the picker.
   - **States.** While loading, nothing is drawn. A failed load shows a neutral
     line with a grey `×`, never `--danger`.
5. **The surfaces.**
   - `src/components/BooksNow.tsx`: Now draws `<BookStatus>` in its body
     (status, start, `listened`, `title`, no menu).
   - `src/components/StatusBookRow.tsx` gains an optional `control` slot under
     the sub-line, filled by `src/app/books/status/page.tsx`: In flight (beside
     2.2f's *Finished*), the year lane, On deck, Done (with its dates) and
     Stopped.
   - Up next's quarters are drawn by `PlanQuarter.tsx`, not `StatusBookRow`, so
     its `renderBody` gets the control too. Its drag starts only from the handle.
   - `src/db/queries.ts`: `booksInFlight` adds `started_on` and its precision;
     `booksInHand` adds `listened`. These are SELECT columns only: no schema
     change and no stored value.
   - The Add books search results draw nothing new.
6. **`src/app/globals.css`**: the read list, and the control's place on Now and
   on the status rows, from tokens only. Pickers' options are 44px on the phone;
   nothing resolves to `--danger` but the refusal.

**Stored dates**: unchanged. Every write goes through TASK-058's route or
`saveBookStatus` as they stand, and an unchanged start is never re-sent.

**Files**:

- `design/mockups.html`, `design/mockups-index.md`
- `src/components/useBookWrite.ts`, `src/components/BookStatus.tsx`,
  `src/components/AllReads.tsx` (new)
- `src/components/BooksNow.tsx`, `src/components/StatusBookRow.tsx`,
  `src/components/PlanQuarter.tsx` (not in "Files likely touched"),
  `src/app/books/status/page.tsx`
- `src/db/queries.ts` (not in "Files likely touched"), `src/app/globals.css`
- `src/components/FinishDate.tsx`: only if a picker needs an id hook
- Tests: `test/e2e/start-dates.spec.ts`, `test/reading-log.test.tsx`,
  `test/e2e/status.spec.ts`, `test/e2e/books-dashboard.spec.ts`

**Test strategy**

- AC-1 (browser clauses), in `test/e2e/start-dates.spec.ts`, describe "1.17b":
  - "Reading opens Started on Today; an earlier day writes started_on exact; Undo restores to_read and no start"
  - "Read opens both; Save writes one read_events row with both dates"
  - "a start after the finish is refused and writes nothing"
  - "All reads (2): re-dating the first changes only its row; the second changes it and book_status"
  - Axe at every width (the spec runs in every project).

  Now and `/books/status` are covered by AC-5's tests below.
- AC-2, in `start-dates.spec.ts`: "Esc, or Save on Today, keeps today's start;
  one Undo puts to_read back". Also in `test/reading-log.test.tsx`: "after
  Reading, Started opens on Today and Esc keeps it".
- AC-3, in `test/reading-log.test.tsx`: "Read opens Started (stored, else No
  date) and Finished (Today)", and "a start after the finish: the reason under
  Started, Save aria-disabled, no fetch" (`fetch` mocked and counted). The
  browser test counts the requests too.
- AC-4, in `test/reading-log.test.tsx`: "one read, no All reads"; "two reads:
  All reads (2), each with Started and Finished, a listen named Listened"; "each
  date opens the picker". In `start-dates.spec.ts`: the re-date clauses above.
- AC-5:
  - `test/e2e/books-dashboard.spec.ts`: "Now carries the status control and it
    saves"
  - `test/e2e/status.spec.ts`: "each tab's rows carry the control", including a
    quarter row
  - An Add books search result row has none.
- AC-6, in the same three specs:
  - Every control is a button with a name.
  - Target sizes, and 44px options at 360px.
  - Focus returns to the opener.
  - Text contrast, in both themes.
  - Nothing `--danger` but the refusal.
  - Axe.
  - No horizontal scroll at 360px.
  - Feel-pass screenshots of Now and the status tabs with the control open, at
    360, 390, 412, 768, 1024 and 1280px, light and dark, with reduced motion
    and with reduced transparency.

**Risks**

- **Concurrent writes.** The silent re-date after *Reading* races the toast's
  Undo. The Undo is the status change's `DELETE`, which puts back the whole row,
  so a re-date that lands first is undone with it. A re-date that lands after the
  Undo answers 400 (`RefusedStatus`), which the control ignores once it has
  closed.
- **A workbook read.** A book whose one read lives only in `book_status` lists
  no reads, so *All reads* doesn't show (TASK-058's note).
- **Layout.** On Now the control adds height to a feel-pass hero. The frames
  are drawn first, and the screenshots check it.

## Review log

Verify R1 e2e (4 specs) FAIL(15: 44px measured on the input, a click on an aria-disabled Save, Now's skeleton 36px short) → R2 264 pass → R3 status + dashboard specs 199 pass with the reduced-transparency passes | vitest `test/reading-log.test.tsx` 42 pass | `npx tsc --noEmit` and `npm run lint` clean on the rebased head. The full chain (`npm run test:all`) and `test:no-e2e` were **not** run: the owner said not to re-run the full chain after a rebase that only brought in a CI change (#220), and it had not been run before the rebase either. CI's `check` and the e2e:full run are the gate for the rest.
Audit R1 PASS (no UNPROVEN; AC-5/AC-6 browser clauses judged by static review) | Spec R1 CHANGES (AC-6 reduced transparency UNTESTED) → R2 APPROVE | Schema R1 APPROVE | UI R1 CHANGES REQUIRED as reported (no failure in the task's code; AC-4 two reads and the Up next quarter row untestable on dev data, covered by the specs; AC-6 dark theme, reduced motion and axe not done by the verifier, covered by the specs at every width; a data accident on the development database, see Follow-ups). Not re-run: nothing under src/ changed after it.

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 3 browser rounds (the full chain was not run, at the owner's instruction)
- Review rounds: 2 (spec-reviewer), 1 each (test-auditor, schema-reviewer, ui-verifier)
- First-pass AC FAILs: 0 failing; AC-6 UNTESTED once (reduced transparency), fixed in round 2
- Plan revisions after approval: 2 (the skeleton row; the held-back refresh)
