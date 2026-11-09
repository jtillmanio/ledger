---
id: TASK-059
title: 1.17b Dates when you start and finish (2 of 2) — the status control asks the dates and lists every read
status: Ready
depends_on: [TASK-058]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
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

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): in the
browser (0.11): setting a book to *Reading* opens *Started* on *Today*; picking
an earlier day writes that `started_on`, `exact`, and Undo restores the status
and start before. Setting it to *Read* opens both; confirming writes one
`read_events` row carrying both dates; a start after the finish is refused and
writes nothing. A book with two reads lists both under *All reads (2)*;
re-dating the first changes only its `read_events` row, and re-dating the
second changes it and `book_status`. The same control works from *Now* on
`/books` and from `/books/status`; a search result has none. axe passes at
every width.
- [ ] AC-2: Given a `to_read` book on the Library row, choosing *Reading* saves at once and opens *Started* with *Today* selected; pressing Esc, or choosing *Today*, closes it with today's start kept; the toast's single Undo puts the book back at `to_read` with no start.
- [ ] AC-3: Choosing *Read* opens *Started* (showing the stored start, else *No date*) and *Finished* (on *Today*) together; with a start after the finish, 1.17's reason shows under *Started*, the confirm is `aria-disabled` with that reason, and no request is sent.
- [ ] AC-4: A book with one read shows no *All reads* line; a book with two reads shows *All reads (2)*, each read with its *Started* and *Finished* and, for a listen, the headphones glyph named *Listened*; each date opens 1.5's picker.
- [ ] AC-5: The control appears on *Now* on `/books` and on the rows of each `/books/status` tab, and an Add books search result row has none.
- [ ] AC-6: The control, its pickers and the read list meet the UX floor (`docs/04-design.md` § 10. The UX floor), on feel-pass surfaces: every control a real button with a name, nothing interactive under 24px and the pickers' options 44px on the phone, focus returns to the control that opened a picker, text 4.5:1 in both themes, nothing resolves to `--danger` but the refusal, axe reports no new violations, no horizontal scroll at 360px, and screenshots at 360, 390, 412, 768, 1024 and 1280px, light and dark, with reduced motion and reduced transparency.

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
