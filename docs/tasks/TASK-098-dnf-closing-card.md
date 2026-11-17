---
id: TASK-098
title: 5.5 DNF with a reason — the closing card for a book
status: In progress
depends_on: []
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: 5b160fd
---

# TASK-098 — 5.5 DNF with a reason — the closing card for a book

## Goal

When you stop a book, a small closing card asks why. You can type a reason or skip it, the reason shows with the book on Done, and Undo takes back both.

## Context

- Roadmap: `docs/05-roadmap.md` § 5.5 DNF with a reason field (M17). Pulled ahead of 1.26 by the owner, without 5.4 (D-139): 5.5 builds the closing card for a book, and 5.4 reuses it later for a run's rating and note. UX-N13 (the finish moment). Feature F-31. Its **Check:** was agreed with the owner at conversion (2026-11-15) and written into the entry.
- **The reason is the book's note** (owner, 2026-11-15): `book_status.notes`, written through 3.4's note write (`saveBookNote`/`undoBookNote` in `src/db/writes.ts`, `POST`/`DELETE /api/progress/book/note`). No new column, no migration. A book that already has a note shows it in the field, so the reason edits the note rather than replacing it unseen. 3.5's sheet (TASK-079) shows the same note.
- **The card.** DNF on the status control (`src/components/BookStatus.tsx`, where DNF is a grey stop saved at once) and anywhere else that sets DNF through `useBookWrite` (`src/components/useBookWrite.ts`) opens the closing card after the status saves: a one-line reason field and *Skip* (grey, `.claude/rules/ui.md`). 5.4 gives the same card a rating for a run, so the plan builds it as one component (`src/components/ClosingCard.tsx`; the name is the plan's) with the book's reason as its first use. DNF stays grey: nothing on the card or the row is `--ready` (that colour means read) or `--danger` (destructive actions only). No celebration.
- **Undo.** The DNF's toast *Undo* restores the prior status (`undoBookStatus`) **and** the prior note, if the card wrote one. The plan says how the two writes share one Undo (the note's change travels with the status's undo entry, or the card's save replaces the toast's entry). *Skip* writes no note.
- **Done's Stopped row.** Done folds DNF books under *Stopped* (`booksDone` in `src/db/queries.ts`, `src/components/StatusBookRow.tsx`, `src/app/books/status/page.tsx`). The row shows the reason under its title in grey, and draws no empty line when there is none.
- **Not drawn yet:** no frame draws the closing card. This PR draws it at phone and desktop in `blist` (the status control's DNF) and the *Stopped* row's reason in `status`, and `design/mockups-index.md` names them (`ui.redrawFiles`).
- Design: `design/mockups.html` § `blist`, § `status`; `design/STYLE_GUIDE.md` § 14–§ 16 (completion and the finish moment, no confetti); `docs/04-design.md` § 10 The UX floor.
- Decisions: D-40 (no celebration), D-139; UX-N13; R1-07.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim):
setting a book to DNF opens the closing card with a reason field
and *Skip*; a typed reason saves, survives a reload and shows under the
book's *Stopped* row on Done; *Skip* leaves the DNF with no reason; Undo of
the DNF restores the prior status and the prior reason; nothing on the card
or the row resolves to `--ready` or `--danger`.
- [ ] AC-2: Given a reading book with no note, choosing DNF saves `dnf` at once and opens the card with its field focused; typing *Lost interest at the midpoint* and saving stores that text in `book_status.notes`, and Done's *Stopped* row shows it under the title after a reload.
- [ ] AC-3: Given a book whose note reads *Gift from Sam*, choosing DNF opens the card with that text in the field; *Skip* leaves the note *Gift from Sam* and the status `dnf`.
- [ ] AC-4: Given a reading book with no note, DNF then a typed reason then the toast's *Undo* leaves the book `reading` with its start date and a NULL note; a failed note save says so with *Retry* and leaves the DNF (R1-07).
- [ ] AC-5: `design/mockups.html` draws the closing card in `blist` and the reason on a *Stopped* row in `status`, and `design/mockups-index.md` names them (task 5.5).
- [ ] AC-6: The card meets the UX floor (`docs/04-design.md` § 10): the field has a visible label, *Save* and *Skip* are real buttons ≥ 24px (44px on a phone), Escape closes it as *Skip* and focus returns to the status control, the text meets contrast in light and dark, the card respects reduced motion, and there are screenshots at 360px and 1280px.

## Out of scope

- A run's rating and note on the same card (5.4).
- A book's rating at the finish (3.4 owns it; 3.4b's ranking is separate).
- A new `dnf_reason` column (owner: the note is the reason).
- Showing the note anywhere but Done's *Stopped* row (3.5's sheet, TASK-079).

## Files likely touched

- `src/components/ClosingCard.tsx` (new) — the card.
- `src/components/BookStatus.tsx`, `src/components/useBookWrite.ts` — DNF opens it; the shared Undo.
- `src/db/queries.ts` — `booksDone` returns the note for DNF rows.
- `src/components/StatusBookRow.tsx` — the reason under a *Stopped* row.
- `design/mockups.html`, `design/mockups-index.md` — `blist` and `status` (redraw).
- `test/status.test.ts`, `test/e2e/dnf-reason.spec.ts` (new).

## Verification

- Automated: `test/status.test.ts` (`booksDone` carries the note; no empty line without one), `test/e2e/dnf-reason.spec.ts` (AC-1 to AC-4, the colour sweep, axe; screenshots at 360 and 1280).
- Manual: on the dev database, Library → a reading book → DNF → type a reason → Status → Done → *Stopped* shows it; *Undo* from the toast → the book is reading again with no note. Leave the data as found.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

## Plan

Approved 2026-11-17 (owner: kept whole, not split, though it is over 8 files: the roadmap Check is one contract).

**The shared Undo.** One toast at a time, so the card's save can't push a second entry without committing the DNF's. Instead *Save* **replaces** the DNF's toast with one entry: the same label, detail *Reason saved*, a fresh 8 seconds, whose Undo is one request, `DELETE /api/progress/book` with `{ change, note }`, undoing the note and the status in **one transaction**. It refuses, changing nothing, if the note has changed since. So a reason can never come back without its status, or a status without its reason.

**Steps**
1. `saveBookStatus` reads `notes` in its `before` select and answers it; `POST /api/progress/book` answers `note` (the book's note, which a status write doesn't change); `BookWritten.note`.
2. `undoBookStatus(userId, change, note?)`: in the same transaction, first checks `notes = note.note` and puts `note.prior` back, then the status undo (so a book that had no row still loses it only with a NULL note). The route validates `note` as the note route does.
3. `useBookWrite` answers `{ written, amend }`: `amend(note)` pushes the replacement entry (same label, detail *Reason saved*), whose undo sends `{ change, note }`, runs `onUndone`, refreshes.
4. `src/components/ClosingCard.tsx` (new): a labelled one-line *Reason* field (focused, prefilled with the note), *Save* (`btn sec sm`, grey) and *Skip* (grey); Esc = Skip; focus back to the DNF button either way; unchanged text writes nothing; a failed note save keeps the card open with the error and *Retry* (R1-07), the DNF and its Undo left alone. Built so 5.4 can add a rating.
5. `BookStatus.tsx`: DNF chosen from another status saves at once, then opens the card. (DNF is set nowhere else.)
6. `booksDone` answers `note` for DNF rows only (`CASE WHEN st.status = 'dnf' THEN st.notes END`); `StatusBookRow` takes `reason` and draws a grey `.row-reason` under the title, nothing when null; `src/app/books/status/page.tsx` passes it; `src/app/globals.css` styles the card and the line.
7. `design/mockups.html`: the card in `blist` (phone, desktop), the reason on a *Stopped* row in `status`; `design/mockups-index.md` names them.

**Files** (not in *Files likely touched*: `src/db/writes.ts`, `src/app/api/progress/book/route.ts` for the shared undo and the note in the answer; `src/app/books/status/page.tsx`, `src/app/globals.css`; `test/dnf-reason.test.ts`)
- `src/components/ClosingCard.tsx` (new), `src/components/BookStatus.tsx`, `src/components/useBookWrite.ts`
- `src/db/writes.ts`, `src/app/api/progress/book/route.ts`, `src/db/queries.ts`
- `src/components/StatusBookRow.tsx`, `src/app/books/status/page.tsx`, `src/app/globals.css`
- `design/mockups.html`, `design/mockups-index.md`
- `test/status.test.ts`, `test/dnf-reason.test.ts` (new), `test/e2e/dnf-reason.spec.ts` (new)

**Test strategy**
- `test/status.test.ts`: `booksDone` answers the note for a DNF book; null for one without, and for a Read book (AC-1, AC-2).
- `test/dnf-reason.test.ts`: the POST answers `note`; DNF → note → combined undo leaves `reading`, the start, NULL note; a prior note *Gift from Sam* comes back; the undo refuses, changing nothing, once the note changed since (AC-1, AC-3, AC-4).
- `test/e2e/dnf-reason.spec.ts`: the card opens with the field focused; save → reload → *Stopped* shows it; *Skip* and Esc leave the note and return focus to DNF; Undo restores status and note; a failed note save shows *Retry*; the colour sweep (nothing resolves to `--ready` or `--danger`); axe light and dark; screenshots at 360 and 1280 (AC-1–AC-4, AC-6).
- AC-5: the redrawn frames, read.

**Risks**: a save after the DNF's toast ran out gives its Undo another 8 seconds, which is intended (Undo still takes back both). Clearing the field and saving clears the note; Undo puts it back.

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
