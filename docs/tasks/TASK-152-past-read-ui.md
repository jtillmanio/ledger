---
id: TASK-152
title: 1.17c Log a past read of a book already read (2 of 2) — Add a past read
status: In progress
depends_on: [TASK-151]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: 6937521
---

# TASK-152 — 1.17c Log a past read of a book already read (2 of 2) — Add a past read

## Goal

On a Read book's date line, *Add a past read* lets the owner log an earlier (or later) read with its dates and format, with Undo.

## Context

- Roadmap: `docs/05-roadmap.md` § 1.17c Log a past read of a book already read (M17). Feature F-17. Its **Check:** is AC-1, verbatim; proposed in PR #342 and agreed when it merged (2026-11-25).
- **Split, 2 of 2.** TASK-151 builds the write and the route; this draws the control.
- **What exists.** The date line and *All reads (n)* are `src/components/AllReads.tsx` and `src/components/useReads.tsx` (1.17b, D-131), with 1.5's picker in `src/components/FinishDate.tsx` (a day, a month or a year); the status control is `src/components/BookStatus.tsx`; Undo is `src/components/Undo.tsx`. Where 1.17b draws the date line (the Library row, Now, the status screens and the book sheet), *Add a past read* appears too.
- Design: `design/mockups.html` § `status` and `bookdetail` (`design/mockups-index.md`); the frames gain *Add a past read* before it is built (`ui.redrawFiles`).
- Rules: `.claude/rules/ui.md`. UX floor: `docs/04-design.md` § 10. The UX floor. Decisions: D-131, D-85.
- *From TASK-151 (1.17c, PR #358):* the route is `PUT /api/progress/book/read` with `{ bookId, start?, finish, format? }` (each date the finish-date control's choice, `format` `text` by default or `audio`), answering `{ ok, logged }`: 400 a bad date or a start after the finish (`START_AFTER_FINISH`), 404 a missing book, 409 a book that isn't Read. Undo is `DELETE` on the same route with `{ logged }`, 409 once the book's reads or status have changed. A book's latest read is now its latest finish (D-191), so `bookReads` (*All reads*) lists by finish, oldest first, and can re-sort after an add or a re-date; a past read finished after the latest moves the book's finish line.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves its browser clauses, TASK-151 its database clauses):
with
the test database, a book read 2024-03-10 gets a past read finished
2019-06-01: it has two `read_events` rows, `book_status` still finishes
2024-03-10, and `book_reads` counts the book in 2019 and in 2024; Undo leaves
one row. A past read finished 2025-01-05 moves `book_status`'s finish to
2025-01-05. In the browser (0.11) at 360px, *Add a past read* opens both
pickers, a start after the finish is refused and writes nothing, and axe
passes.
- [ ] AC-2: Given a Read book with one read, when *Add a past read* is confirmed with a finish of a year only, then the date line lists *All reads (2)*, the new read shown by its year, with its format glyph.
- [ ] AC-3: Given a logged read, when Undo is pressed in the toast, then the list is back to the reads before and the book's finish line is unchanged from before the add.
- [ ] AC-4: The control meets the UX floor (`docs/04-design.md` § 10. The UX floor): every control named, 44 px targets at phone widths, focus returns to *Add a past read* after a confirm or Esc, contrast in both themes, and screenshots at each `ui.viewports` width, light and dark.

## Out of scope

- The write and the route (TASK-151).
- Editing an existing read (1.17b already does).

## Files likely touched

- `src/components/AllReads.tsx` — *Add a past read* and its form.
- `src/components/useReads.tsx` — the add and its undo.
- `src/components/FinishDate.tsx` — reused for *Started* and *Finished*.
- `src/app/globals.css` — tokens only.
- `design/mockups.html`, `design/mockups-index.md` — `status` and `bookdetail` gain the control.
- `test/e2e/past-read.spec.ts` — new: AC-1's browser clauses, AC-2 to AC-4, axe.

## Verification

- Automated: `test/e2e/past-read.spec.ts` (AC-1's browser clauses, AC-2 to AC-4) with axe at 360px and 1280px, light and dark.
- Manual: `npm run dev`, open a Read book's sheet, *Add a past read* for 2019 → expected: *All reads (2)* lists it, Undo removes it.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- A glyph for every kind of consumption, not only a listen: read, listened, watched, played, listened to an album, wherever a read or format is shown (owner, at the plan gate: its own task) → `docs/05-roadmap.md` § phase 6, new item (approved at plan)

## Plan

Approved 2026-11-28 (owner: frames as proposed; format words match the app; the glyph for every kind of consumption is its own item).

**Steps**

1. Write `test/e2e/past-read.spec.ts` first, seeded as `start-dates.spec.ts` seeds (a book read 2024-03-10, one read); confirm each test fails.
2. `src/components/BookStatus.tsx`: *Add a past read* on the date line, Read books only (the route answers 409 otherwise), with a ref so focus returns to it. Opening it closes the other date controls; opening one of them closes it.
3. `src/components/AllReads.tsx`: `AddPastRead`, lazy from the same chunk as *All reads* (no cost to the Library's first load). *Started* (1.5's picker, opens on *No date*: optional), *Finished* (opens on *Today*), *Format*: **Read · Listened** (the app's words: *Read 2× · Listened 1×*, the Done tab's *Listened* chip; sent as `text` / `audio`), Save and Cancel. A start after the finish shows *That's after the day you finished.* under *Started*, Save `aria-disabled`, nothing sent; a server 400 or 409 shows its reason the same way. Esc, Cancel and a confirm return focus to *Add a past read*.
4. `useLogPastRead` beside `useRedate` in `AllReads.tsx` (the lazy chunk, not `useReads.tsx`): `PUT /api/progress/book/read`, then a page refresh, the reads reloaded and *All reads (n)* opened; the toast *‹title›: past read added* · *Finished 2019, approximate*; its Undo is `DELETE { logged }`, then a reload and a refresh.
5. `design/mockups.html`: `blist` frame c gains *Add a past read* on its date line, and a new frame d draws the form open (*Year only* 2019, *Listened*); a notes entry, and a line in the `status` and `bookdetail` notes that the same control sits on their date line. `design/mockups-index.md` follows.
6. The touched spec in one project, then `verify.full`.

**Files**

- `src/components/BookStatus.tsx`: the button (not in Files likely touched: the date line is drawn here, for the Library row, Now, the status tabs and the sheet).
- `src/components/AllReads.tsx`: the form and the add's hook.
- `design/mockups.html`, `design/mockups-index.md`: `blist` frames c and d, notes.
- `test/e2e/past-read.spec.ts`: new.
- `src/app/globals.css`: tokens only, and only if the form needs spacing the existing classes don't give.
- `useReads.tsx` and `FinishDate.tsx` unchanged (the picker is reused as it is).

**Test strategy** (`test/e2e/past-read.spec.ts`)

- AC-1 (browser clauses): at 360px *Add a past read* opens *Started* and *Finished*; a start after the finish shows the reason, sends no PUT and leaves one `read_events` row; axe passes.
- AC-2: a *Listened* read finished *Year only* 2019 → *All reads (2)*, a row *Finished 2019, approximate* with the *Listened* glyph (a text read has no glyph yet: the follow-up).
- AC-3: Undo → one read, *Finished 10 March 2024* unchanged; and a 2025-01-05 read moves *Finished* to 5 January 2025, Undo puts 10 March 2024 back.
- AC-4: 44px targets at phone widths, focus back after a confirm and after Esc, axe light and dark, screenshots at every `ui.viewports` width, light and dark.

**Risks**: the sheet's `readCount` is fixed at page load; the refresh and the reload cover it. **Size**: 5–6 files, UI only.

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
