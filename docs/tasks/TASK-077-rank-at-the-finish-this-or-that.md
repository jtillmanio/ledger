---
id: TASK-077
title: 3.4b Rank a book when you finish it (3 of 3) — rank it at the finish, this or that
status: Review
depends_on: [TASK-075, TASK-076, TASK-055]
size: M
model: opus
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: 73c21d9
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
- *From TASK-076 (3.4b, PR #257):* the Library's year chips were split out to TASK-091 at TASK-076's plan gate (owner, 2026-11-14), so AC-1's browser clauses are now split between TASK-076 and TASK-091, and the roadmap entry is ticked when TASK-091 is Done too, not by this part's merge alone. Top books (`src/components/TopBooks.tsx`) lists *Not ranked yet* in the same `ReorderList` as the ranks; `ReorderList`'s `move` may answer its own undo and toast detail, and `place` / `marker` name a row and draw the divider, which the sorter's entry on that page can reuse.
- *From TASK-075 (3.4b, PR #253):* the writes are `rankRead` / `undoRank` in `src/db/writes.ts` (`/api/progress/book/rank`: `{ readId, rank }`, or `{ bookId, rank }` for the book's latest read; D-150). A finish's `saveBookStatus` change carries the appended read's id (`appended`), the read to rank. `undoBookStatus` refuses (409) once that read is ranked, so *Undo* beside *Rank it* fails after a placement until the placement is undone first: the plan says how the toast orders the two undos. A ranked read re-dated into another year, or to no date (`redateBookRead`), carries its rank: a gap in one year and a tie in the other until the next rank write to each heals them (`yearRanking` orders by rank, then the read's id). The plan says whether a re-date across years should take the read out of its old year's ranking in the same write, with its undo.

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim; this part proves *placing a new read into a year of six ranked reads with scripted answers takes at most 3 picks and leaves ranks 1–7 contiguous, and its undo restores the six as they were* and *Skip writes no rank*. TASK-075 proves the two-year and move clauses and the migration; TASK-076 the browser clauses): `npm test`: placing a new read into a year of six ranked
reads with scripted answers takes at most 3 picks and leaves ranks 1–7
contiguous, and its undo restores the six as they were; *Skip* writes no rank;
a book read in two years holds a rank in each; moving a book from rank 12 to
rank 3 leaves ranks contiguous and puts it in the top ten, and its undo restores
the order. In the browser (0.11), a past year lists its first ten, a divider,
then every other book read that year, with none collapsed; an unranked read
shows under *Not ranked yet*; a read with no date shows under *No year*; and the
Library renders no year chip. The up → down → up migration test passes.
- [x] AC-2: The insertion function, given *n* ranked reads from 0 to 40 and every scripted answer sequence for *n* ≤ 6, asks at most ⌈log₂(n+1)⌉ questions and returns the position the answers imply; with 0 ranked reads it asks none and places at 1.
- [x] AC-3: Marking a dated book *Read* shows *Rank it in <year>* in the toast; a book read with no date shows no rank offer; choosing it opens the sorter sheet with the year's ranked reads two at a time.
- [x] AC-4: In the browser, finishing a book in a year of three ranked reads and answering the picks places it where the answers say on Top books; *Skip* closes the sheet, writes no rank, and the read is under *Not ranked yet*, whose control opens the same sorter.
- [x] AC-5: The sorter sheet and the toast offer meet the UX floor (`docs/04-design.md` § 10. The UX floor): both choices and *Skip* are real buttons with names, 44px on the phone; the sheet's focus starts on its heading and returns to the opener on close by any route; the undo toast stays live above it; text 4.5:1 in both themes; reduced motion makes its transitions opacity-only; axe reports no new violations; screenshots at 360px, 834px and 1280px, light and dark.

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

- A ranked read re-dated into another year (or to no date) should leave its old year's ranking in the same write, closing the gap, with its undo putting the rank back: a new roadmap item with a proposed Check (its row added to `docs/06-tasklist.md` § M14 too) → docs/05-roadmap.md § 3.4c (new) (approved at plan)
- Candidate decision: the toast's *Rank it in <year>* chip opens the sorter and holds the toast while it is open (the finish's Undo and chips stay live, D-63); placing pushes its own entry, which commits the finish (one toast at a time), and its Undo undoes the placement alone; D-116 marked *Amended by D-151* → docs/review/decisions.md § D-151 (approved at plan)
- 9.4's song ranking can reuse `ThisOrThat` and `src/lib/rank-insert.ts`, which know nothing of books → not tracked: roadmap 9.4 already says whichever of 3.4b and 9.4 is built first builds the sorter shared
- ui-verifier noted that setting a Read book back to To read keeps its read (only the finish's Undo removes it) → not tracked: by design (data model: leaving `read` keeps the read log, task 1.5)

## Plan

Approved by the owner 2026-11-14 (kept whole: the ACs span both entry points, so a split would rewrite them; empty year: the sheet offers *Make it #1* or *Skip*).

**Steps**
1. `src/lib/rank-insert.ts` (new): a pure binary-insertion state machine. `start(n)`, `answer(state, "new" | "old" | "skip")` give the next comparison index (into the ranked list, best first), or `done` with a rank (or null for Skip), and the picks so far. At most ⌈log₂(n+1)⌉ picks; n = 0 asks none and places at 1.
2. `src/components/ThisOrThat.tsx` (new): the shared sorter (9.4 reuses it), generic over `{ id, title, sub, cover }` items, rendered inside `Sheet`. *Which did you like more?*, two cover cards side by side (the new one *Just finished*, the other *#k*), each a named button, 44px or more; a mono *Pick 2 of at most 3*; *Skip* (grey) at the foot. With 0 ranked: *Nothing ranked in <year> yet*, *Make it #1* or *Skip*. Reduced motion: opacity-only.
3. `GET /api/progress/book/rank?readId=` (+ a query in `src/db/queries.ts`): the read's year, its book, and that year's ranked reads; a read with no date is a 400, a missing one a 404.
4. `src/components/RankSorter.tsx` (new): provider + `useRankSorter().open(...)`, mounted in `src/app/layout.tsx` inside `UndoProvider`, the sheet lazy-loaded. Loads the year (or takes Top books' rows), runs the sorter, writes `/api/progress/book/rank`, pushes the undo (*Ranked X*, *rank 3 of 7 in 2026*) whose inverse sends the change back.
5. `Undo.tsx` + `ToastOffer.tsx`: an `OfferChip` may `open` instead of `take`; the rank chip draws on its own row above *Now reading*. `useUndo().hold()` holds the toast until released (as focus does); `push(entry, { focus: true })` sends focus into the new toast.
6. `useBookWrite.ts`: a finish whose change carries `appended` and a dated finish gets *Rank it in <year>*; undoing the finish closes an open sorter.
7. `TopBooks.tsx`: each *Not ranked yet* row gets *Rank it* (named *Rank <title> in <year>*), opening the same sorter from the page's rows.
8. `src/app/globals.css` for the sorter and the rank chip; `design/mockups.html` + `design/mockups-index.md`: the sorter's frame and the toast's rank chip.

**Toast and the two undos.** While the sorter is open the toast is held: the finish's Undo and chips stay live (D-63), and undoing the finish closes the sorter with nothing ranked. Placing pushes its own entry, which (one toast at a time) commits the finish; its Undo undoes the placement alone, and focus goes to it. *Skip*, Esc or Back put focus back on the chip, still there because the toast was held.

**Files**: the eight steps' files (`RankSorter.tsx`, `layout.tsx`, `Undo.tsx`, the rank route, `queries.ts`, `globals.css` beyond "Files likely touched"; `src/lib/follow-offer.ts` too, a type rename only: `offerChips` returns the follow kind of chip now that `OfferChip` has a rank kind. Step 7's button shows *Rank it* and is named *Rank it: <title>*, so its name starts with the words it shows (WCAG 2.5.3); the dialog it opens carries the year); tests `test/rank-insert.test.ts` (new), `test/year-rank.test.ts`, `test/undo.test.tsx`, `test/e2e/top-books.spec.ts`.

**Test strategy**
- AC-2: `test/rank-insert.test.ts`: n 0–40, every true position within ⌈log₂(n+1)⌉ picks; n ≤ 6, every answer sequence returns the position its answers imply; n = 0 asks none, places at 1.
- AC-1 (placement, *Skip*): `test/year-rank.test.ts`: six ranked reads, scripted answers through rank-insert into POST: ≤ 3 picks, ranks 1–7 contiguous, undo restores the six; *Skip* writes nothing. The GET route there too.
- AC-3: `test/undo.test.tsx` (the open chip, `hold` outliving 8 s); `test/e2e/top-books.spec.ts`: a *Year only 1986* finish shows *Rank it in 1986*, an undated finish none, the chip opens the sheet.
- AC-4, AC-5: `top-books.spec.ts` with a fixture year 1986 of three ranked reads: the picks place it where the answers say; *Skip* → *Not ranked yet*, whose control opens the same sorter; names, 44px, focus to the heading and back to the opener after Esc, Skip and Back, the toast above the sheet, axe, contrast, reduced motion, screenshots 360/834/1280 light and dark.

**Risks**: answers that land after another rank write moved the year: the server clamps, and the toast names the real rank.

## Review log

- Verify R1 PASS (top-books.spec 9/11 in w390-light → *Rank it* name matcher fixed → 11/11) | Spec R1 CHANGES (follow-ups without destinations) | Schema R1 APPROVE (minor: a ranked read listed against itself → fixed) | Verify R2 PASS
- Audit R1 CHANGES (two pin tests in undo.test.tsx NON-DISCRIMINATING → strengthened) | CI R1 FAIL (follows.spec.ts:272, 313, 383 in every project: the toast's new *Rank it* chip in Tab order and count → tests updated) | Verify R3 PASS (+ follows.spec, top-books.spec 23/23) | Spec R2 APPROVE | Audit R2 PASS | CI R2 PASS (every project, Vercel, Lighthouse)
- UI R1 FAIL (focus after a placement from a finish with follow chips went to a chip, not Undo → fixed, undo.test.tsx case) | Rebased onto main (4.5b, #259) at the owner's ask | Verify R4 and CI R3 on the rebased head (see PR #260)

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 4 (local) + 3 CI runs
- Review rounds: spec 2, schema 1, audit 2, UI 1
- First-pass AC FAILs: 1 (AC-4/AC-5: focus after a placement with follow chips, UI R1)
- Plan revisions after approval: 0 (two notes in the plan's Files line: `src/lib/follow-offer.ts`'s type rename, the *Rank it* button's name)
