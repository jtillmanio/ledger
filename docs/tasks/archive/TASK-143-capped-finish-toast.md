---
id: TASK-143
title: 6.24 Built screens follow the mediums review (1 of 4) — the capped finish toast
status: Done
depends_on: []
size: M
model: opus
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: 45c92c8
---

# TASK-143 — 6.24 Built screens follow the mediums review (1 of 4) — the capped finish toast

## Goal

Finishing a book in a series shows a short toast: one *Now reading* chip and *+N · Follow…*, with *Keep going?* moved into the *Follow…* sheet, so the toast stays readable however many things the finish touches.

## Context

- Roadmap: `docs/05-roadmap.md` § 6.24 Built screens follow the mediums review (M21 in `docs/06-tasklist.md`; follows 6.23's review, D-177). Feature F-44. Depends on 6.23 (TASK-126, done). Its **Check:** is AC-1, verbatim; proposed, and agreed when merged.
- **Split, 1 of 4** (`workflow.splitPolicy: split`: four screens across seven components, the mockup's frames and six new 834px frames are more than one sitting). This part: the finish toast. TASK-144 does *Remove from Listen next* and the sheets' steppers, TASK-145 the Library's dropdown chips, TASK-146 the remaining mockup frames, and TASK-146's merge ticks 6.24.
- **The departure** (MR-D17, MR-Q19, frame E10 in `design/MR-E-Review-2.dc.html`; PNGs in `design/screenshots/mediums-review/`; `design/STYLE_GUIDE.md` §17.8–§17.9): the finish toast keeps one *Now reading* chip and *+N · Follow…*; *Keep going?* moves into the *Follow…* sheet, where *Rank it* keeps its row. **It amends 2.2h** (D-117: one *Now reading* chip per thing the finish followed) and 2.2c's *Keep going?* row in the toast (D-108).
- **What exists.** `src/components/ToastOffer.tsx` draws the chip rows (*Rank it in 2026* above, task 3.4b; *Now reading*, one chip per follow, each ending in a grey × named *Stop following <name>*; then *Keep going?*), loaded lazily by `src/components/Undo.tsx` only when a toast carries an offer (PR #197's Lighthouse run). Taking a chip writes, then pushes its own entry carrying the chips left, which commits the finish. The offer is built in `src/lib/follow-offer.ts`; the follow sheet is `src/components/FollowSheet.tsx` with `src/components/FollowOptions.tsx`. Finishes come from `src/components/FinishBook.tsx` and `src/components/BookStatus.tsx` via `src/components/useBookWrite.ts`.
- **Unchanged behaviour the plan must keep:** a chip that fails says so with Retry and changes nothing; focus stays in the toast when it was there; one toast at a time; undo of the finish still undoes it.
- **Questions for the plan gate** (write them in the plan, never guess): which *Now reading* chip is the one kept when the finish followed several (outermost first, as *where the book sits* orders them, is the frame's); whether *+N* counts the remaining *Now reading* follows and *Keep going?* offers together; and that the frame's *Rank it* row is the toast's or the sheet's.
- Design: `design/mockups.html` § `finishoffer` (and `thisorthat`'s toast, which draws *Rank it* above *Now reading*), redrawn from E10 (`ui.redrawFiles`; `design/mockups-index.md` lists `finishoffer` as 6.24's).
- Rules: `.claude/rules/ui.md` (completion has no celebration, nothing red on a dashboard). UX floor: `docs/04-design.md` § 10. The UX floor. Decisions: D-40, D-108, D-117, D-177.

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim; this part proves *finishing a book in a series shows one Now reading chip and +N · Follow…, and Keep going? is in the Follow… sheet*. TASK-144 to TASK-146 prove the rest):
browser test at 360px, light and dark: *Remove from Listen next* resolves to
no `--danger` colour; finishing a book in a series shows one *Now reading*
chip and *+N · Follow…*, and *Keep going?* is in the *Follow…* sheet; the
batch and finish sheets' stepper buttons resolve to `--sunk`; the Library
shows *Owned* and *Sort* as dropdown chips in one row and the genre row, and
nothing scrolls sideways; `design/mockups.html`'s `blist`, `status`,
`finishoffer`, `batch` and `settings` frames are redrawn from the review and
it gains the six 834px frames.
- [x] AC-2: Given a finish that follows three things and offers two to keep going, the toast shows exactly one *Now reading* chip and one *+N · Follow…* button whose N is the count the plan fixes; opening *Follow…* lists the other follows and the *Keep going?* offers, each taking writes what its chip wrote before.
- [x] AC-3: Given a finish that follows exactly one thing and offers nothing, the toast shows its one *Now reading* chip and no *+N · Follow…*.
- [x] AC-4: Taking a chip in the toast or in the sheet commits the finish as before (the finish's undo window closes), a failed chip shows Retry and changes nothing, and *Rank it in 2026* still opens *This or that*.
- [x] AC-5: The toast and the *Follow…* sheet meet the UX floor (`docs/04-design.md` § 10. The UX floor): every chip and button a real control with a name and at least 44px tall in the toast, focus moves into the sheet and returns to *+N · Follow…* on close, reduced motion respected, axe reports no new violations, and screenshots at each `ui.viewports` width, light and dark.
- [x] AC-6: `design/mockups.html` § `finishoffer` is redrawn from E10 and its `design/mockups-index.md` row says so.

## Out of scope

- *Remove from Listen next*, the steppers (TASK-144), the Library (TASK-145), the other mockup frames (TASK-146).
- What a finish follows (2.2h's rules) or what *Keep going?* offers (2.2c's): only where they are shown changes.
- *This or that* itself (3.4b).

## Files likely touched

- `src/components/ToastOffer.tsx`, `src/components/Undo.tsx` — the capped toast.
- `src/components/FollowSheet.tsx`, `src/components/FollowOptions.tsx` — *Keep going?* and the remaining follows in the sheet.
- `src/lib/follow-offer.ts` — the toast's share and the sheet's.
- `src/app/globals.css` — tokens only.
- `design/mockups.html`, `design/mockups-index.md` — `finishoffer`.
- `test/undo.test.tsx`, `test/e2e/follows.spec.ts` — AC-1's clause, AC-2 to AC-5.

## Verification

- Automated: `test/undo.test.tsx` (AC-2 to AC-4, the chips and the counts); `test/e2e/follows.spec.ts` at 360px, light and dark, with axe (AC-1's clause, AC-5).
- Manual: the ui-verifier sets a book in a series to *Reading*, then finishes it, on the dev database (a finish follows only from Reading or Listening, 2.2h), and walks the toast and *Follow…* → expected: one chip, *+N · Follow…*, *Keep going?* in the sheet; the data is left as found (undo the finish).

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- Candidate decision: the finish toast is capped at one *Now reading* chip, the narrowest followed, plus *+N · Follow…*, N counting every chip the toast hides; *Keep going?* lives in the sheet as chips above its rows → docs/review/decisions.md § D-183 (approved at close-out; D-108 and D-117 marked *Amended by D-183*)
- E10's note says the toast keeps the narrowest thing the finish followed while its frame draws the series beside a subseries → not tracked: settled by the owner at the plan gate (the note) and recorded in D-183
- D-183 leaves two other mockup places drawing *Keep going?* in the toast: `status`'s In flight *Finished* toast (`design/mockups.html`, `design/mockups-index.md`'s `status` row) and `thisorthat`'s note → docs/tasks/TASK-144-grey-remove-and-sunk-steppers.md § Context
- `test/e2e/follows.spec.ts:189` (2.2c's sheet test) read `computedStyle(["backgroundColor"])`, which answers `""`, so its *not --danger* check could never fail → not tracked: done in this PR (plan revision 2)
- Two differences from E10 the cap leaves open: at 360–412px a long kept chip pushes *+N · Follow…* onto its own line (three chip rows where E10's note says two), and the *Now reading* label is sentence case where E10 draws uppercase mono → docs/tasks/TASK-146-mockup-settings-and-834-frames.md § Context
- This task's Verification said to finish *a book in a followed series*; a finish follows only from Reading or Listening (2.2h) → docs/tasks/TASK-143-capped-finish-toast.md § Verification (fixed in this PR)
- The ui-verifier's walk left the dev database changed: a stray read (24 Nov 2026) on *A Court of Wings and Ruin* and *The Dry*, both back at To read; *The Fires of December*'s series (Hoid's Travails) and subseries (Secret Projects) stored `off` where they were probably no row → not tracked: the owner said to leave it (the dev database is disposable; the next rebuild resets it)
- A radio change in the sheet pushes a plain follow toast, so the toast drops the finish's other chips (they stay in the sheet) → not tracked: accepted at the plan gate (a plan risk)
- At phone and tablet widths the toast covers the lower part of the open sheet → not tracked: the sheet scrolls and D-144's `--toast-clear` keeps its buttons clear, as for any toast over a sheet before 6.24

## Plan

Answers at the plan gate (owner, 2026-11-24): the toast keeps the **narrowest** chip the finish followed (subseries, else series, else universe; E10's note, over its frame); **N counts everything hidden**, the other *Now reading* follows and every *Keep going?* offer, so a finish that follows nothing still reaches its offers; the sheet shows the offer as **chips above its rows**; *Rank it* keeps its row above, as built (MR-D17 "keeps its row"; `thisorthat` draws it above); the branch starts from `main` after #338.

**Steps**

1. Tests first: `test/undo.test.tsx` (AC-2, AC-3, AC-4) fail for the expected reason; `test/e2e/follows.spec.ts`'s toast tests rewritten to the cap, plus a 360px light-and-dark test (AC-1's clause, AC-5).
2. `src/lib/follow-offer.ts`: a chip carries its grouping (`kind`, `id`); `toastShare(chips)` splits an offer into the toast's (the narrowest *Now reading* chip) and the sheet's (the other follows, then *Keep going?*).
3. `src/components/Undo.tsx`, `src/components/useBookWrite.ts`: a third chip, `row: "follow"`, whose `open(opener, chips)` opens the *Follow…* sheet with the chips the toast hides, built beside *Rank it* and pinning the toast while the sheet is open (`hold()`); the finish's Undo drops the sheet's offer, as it cancels the sorter.
4. `src/components/ToastOffer.tsx`: *Rank it* row as built; then one row: *Now reading*, the kept chip, *+N · Follow…* (`aria-haspopup="dialog"`); no follows, no label and *+N · Follow…* alone; nothing hidden, no *+N*. Taking a chip pushes the chips left, which the next toast caps again.
5. `src/components/FollowOffer.tsx` (new) + `src/app/layout.tsx`: `FollowOfferProvider`, beside `RankSorterProvider`, owns the sheet so it outlives the toast that opened it; `FollowSheet` stays lazy.
6. `src/components/FollowSheet.tsx`: opened with an offer, *Now reading* (× chips, *Stop following …*) and *Keep going?* chip rows above its rows; a chip writes what the toast's wrote, pushes the chips left, updates its row, and the sheet stays open; a row changed drops that grouping's chip; on close focus returns to *+N · Follow…*, or the new toast's when a chip replaced it.
7. `src/app/globals.css`: the sheet's chip style, tokens only, 44px.
8. `design/mockups.html` § `finishoffer` redrawn from E10, with a frame of the sheet's *Keep going?*; `design/mockups-index.md`'s row.

**Files**: the task's list, plus `src/components/useBookWrite.ts`, `src/components/FollowOffer.tsx` (new) and `src/app/layout.tsx` (not in the list); `src/components/FollowOptions.tsx` likely untouched. 13 files, UI only, no schema; kept whole as part 1 of an existing split.

**Test strategy**: AC-2 to AC-4 in `test/undo.test.tsx`; AC-1's clause and AC-5 (44px, focus into the sheet and back, reduced motion, axe, screenshots) in `test/e2e/follows.spec.ts`; AC-6 by ui-verifier and spec review.

**Risks**: a radio change in the sheet pushes a plain follow toast, so the toast drops its remaining chips (they stay in the sheet); five e2e tests change their expectations.

**Revision 1 (Phase 2, a test file only):** `test/e2e/status.spec.ts`'s In flight *Finished* test asserted the toast's *Keep going?* group, which the cap moves into the sheet; it now asserts *+1 · Follow…*. Found by grepping `test/` for the strings the diff changes, as `.claude/project/implement-task.md` asks.

**Revision 2 (close-out, a test file only; owner: "fix it here"):** `test/e2e/follows.spec.ts:189`, 2.2c's sheet test, read `computedStyle(["backgroundColor"])`, which `getPropertyValue` answers with `""`; it reads `background-color` now and asserts the checked option is `--brand`, never `--danger`. The same bug, fixed in this task's own tests at spec review R1.

## Review log

_Filled by /implement-task. One line per round._

- Verify R1 PASS | CI R1 PASS (2271e1e) | Spec R1 CHANGES (AC-5: the sheet checked only at 360px) → fixed (245d2e5) | Verify R2 PASS | Spec R2 APPROVE | CI R2 PASS (245d2e5) | Audit R1 PASS (AC-3 a boundary guard, behaviour unchanged) | UI R1 PASS AC-1 to AC-5 (dev database left changed; owner: leave it) | Plan revision 2 (follows.spec.ts:189) → Verify R3 PASS | Follow-ups check R1 CHANGES (TASK-144 placement missing) → R2 APPROVE | Drift R1 update first (behind #339; both changed mockups.html, mockups-index.md, globals.css) → rebased | Verify R4 PASS (with follows, markup and mockup-tablet specs)

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 3
- Review rounds: 2 (spec), 1 (audit), 1 (UI)
- First-pass AC FAILs: 1 (AC-5, the sheet untested past 360px)
- Plan revisions after approval: 2 (test files only)
