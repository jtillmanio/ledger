---
id: TASK-077
title: 3.4b Rank a book when you finish it (3 of 3) — rank it at the finish, this or that
status: Ready
depends_on: [TASK-075, TASK-076, TASK-055]
size: M
model: opus
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-077 — 3.4b Rank a book when you finish it (3 of 3) — rank it at the finish, this or that

## Goal

When a book is marked *Read*, it can be placed in that year's ranking in a few quick picks, two books at a time, or skipped and placed later from Top books.

## Context

- Roadmap: `docs/05-roadmap.md` § 3.4b Rank a book when you finish it, and every year's top ten (M14). The entry and its **Check:** are the contract (agreed by the owner 2026-11-13). Feature F-60. Pulled ahead of 1.26 (D-139). This part's merge ticks the entry.
- **Split, 3 of 3.** TASK-075 put the rank on the read with its writes; TASK-076 built the Top books page with *Not ranked yet*. This part adds the sorter and its two entry points.
- **Ranked at the finish** (D-101). Setting a book to *Read* (1.5, `saveBookStatus`) offers *Rank it in <year>* beside the undo toast. The toast already carries 2.2h's finish offer (*Now reading* chips, *Keep going?*, `src/components/ToastOffer.tsx`, mockup `finishoffer`, TASK-055); how the two share the toast is the plan's, against D-116 (F6 into the toast). 5.4's closing card does not exist yet; 5.5 builds one for books (D-139), and whichever lands second wires the offer into it.
- **This or that**: a binary insertion against the year's ranked reads, one pick of two at a time, so a year of *n* ranked reads places a new one in at most ⌈log₂(n+1)⌉ picks (34 → 6, six → 3). *Skip* leaves the read unranked, and Top books lists it under *Not ranked yet* with the same control (TASK-076's page). The sorter is the one 9.4 draws (the music song ranking); whichever is built first builds it as a shared component (`src/components/`), with the insertion logic a pure function under `src/lib/` that the test drives with scripted answers.
- **The year** is the read's finish year. A read with no date has no year (*No year*) and is not offered a rank. A listen is ranked like any read (1.23).
- The sorter opens as a sheet (`src/components/Sheet.tsx`): one sheet at a time (D-34), focus on its heading and back on the opener (R1-11), the undo toast live above it (D-63, D-144).
- Placing pushes one undo that restores the year's ranks as they were (TASK-075's writes).
- Design: no mockup frame draws the sorter; `docs/04-design.md` § 10 The UX floor and `design/STYLE_GUIDE.md` § 7 (sheets) govern it. The plan proposes its layout from mockup `top` and `finishoffer`, and `ui.redrawFiles` (`design/mockups.html`, `design/mockups-index.md`) get the frame in the same PR.
- Decisions: D-34, D-63, D-101, D-116, D-117, D-122, D-144.
- *From TASK-075 (3.4b, PR #253):* the writes are `rankRead` / `undoRank` in `src/db/writes.ts` (`/api/progress/book/rank`: `{ readId, rank }`, or `{ bookId, rank }` for the book's latest read; D-150). A finish's `saveBookStatus` change carries the appended read's id (`appended`), the read to rank. `undoBookStatus` refuses (409) once that read is ranked, so *Undo* beside *Rank it* fails after a placement until the placement is undone first: the plan says how the toast orders the two undos. A ranked read re-dated into another year, or to no date (`redateBookRead`), carries its rank: a gap in one year and a tie in the other until the next rank write to each heals them (`yearRanking` orders by rank, then the read's id). The plan says whether a re-date across years should take the read out of its old year's ranking in the same write, with its undo.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves *placing a new read into a year of six ranked reads with scripted answers takes at most 3 picks and leaves ranks 1–7 contiguous, and its undo restores the six as they were* and *Skip writes no rank*. TASK-075 proves the two-year and move clauses and the migration; TASK-076 the browser clauses): `npm test`: placing a new read into a year of six ranked
reads with scripted answers takes at most 3 picks and leaves ranks 1–7
contiguous, and its undo restores the six as they were; *Skip* writes no rank;
a book read in two years holds a rank in each; moving a book from rank 12 to
rank 3 leaves ranks contiguous and puts it in the top ten, and its undo restores
the order. In the browser (0.11), a past year lists its first ten, a divider,
then every other book read that year, with none collapsed; an unranked read
shows under *Not ranked yet*; a read with no date shows under *No year*; and the
Library renders no year chip. The up → down → up migration test passes.
- [ ] AC-2: The insertion function, given *n* ranked reads from 0 to 40 and every scripted answer sequence for *n* ≤ 6, asks at most ⌈log₂(n+1)⌉ questions and returns the position the answers imply; with 0 ranked reads it asks none and places at 1.
- [ ] AC-3: Marking a dated book *Read* shows *Rank it in <year>* in the toast; a book read with no date shows no rank offer; choosing it opens the sorter sheet with the year's ranked reads two at a time.
- [ ] AC-4: In the browser, finishing a book in a year of three ranked reads and answering the picks places it where the answers say on Top books; *Skip* closes the sheet, writes no rank, and the read is under *Not ranked yet*, whose control opens the same sorter.
- [ ] AC-5: The sorter sheet and the toast offer meet the UX floor (`docs/04-design.md` § 10. The UX floor): both choices and *Skip* are real buttons with names, 44px on the phone; the sheet's focus starts on its heading and returns to the opener on close by any route; the undo toast stays live above it; text 4.5:1 in both themes; reduced motion makes its transitions opacity-only; axe reports no new violations; screenshots at 360px, 834px and 1280px, light and dark.

## Out of scope

- 9.4's song ranking itself (only the shared sorter component).
- 5.4's closing card for runs; wiring into 5.5's card if 5.5 lands second (that task's).
- Re-ranking a whole year from scratch.
- Ranking comic reads.

## Files likely touched

- `src/lib/rank-insert.ts` (new) — the binary insertion, pure.
- `src/components/ThisOrThat.tsx` (new) — the shared sorter sheet.
- `src/components/ToastOffer.tsx` and/or `src/components/BookStatus.tsx` — the *Rank it in <year>* offer.
- `src/components/TopBooks.tsx` — *Not ranked yet* opens the sorter.
- `design/mockups.html`, `design/mockups-index.md` — the sorter's frame (`ui.redrawFiles`).
- `test/rank-insert.test.ts` (new), `test/year-rank.test.ts`, `test/e2e/top-books.spec.ts`.

## Verification

- Automated: `test/rank-insert.test.ts` (AC-2), `test/year-rank.test.ts` (AC-1's placement and *Skip* clauses on `TEST_DATABASE_URL`), `test/e2e/top-books.spec.ts` (AC-3, AC-4, axe).
- Manual: on the dev database, mark a book *Read*, take *Rank it in 2026*, answer the picks → it lands where expected on Top books; Undo → the year's ranks are as before; leave the data as found.

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
